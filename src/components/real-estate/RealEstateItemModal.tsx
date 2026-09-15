import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Badge,
} from '@evoapi/design-system';
import { Plus, PlayCircle, Search, Star, Upload, X } from 'lucide-react';
import type { Product, ProductFormData, ProductStatus, ProductCurrency, ProductMedia, ProductMediaKind } from '@/types/products';
import { productsService } from '@/services/products/productsService';

const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const VIDEO_RE = /^video\//i;
const DEFAULT_MAP_CENTER: [number, number] = [-14.235, -51.9253]; // Brasil

const resolveMediaUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('//') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
};

interface RealEstateFormState {
  name: string;
  description: string;
  default_price: number | null;
  currency: ProductCurrency;
  status: ProductStatus;
  tags: string;
  estado: string;
  cidade: string;
  bairro: string;
  endereco: string;
  numero: string;
  cep: string;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  suites: number | null;
  perto_metro: boolean;
  condominio: number | null;
  iptu: number | null;
  vantagens: string;
  latitude: number | null;
  longitude: number | null;
  contact_mode: 'whatsapp' | 'formulario';
}

function emptyForm(): RealEstateFormState {
  return {
    name: '',
    description: '',
    default_price: null,
    currency: 'BRL',
    status: 'active',
    tags: '',
    estado: '',
    cidade: '',
    bairro: '',
    endereco: '',
    numero: '',
    cep: '',
    quartos: null,
    banheiros: null,
    vagas: null,
    suites: null,
    perto_metro: false,
    condominio: null,
    iptu: null,
    vantagens: '',
    latitude: null,
    longitude: null,
    contact_mode: 'whatsapp',
  };
}

interface MediaItemProps {
  item: ProductMedia;
  isCover: boolean;
  onRemove: () => void;
  onSetCover: () => void;
}

