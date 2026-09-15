import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Home, X, MapPin, Bed, Bath, Car, Search, Map as MapIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { realEstateService, PublicRealEstate, PublicRealEstateListing } from '@/services/public/realEstateService';

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const resolveMediaUrl = (url?: string | null): string => {
  if (!url) return '';
  let resolved = url;
  if (resolved.includes('dropbox.com')) {
    resolved = resolved.replace(/&?dl=0/g, '').replace('www.dropbox.com', 'dl.dropboxusercontent.com');
  }
  if (resolved.startsWith('http') || resolved.startsWith('//') || resolved.startsWith('blob:') || resolved.startsWith('data:')) {
    return resolved;
  }
  return `${API_ORIGIN}${resolved.startsWith('/') ? '' : '/'}${resolved}`;
};

const YOUTUBE_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function getYoutubeEmbedUrl(url: string): string | null {
  const match = url.match(YOUTUBE_RE);
  return match ? `https://www.youtube.com/embed/${match[1]}?enablejsapi=1` : null;
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(0)}`;
  }
}

// Mesmo esquema de tracking usado no cardápio digital (ver DigitalMenuPage.tsx).
const TRACKING_COOKIE = 'trackingProfile';
const TRACKING_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'ttclid'];

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=/`;
}

function loadTrackingProfile(): Record<string, string> {
  const existing = getCookie(TRACKING_COOKIE);
  const existingParams: Record<string, string> = existing ? JSON.parse(existing) : {};

  const params = new URLSearchParams(window.location.search);
  const newParams: Record<string, string> = {};
  TRACKING_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) newParams[key] = value;
  });

  const trackingProfile = { ...existingParams, ...newParams };
  if (Object.keys(newParams).length > 0) {
    setCookie(TRACKING_COOKIE, JSON.stringify(trackingProfile), 90);
  }
  return trackingProfile;
}

function pushToDataLayer(eventObject: Record<string, unknown>, trackingProfile: Record<string, string>) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ...eventObject, tracking_properties: trackingProfile, page_url: window.location.href });
}