function MediaItem({ item, isCover, onRemove, onSetCover }: MediaItemProps) {
  const url = resolveMediaUrl(item.url);
  return (
    <div className={`relative group border rounded-md overflow-hidden aspect-square ${isCover ? 'ring-2 ring-primary' : ''}`}>
      {item.kind === 'video' ? (
        <video src={url} className="w-full h-full object-cover" muted playsInline />
      ) : (
        <img src={url} alt={item.url} className="w-full h-full object-cover" />
      )}
      <span className="absolute top-1.5 left-1.5 flex gap-1">
        {item.kind === 'video' ? (
          <Badge variant="secondary" className="gap-1 text-[10px] px-1.5">
            <PlayCircle className="w-3 h-3" /> vídeo
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px] px-1.5">foto</Badge>
        )}
        {isCover && (
          <Badge className="gap-1 text-[10px] px-1.5">
            <Star className="w-3 h-3" /> capa
          </Badge>
        )}
      </span>
      {!isCover && (
        <button
          type="button"
          onClick={onSetCover}
          className="absolute bottom-1 left-1 rounded-full bg-black/50 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary"
          aria-label="Definir como capa"
          title="Definir como capa"
        >
          <Star className="w-3 h-3" />
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 rounded-full bg-black/50 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
        aria-label="Remover mídia"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

interface Props {
  open: boolean;
  item: Product | null;
  loading: boolean;
  errors: Record<string, string>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: ProductFormData) => void;
}

export default function RealEstateItemModal({ open, item, loading, errors, onOpenChange, onSubmit }: Props) {
  const [form, setForm] = useState<RealEstateFormState>(emptyForm());
  const [media, setMedia] = useState<ProductMedia[]>([]);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaKind, setMediaKind] = useState<ProductMediaKind>('image');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const mapPickerContainerRef = useRef<HTMLDivElement | null>(null);
  const mapPickerRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!open) return;
    const metadata = (item?.metadata ?? {}) as Record<string, unknown>;
    const asNumber = (v: unknown): number | null => (typeof v === 'number' ? v : v ? Number(v) : null);
    const asString = (v: unknown): string => (typeof v === 'string' ? v : v != null ? String(v) : '');

    setForm(
      item
        ? {
            name: item.name ?? '',
            description: item.description ?? '',
            default_price: item.default_price ?? null,
            currency: item.currency ?? 'BRL',
            status: item.status ?? 'active',
            tags: Array.isArray(metadata.tags) ? (metadata.tags as string[]).join(', ') : asString(metadata.tags),
            estado: asString(metadata.estado),
            cidade: asString(metadata.cidade),
            bairro: asString(metadata.bairro),
            endereco: asString(metadata.endereco),
            numero: asString(metadata.numero),
            cep: asString(metadata.cep),
            quartos: asNumber(metadata.quartos),
            banheiros: asNumber(metadata.banheiros),
            vagas: asNumber(metadata.vagas),
            suites: asNumber(metadata.suites),
            perto_metro: Boolean(metadata.perto_metro),
            condominio: asNumber(metadata.condominio),
            iptu: asNumber(metadata.iptu),
            vantagens: asString(metadata.vantagens),
            latitude: asNumber(metadata.latitude),
            longitude: asNumber(metadata.longitude),
            contact_mode: metadata.contact_mode === 'formulario' ? 'formulario' : 'whatsapp',
          }
        : emptyForm(),
    );
    setMedia(item?.media ?? []);
    setMediaUrl('');
    setMediaKind('image');
  }, [open, item]);

  const isEdit = useMemo(() => Boolean(item?.id), [item]);

  // Cria (ou move, se já existir) um marker arrastável em (lat, lng) e
  // atualiza o form — usado tanto pelo clique no mapa quanto pelo resultado
  // da busca por endereço, e pelo próprio drag do pino.
  const placeMarker = (map: L.Map, lat: number, lng: number) => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setForm((prev) => ({ ...prev, latitude: pos.lat, longitude: pos.lng }));
      });
      markerRef.current = marker;
    }
    setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
  };

  // Mapa pra escolher a localização do imóvel: nasce centrado nas
  // coordenadas já salvas (se houver) ou no Brasil inteiro; clicar nele (ou
  // arrastar o pino) atualiza latitude/longitude automaticamente. Só o
  // cleanup deste effect remove a instância — nunca um handler de clique/
  // drag (mesmo cuidado do mapa público, ver RealEstatePage.tsx: chamar
  // map.remove() fora do cleanup, no meio do dispatch de um evento do
  // próprio Leaflet, deixa o container "reused by another instance" da
  // próxima vez que o modal abrir).
  useEffect(() => {
    if (!open || !mapPickerContainerRef.current) return;

    const metadata = (item?.metadata ?? {}) as Record<string, unknown>;
    const asNumber = (v: unknown): number | null => (typeof v === 'number' ? v : v ? Number(v) : null);
    const initialLat = asNumber(metadata.latitude);
    const initialLng = asNumber(metadata.longitude);
    const hasInitialCoords = initialLat != null && initialLng != null;

    const map = L.map(mapPickerContainerRef.current).setView(
      hasInitialCoords ? [initialLat as number, initialLng as number] : DEFAULT_MAP_CENTER,
      hasInitialCoords ? 15 : 4,
    );
    mapPickerRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    if (hasInitialCoords) {
      const marker = L.marker([initialLat as number, initialLng as number], { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setForm((prev) => ({ ...prev, latitude: pos.lat, longitude: pos.lng }));
      });
      markerRef.current = marker;
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      placeMarker(map, e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => map.invalidateSize(), 50);

    return () => {
      map.remove();
      mapPickerRef.current = null;
      markerRef.current = null;
    };
  }, [open, item]);

  // Busca o endereço digitado no OpenStreetMap (Nominatim) e centraliza o
  // mapa + posiciona o pino lá — o admin ainda pode arrastar o pino ou
  // clicar no mapa pra ajustar o ponto exato depois.
  const handleGeocodeAddress = async () => {
    const query = [form.endereco, form.numero, form.bairro, form.cidade, form.estado, 'Brasil']
      .filter((part) => part && part.trim())
      .join(', ');
    if (!query) {
      toast.error('Preencha ao menos a cidade ou o endereço pra buscar no mapa');
      return;
    }

    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      );
      const results: Array<{ lat: string; lon: string }> = await res.json();
      if (!results.length) {
        toast.error('Endereço não encontrado. Clique no mapa pra marcar o local manualmente.');
        return;
      }
      const lat = Number(results[0].lat);
      const lng = Number(results[0].lon);
      const map = mapPickerRef.current;
      if (map) {
        map.setView([lat, lng], 16);
        placeMarker(map, lat, lng);
      } else {
        setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
      }
      toast.success('Endereço encontrado — arraste o pino se precisar ajustar');
    } catch (err) {
      console.error(err);
      toast.error('Falha ao buscar o endereço');
    } finally {
      setGeocoding(false);
    }
  };

  const handleMediaFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const res = await productsService.uploadMediaFile(file);
        const url = res.data?.file_url;
        if (url) {
          setMedia((prev) => [
            ...prev,
            { kind: VIDEO_RE.test(file.type) ? 'video' : 'image', source: 'upload', url },
          ]);
        }
      }
      toast.success('Mídia enviada com sucesso');
    } catch (err) {
      console.error(err);
      toast.error('Falha ao enviar mídia');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddMediaUrl = () => {
    const url = mediaUrl.trim();
    if (!url) {
      toast.error('Informe o link da mídia');
      return;
    }
    if (!/^https?:\/\/.+/i.test(url)) {
      toast.error('Link inválido. Use http:// ou https://');
      return;
    }
    const kind: ProductMediaKind =
      mediaKind === 'video' || /\.(mp4|webm|mov|m4v)$/i.test(url) ? 'video' : 'image';
    setMedia((prev) => [...prev, { kind, source: 'url', url }]);
    setMediaUrl('');
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error('Informe o nome do imóvel');
      return;
    }
    if (form.default_price == null) {
      toast.error('Informe o valor do imóvel');
      return;
    }

    const tags = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: ProductFormData = {
      name: form.name.trim(),
      kind: 'digital',
      item_type: 'imovel',
      description: form.description || undefined,
      default_price: form.default_price,
      currency: form.currency,
      status: form.status,
      media,
      metadata: {
        tags,
        estado: form.estado || null,
        cidade: form.cidade || null,
        bairro: form.bairro || null,
        endereco: form.endereco || null,
        numero: form.numero || null,
        cep: form.cep || null,
        quartos: form.quartos,
        banheiros: form.banheiros,
        vagas: form.vagas,
        suites: form.suites,
        perto_metro: form.perto_metro,
        condominio: form.condominio,
        iptu: form.iptu,
        vantagens: form.vantagens || null,
        latitude: form.latitude,
        longitude: form.longitude,
        contact_mode: form.contact_mode,
      },
    };

    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Imóvel' : 'Novo Imóvel'}</DialogTitle>
          <DialogDescription>
            Cadastre os dados do imóvel que vão aparecer no site público de imóveis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="re-name">Nome / Título</Label>
              <Input
                id="re-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Apartamento 3 quartos no Centro"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="re-description">Descrição</Label>
              <Textarea
                id="re-description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="re-price">Valor</Label>
              <Input
                id="re-price"
                type="number"
                min={0}
                step="0.01"
                value={form.default_price ?? ''}
                onChange={(e) => setForm({ ...form, default_price: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="re-currency">Moeda</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v as ProductCurrency })}>
                <SelectTrigger id="re-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="re-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ProductStatus })}>
                <SelectTrigger id="re-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo (visível no site)</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="re-contact-mode">Forma de contato</Label>
              <Select
                value={form.contact_mode}
                onValueChange={(v) => setForm({ ...form, contact_mode: v as 'whatsapp' | 'formulario' })}
              >
                <SelectTrigger id="re-contact-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp direto</SelectItem>
                  <SelectItem value="formulario">Formulário (o cliente preenche os dados antes de ir pro WhatsApp)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.contact_mode === 'formulario'
                  ? 'O botão do site abre um formulário; ao enviar, o lead entra no kanban "Imobiliária" e o cliente é redirecionado pro WhatsApp.'
                  : 'O botão do site abre o WhatsApp direto, sem formulário nem registro no CRM.'}
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="re-tags">Tags (separadas por vírgula)</Label>
              <Input
                id="re-tags"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="Ex.: Apartamento, Lançamento, Piscina"
              />
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-medium">Endereço</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="re-estado">Estado</Label>
                <Input id="re-estado" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="re-cidade">Cidade</Label>
                <Input id="re-cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="re-bairro">Bairro</Label>
                <Input id="re-bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="re-endereco">Endereço</Label>
                <Input id="re-endereco" value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="re-numero">Número</Label>
                <Input id="re-numero" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="re-cep">CEP</Label>
                <Input id="re-cep" value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Localização no mapa</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleGeocodeAddress} disabled={geocoding}>
                  <Search className="h-3.5 w-3.5 mr-1.5" />
                  {geocoding ? 'Buscando...' : 'Buscar endereço no mapa'}
                </Button>
              </div>
              <div ref={mapPickerContainerRef} className="h-56 w-full rounded-md overflow-hidden border" />
              <p className="text-xs text-muted-foreground">
                Clique no mapa (ou arraste o pino) pra ajustar o ponto exato — sem latitude/longitude o imóvel
                aparece na grade, mas não no mapa do site.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="re-lat">Latitude</Label>
                <Input
                  id="re-lat"
                  type="number"
                  step="any"
                  value={form.latitude ?? ''}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="re-lng">Longitude</Label>
                <Input
                  id="re-lng"
                  type="number"
                  step="any"
                  value={form.longitude ?? ''}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-medium">Detalhes</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="re-quartos">Quartos</Label>
                <Input
                  id="re-quartos"
                  type="number"
                  min={0}
                  value={form.quartos ?? ''}
                  onChange={(e) => setForm({ ...form, quartos: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="re-suites">Suítes</Label>
                <Input
                  id="re-suites"
                  type="number"
                  min={0}
                  value={form.suites ?? ''}
                  onChange={(e) => setForm({ ...form, suites: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="re-banheiros">Banheiros</Label>
                <Input
                  id="re-banheiros"
                  type="number"
                  min={0}
                  value={form.banheiros ?? ''}
                  onChange={(e) => setForm({ ...form, banheiros: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="re-vagas">Vagas</Label>
                <Input
                  id="re-vagas"
                  type="number"
                  min={0}
                  value={form.vagas ?? ''}
                  onChange={(e) => setForm({ ...form, vagas: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="re-condominio">Condomínio</Label>
                <Input
                  id="re-condominio"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.condominio ?? ''}
                  onChange={(e) => setForm({ ...form, condominio: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="re-iptu">IPTU</Label>
                <Input
                  id="re-iptu"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.iptu ?? ''}
                  onChange={(e) => setForm({ ...form, iptu: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  id="re-metro"
                  checked={form.perto_metro}
                  onCheckedChange={(v: boolean) => setForm({ ...form, perto_metro: v })}
                />
                <Label htmlFor="re-metro">Perto do metrô</Label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="re-vantagens">Vantagens</Label>
              <Textarea
                id="re-vantagens"
                rows={2}
                value={form.vantagens}
                onChange={(e) => setForm({ ...form, vantagens: e.target.value })}
                placeholder="Ex.: Academia, piscina, salão de festas..."
              />
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-medium">Fotos e vídeos</h3>
            {media.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground">
                  A primeira foto (marcada como "capa") é a imagem principal exibida na grade e ao abrir o imóvel no site.
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {media.map((m, idx) => (
                    <MediaItem
                      key={`${m.url}-${idx}`}
                      item={m}
                      isCover={idx === 0}
                      onRemove={() => setMedia((prev) => prev.filter((_, i) => i !== idx))}
                      onSetCover={() =>
                        setMedia((prev) => {
                          const copy = [...prev];
                          const [picked] = copy.splice(idx, 1);
                          return [picked, ...copy];
                        })
                      }
                    />
                  ))}
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => handleMediaFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Enviando...' : 'Subir arquivo'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Select value={mediaKind} onValueChange={(v) => setMediaKind(v as ProductMediaKind)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Foto</SelectItem>
                  <SelectItem value="video">Vídeo</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://..."
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddMediaUrl())}
              />
              <Button type="button" variant="outline" onClick={handleAddMediaUrl}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