function buildWhatsappLink(rawNumber?: string | null, text?: string): string | null {
  if (!rawNumber) return null;
  let digits = rawNumber.replace(/\D/g, '');
  if (digits.length <= 11) digits = `55${digits}`;
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

function getCoordinates(listing: PublicRealEstateListing): [number, number] | null {
  const lat = listing.latitude;
  const lon = listing.longitude;
  if (typeof lat !== 'number' || typeof lon !== 'number' || Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return [lat, lon];
}

const DEFAULT_CENTER: [number, number] = [-23.5505, -46.6333]; // São Paulo

const RealEstatePage = () => {
  const [data, setData] = useState<PublicRealEstate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('todas');
  const [estadoFilter, setEstadoFilter] = useState('todos');
  const [cidadeFilter, setCidadeFilter] = useState('todas');

  const [selected, setSelected] = useState<PublicRealEstateListing | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [submittingLead, setSubmittingLead] = useState(false);

  const [mapOpen, setMapOpen] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const detailMapContainerRef = useRef<HTMLDivElement | null>(null);

  const trackingProfileRef = useRef<Record<string, string>>({});
  const homeEventFiredRef = useRef(false);

  useEffect(() => {
    trackingProfileRef.current = loadTrackingProfile();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await realEstateService.getListings();
        setData(result);
        if (!homeEventFiredRef.current) {
          homeEventFiredRef.current = true;
          pushToDataLayer({ event: 'home' }, trackingProfileRef.current);
        }
      } catch {
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Injeta o GTM configurado em Organização > Imobiliária, se houver — mesmo
  // padrão do cardápio digital (ver DigitalMenuPage.tsx), com ids próprios
  // pra não colidir caso as duas páginas coexistam numa mesma sessão.
  useEffect(() => {
    const gtmId = data?.settings?.gtm_id;
    if (!gtmId || document.getElementById('real-estate-gtm')) return;

    const script = document.createElement('script');
    script.id = 'real-estate-gtm';
    script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`;
    document.head.appendChild(script);

    const noscript = document.createElement('noscript');
    noscript.id = 'real-estate-gtm-noscript';
    noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    document.body.insertBefore(noscript, document.body.firstChild);
  }, [data?.settings?.gtm_id]);

  const listings = useMemo(() => data?.listings ?? [], [data]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((l) => (l.tags ?? []).forEach((t) => t && set.add(t)));
    return Array.from(set).sort();
  }, [listings]);

  const estados = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((l) => l.estado && set.add(l.estado));
    return Array.from(set).sort();
  }, [listings]);

  const cidades = useMemo(() => {
    const set = new Set<string>();
    listings
      .filter((l) => estadoFilter === 'todos' || l.estado === estadoFilter)
      .forEach((l) => l.cidade && set.add(l.cidade));
    return Array.from(set).sort();
  }, [listings, estadoFilter]);

  const filteredListings = useMemo(() => {
    let list = listings;
    if (tagFilter !== 'todas') list = list.filter((l) => (l.tags ?? []).includes(tagFilter));
    if (estadoFilter !== 'todos') list = list.filter((l) => l.estado === estadoFilter);
    if (cidadeFilter !== 'todas') list = list.filter((l) => l.cidade === cidadeFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.description ?? '').toLowerCase().includes(q) ||
          (l.bairro ?? '').toLowerCase().includes(q) ||
          (l.cidade ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [listings, tagFilter, estadoFilter, cidadeFilter, search]);

  const openListing = (listing: PublicRealEstateListing) => {
    setSelected(listing);
    setGalleryIndex(0);
    setLightboxOpen(false);
    setLeadFormOpen(false);
    setLeadForm({ name: '', email: '', phone: '', message: '' });
    pushToDataLayer(
      { event: 'view_item', ecommerce: { items: [{ item_id: listing.id, item_name: listing.name, price: listing.price }] } },
      trackingProfileRef.current,
    );
  };

  const closeListing = () => {
    setSelected(null);
    setLightboxOpen(false);
    setLeadFormOpen(false);
  };

  const openMap = () => setMapOpen(true);
  // Só troca o estado — a limpeza do mapa é sempre feita pelo cleanup do
  // useEffect abaixo (nunca aqui). Chamar map.remove() aqui, de dentro do
  // próprio handler de clique de um marker, remove o mapa enquanto o
  // Leaflet ainda está no meio do dispatch daquele evento; o cleanup do
  // effect roda de novo logo em seguida (mapOpen virou false) e tenta
  // remover a mesma instância uma segunda vez, deixando o container marcado
  // como "reused by another instance" da próxima vez que o modal abre.
  const closeMap = () => setMapOpen(false);

  // Inicializa o Leaflet só quando o modal do mapa abre (o container precisa
  // estar no DOM e visível), e reconstrói os pinos sempre que o filtro muda —
  // mesmo padrão do protótipo de referência (~/Desktop/imobiliaria).
  useEffect(() => {
    if (!mapOpen || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current).setView(DEFAULT_CENTER, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const bounds: [number, number][] = [];
    filteredListings.forEach((listing) => {
      const coords = getCoordinates(listing);
      if (!coords) return;
      const icon = L.divIcon({
        className: 'real-estate-map-marker',
        html: `<div style="background:#111827;color:#fff;font-size:11px;font-weight:600;padding:4px 8px;border-radius:9999px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.4)">${formatCurrency(listing.price, listing.currency)}</div>`,
        iconSize: [0, 0],
      });
      const marker = L.marker(coords, { icon }).addTo(map);
      marker.on('click', () => {
        closeMap();
        openListing(listing);
      });
      bounds.push(coords);
    });
    if (bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50] });

    // Leaflet mede o container no momento da criação; se o modal ainda
    // estava animando/tamanho 0, sem isso o mapa nasce cortado.
    setTimeout(() => map.invalidateSize(), 50);

    return () => {
      map.remove();
    };
  }, [mapOpen, filteredListings]);

  // Mapa pequeno embutido na tela cheia do imóvel (só quando tem coordenadas).
  // Mesmo cuidado do mapa grande: só o cleanup deste effect remove a
  // instância — nunca um handler de clique (ver comentário em closeMap).
  useEffect(() => {
    if (!selected || !detailMapContainerRef.current) return;
    const coords = getCoordinates(selected);
    if (!coords) return;

    const map = L.map(detailMapContainerRef.current, { scrollWheelZoom: false }).setView(coords, 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    const icon = L.divIcon({
      className: 'real-estate-map-marker',
      html: `<div style="background:#111827;color:#fff;font-size:11px;font-weight:600;padding:4px 8px;border-radius:9999px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.4)">${formatCurrency(selected.price, selected.currency)}</div>`,
      iconSize: [0, 0],
    });
    L.marker(coords, { icon }).addTo(map);
    setTimeout(() => map.invalidateSize(), 50);

    return () => {
      map.remove();
    };
  }, [selected]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="w-full max-w-lg bg-card rounded-lg shadow-md border border-border p-8 text-center">
          <p className="text-lg font-medium text-foreground">Site indisponível</p>
          <p className="text-sm text-muted-foreground mt-2">Tente novamente em instantes.</p>
        </div>
      </div>
    );
  }

  const settings = data.settings;
  const iconStyle = settings.icon_color ? { color: settings.icon_color, borderColor: settings.icon_color } : undefined;
  const textStyle = settings.text_color ? { color: settings.text_color } : undefined;
  const selectMediaGallery = selected?.media ?? [];
  const activeMedia = selectMediaGallery[galleryIndex];
  const whatsappLink = selected
    ? buildWhatsappLink(
        settings.whatsapp_number,
        `Olá, tenho interesse no imóvel: ${selected.name}. Gostaria de agendar uma visita.`,
      )
    : null;

  // Cria o lead no kanban "Imobiliária" e só depois abre o WhatsApp — o link
  // abre mesmo se a criação do lead falhar, já que o contato pelo WhatsApp é
  // a parte essencial pro visitante; o registro no CRM é um adicional.
  const handleSubmitLead = async () => {
    if (!selected || !leadForm.name.trim() || !leadForm.email.trim() || !leadForm.phone.trim()) return;
    setSubmittingLead(true);
    try {
      // Mesma normalização do link de WhatsApp (buildWhatsappLink): sem DDI,
      // assume Brasil — sem isso o backend guarda um E.164 com o país errado.
      let phoneDigits = leadForm.phone.replace(/\D/g, '');
      if (phoneDigits.length <= 11) phoneDigits = `55${phoneDigits}`;

      await realEstateService.submitLead({
        product_id: selected.id,
        name: leadForm.name.trim(),
        email: leadForm.email.trim(),
        phone: phoneDigits,
        message: leadForm.message.trim() || undefined,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingLead(false);
      setLeadFormOpen(false);
      if (whatsappLink) window.open(whatsappLink, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      style={settings.background_color ? { backgroundColor: settings.background_color } : undefined}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border"
        style={settings.header_color ? { backgroundColor: settings.header_color } : undefined}
      >
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div>
            {settings.company_name && (
              <p
                className="text-xs font-semibold uppercase tracking-wide mb-0.5"
                style={settings.company_name_color ? { color: settings.company_name_color } : undefined}
              >
                {settings.company_name}
              </p>
            )}
            <h1 className="text-xl font-bold text-foreground" style={settings.title_color ? { color: settings.title_color } : undefined}>
              Imóveis
            </h1>
            <p className="text-xs text-muted-foreground" style={textStyle}>
              Confira nossos imóveis disponíveis
            </p>
          </div>
          <button
            onClick={openMap}
            className="h-10 px-4 rounded-full border border-border flex items-center gap-2 text-sm font-medium hover:bg-muted transition-colors shrink-0"
            style={iconStyle}
          >
            <MapIcon className="h-4 w-4" />
            Mapa
          </button>
        </div>

        <div className="max-w-6xl mx-auto px-4 pb-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, bairro, cidade..."
              className="w-full h-10 rounded-full border border-border bg-muted/30 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            <select
              value={estadoFilter}
              onChange={(e) => {
                setEstadoFilter(e.target.value);
                setCidadeFilter('todas');
              }}
              className="shrink-0 h-9 rounded-full border border-border bg-muted/30 px-3 text-sm"
            >
              <option value="todos">Estado</option>
              {estados.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
            <select
              value={cidadeFilter}
              onChange={(e) => setCidadeFilter(e.target.value)}
              className="shrink-0 h-9 rounded-full border border-border bg-muted/30 px-3 text-sm"
            >
              <option value="todas">Cidade</option>
              {cidades.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {tags.length > 0 && (
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="shrink-0 h-9 rounded-full border border-border bg-muted/30 px-3 text-sm"
              >
                <option value="todas">Categoria</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-4 py-6 flex-1 w-full">
        {filteredListings.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-16">
            {listings.length === 0 ? 'Nenhum imóvel disponível no momento.' : 'Nenhum imóvel encontrado.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredListings.map((listing) => {
              const thumb = listing.media.find((m) => m.kind === 'image')?.url ?? null;
              const local = [listing.bairro, listing.cidade].filter(Boolean).join(', ');
              return (
                <button
                  key={listing.id}
                  onClick={() => openListing(listing)}
                  className="text-left bg-card border border-border rounded-lg overflow-hidden hover:border-primary transition-colors"
                >
                  <div className="aspect-video bg-muted/30 flex items-center justify-center overflow-hidden">
                    {thumb ? (
                      <img src={resolveMediaUrl(thumb)} alt={listing.name} className="h-full w-full object-cover" />
                    ) : (
                      <Home className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="font-medium text-foreground text-sm line-clamp-1">{listing.name}</p>
                    {local && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" /> {local}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(listing.price, listing.currency)}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                      {listing.quartos != null && (
                        <span className="flex items-center gap-1">
                          <Bed className="h-3.5 w-3.5" /> {listing.quartos}
                        </span>
                      )}
                      {listing.banheiros != null && (
                        <span className="flex items-center gap-1">
                          <Bath className="h-3.5 w-3.5" /> {listing.banheiros}
                        </span>
                      )}
                      {listing.vagas != null && (
                        <span className="flex items-center gap-1">
                          <Car className="h-3.5 w-3.5" /> {listing.vagas}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="border-t border-border py-4 mt-auto"
        style={settings.footer_color ? { backgroundColor: settings.footer_color } : undefined}
      >
        <p className="max-w-6xl mx-auto px-4 text-center text-xs text-muted-foreground" style={textStyle}>
          {settings.company_name || 'Imóveis'}
        </p>
      </div>

      {/* Listing detail — tela cheia (não é mais um modal pequeno): o botão de
         WhatsApp fica numa barra fixa no rodapé, sempre visível sem precisar
         rolar, e a coluna de informações mostra um mapa embutido quando o
         imóvel tem coordenadas. */}
      {selected && (
        <div className="fixed inset-0 z-30 bg-background flex flex-col">
          <div className="h-14 shrink-0 border-b border-border flex items-center justify-between gap-3 px-4">
            <h3 className="font-semibold text-foreground truncate">{selected.name}</h3>
            <button
              onClick={closeListing}
              className="h-9 w-9 shrink-0 rounded-full hover:bg-muted flex items-center justify-center"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
            <div className="lg:h-full lg:grid lg:grid-cols-2">
              {/* Galeria */}
              <div className="lg:h-full lg:overflow-y-auto bg-muted/10 lg:border-r lg:border-border">
                <div className="aspect-video lg:aspect-auto lg:h-[60vh] bg-black flex items-center justify-center overflow-hidden">
                  {activeMedia ? (
                    activeMedia.kind === 'video' ? (
                      getYoutubeEmbedUrl(activeMedia.url) ? (
                        <iframe
                          src={getYoutubeEmbedUrl(activeMedia.url)!}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <video src={resolveMediaUrl(activeMedia.url)} className="h-full w-full object-contain" controls />
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => setLightboxOpen(true)}
                        className="h-full w-full cursor-zoom-in"
                        aria-label="Ver imagem em tela cheia"
                      >
                        <img
                          src={resolveMediaUrl(activeMedia.url)}
                          alt={selected.name}
                          className="h-full w-full object-contain"
                        />
                      </button>
                    )
                  ) : (
                    <Home className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>

                {selectMediaGallery.length > 1 && (
                  <div className="flex gap-1.5 p-3 overflow-x-auto">
                    {selectMediaGallery.map((m, idx) => (
                      <button
                        key={`${m.url}-${idx}`}
                        onClick={() => setGalleryIndex(idx)}
                        className={`h-14 w-14 rounded-md overflow-hidden border-2 shrink-0 ${idx === galleryIndex ? 'border-primary' : 'border-transparent'}`}
                      >
                        {m.kind === 'video' ? (
                          <div className="h-full w-full bg-muted flex items-center justify-center text-[10px]">vídeo</div>
                        ) : (
                          <img src={resolveMediaUrl(m.url)} alt="" className="h-full w-full object-cover" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {getCoordinates(selected) && (
                  <div className="p-3 pt-0">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> Localização
                    </p>
                    <div ref={detailMapContainerRef} className="h-56 w-full rounded-lg overflow-hidden border border-border" />
                  </div>
                )}
              </div>

              {/* Informações */}
              <div className="lg:h-full lg:overflow-y-auto">
                <div className="p-5 space-y-4 max-w-2xl mx-auto lg:mx-0">
                  <div>
                    {(selected.bairro || selected.cidade) && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {[selected.bairro, selected.cidade, selected.estado].filter(Boolean).join(', ')}
                      </p>
                    )}
                    <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(selected.price, selected.currency)}</p>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground border-y border-border py-3">
                    {selected.quartos != null && (
                      <span className="flex items-center gap-1.5">
                        <Bed className="h-4 w-4" /> {selected.quartos} quartos
                      </span>
                    )}
                    {selected.banheiros != null && (
                      <span className="flex items-center gap-1.5">
                        <Bath className="h-4 w-4" /> {selected.banheiros} banheiros
                      </span>
                    )}
                    {selected.vagas != null && (
                      <span className="flex items-center gap-1.5">
                        <Car className="h-4 w-4" /> {selected.vagas} vagas
                      </span>
                    )}
                  </div>

                  {selected.description && <p className="text-sm text-foreground">{selected.description}</p>}

                  {selected.vantagens && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Vantagens</p>
                      <p className="text-sm text-foreground whitespace-pre-line">{selected.vantagens}</p>
                    </div>
                  )}

                  {(selected.condominio || selected.iptu) && (
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {selected.condominio != null && <span>Condomínio: {formatCurrency(selected.condominio, selected.currency)}</span>}
                      {selected.iptu != null && <span>IPTU: {formatCurrency(selected.iptu, selected.currency)}</span>}
                    </div>
                  )}

                  {(selected.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(selected.tags ?? []).map((tag) => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Barra de contato fixa — fora das áreas com rolagem, então o botão
             de WhatsApp está sempre visível, sem precisar rolar a tela.
             Imóvel com contact_mode "formulario" abre o formulário antes de
             ir pro WhatsApp (ver handleSubmitLead); o padrão continua sendo
             o link direto. */}
          {whatsappLink && selected.contact_mode === 'formulario' ? (
            <div className="shrink-0 border-t border-border p-3 bg-background">
              <button
                type="button"
                onClick={() => setLeadFormOpen(true)}
                className="block w-full max-w-2xl mx-auto text-center h-12 leading-[48px] rounded-full bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
              >
                Falar sobre este imóvel
              </button>
            </div>
          ) : whatsappLink ? (
            <div className="shrink-0 border-t border-border p-3 bg-background">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full max-w-2xl mx-auto text-center h-12 leading-[48px] rounded-full bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
              >
                Falar sobre este imóvel
              </a>
            </div>
          ) : null}
        </div>
      )}

      {/* Formulário de contato — só quando o imóvel usa contact_mode
         "formulario". Ao enviar, cria o lead no kanban "Imobiliária" e só
         então abre o WhatsApp (o link continua funcionando mesmo se a
         criação do lead falhar — a experiência do visitante não pode travar
         nisso). */}
      {leadFormOpen && selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="relative w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Falar sobre este imóvel</h3>
              <button
                onClick={() => setLeadFormOpen(false)}
                className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitLead();
              }}
              className="p-4 space-y-3"
            >
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome *</label>
                <input
                  required
                  value={leadForm.name}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full h-10 rounded-md border border-border bg-muted/30 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">E-mail *</label>
                <input
                  required
                  type="email"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full h-10 rounded-md border border-border bg-muted/30 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">WhatsApp *</label>
                <input
                  required
                  placeholder="11 91234-1234"
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full h-10 rounded-md border border-border bg-muted/30 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Mensagem</label>
                <textarea
                  value={leadForm.message}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, message: e.target.value }))}
                  rows={2}
                  className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              </div>
              <button
                type="submit"
                disabled={submittingLead}
                className="w-full h-11 rounded-full bg-green-600 text-white font-medium hover:bg-green-700 transition-colors disabled:opacity-60"
              >
                {submittingLead ? 'Enviando...' : 'Enviar e abrir WhatsApp'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox — abre a foto atual em tela cheia, sem cortar (object-contain,
         diferente das miniaturas e da galeria principal, que usam object-cover/
         contain pra caber no espaço disponível). */}
      {lightboxOpen && selected && activeMedia && activeMedia.kind === 'image' && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>

          {selectMediaGallery.length > 1 && (
            <>
              <button
                onClick={() => setGalleryIndex((i) => (i - 1 + selectMediaGallery.length) % selectMediaGallery.length)}
                className="absolute left-2 sm:left-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                aria-label="Foto anterior"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={() => setGalleryIndex((i) => (i + 1) % selectMediaGallery.length)}
                className="absolute right-2 sm:right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                aria-label="Próxima foto"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <img
            src={resolveMediaUrl(activeMedia.url)}
            alt={selected.name}
            className="max-h-screen max-w-screen object-contain"
          />
        </div>
      )}

      {/* Map modal */}
      {mapOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeMap} />
          <div className="relative w-full max-w-4xl h-[80vh] bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
            <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-foreground text-sm">Imóveis no mapa</h3>
              <button onClick={closeMap} className="h-8 w-8 flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div ref={mapContainerRef} className="flex-1" />
          </div>
        </div>
      )}
    </div>
  );
};

export default RealEstatePage;
