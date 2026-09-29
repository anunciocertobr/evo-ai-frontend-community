import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';
import { Button, Input, Label } from '@evoapi/design-system';
import { Loader2, Plus, X } from 'lucide-react';

// Extraído de TrafficPanelPage.tsx (Painel de Tráfego) pra ser reaproveitado
// também pelos "Grupos de Localização" (Criação Meta) — os dois precisam do
// mesmo mapa/busca/lista de pin+raio, só que o grupo de localização não tem
// o conceito de "excluir lugares" (isso só existe pra segmentação de um
// conjunto de anúncios), daí o `singleListMode`.

export interface LocationEntry {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

// Mapa interativo (pin arrastável + raio) via Leaflet — mesma lib e mesmo
// padrão de integração com React (ref callback em vez de useRef+useEffect,
// necessário porque o mapa vive dentro de um Dialog do Radix, que monta/
// desmonta o conteúdo de verdade a cada abertura) já usado em
// RealEstateItemModal.tsx. Busca de endereço via Nominatim (OpenStreetMap),
// mesma API sem chave que o painel legado usava.
export function LocationMapPicker({
  locations,
  onChange,
  excludedLocations,
  onExcludedChange,
  singleListMode = false,
}: {
  locations: LocationEntry[];
  onChange: (locations: LocationEntry[]) => void;
  // Localizações de exclusão só existem no modo padrão (segmentação de
  // conjunto de anúncios) — em singleListMode (Grupos de Localização) são
  // opcionais e ignoradas, já que um grupo é só uma lista de lugares.
  excludedLocations?: LocationEntry[];
  onExcludedChange?: (locations: LocationEntry[]) => void;
  singleListMode?: boolean;
}) {
  const excluded = excludedLocations ?? [];
  const setExcluded = onExcludedChange ?? (() => {});

  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const extraLayersRef = useRef<L.Layer[]>([]);
  // A exclusão entra no mesmo mapa/pin da inclusão, então o desenho das
  // camadas extras lê as DUAS listas daqui.
  const locationsRef = useRef(locations);
  const excludedRef = useRef(excluded);
  locationsRef.current = locations;
  excludedRef.current = excluded;

  // Inclusão (verde) ou exclusão (vermelho) — o resto do componente opera na
  // lista do modo ativo. Em singleListMode fica sempre em INCLUIR (o toggle
  // nem aparece).
  const [mode, setMode] = useState<'INCLUIR' | 'EXCLUIR'>('INCLUIR');
  const modoEfetivo = singleListMode ? 'INCLUIR' : mode;
  const listaAtual = modoEfetivo === 'INCLUIR' ? locations : excluded;
  const setListaAtual = modoEfetivo === 'INCLUIR' ? onChange : setExcluded;

  const [pin, setPin] = useState({ name: 'São Paulo', lat: -23.5505, lng: -46.6333, radius: 15 });
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);

  const placePin = (map: L.Map, lat: number, lng: number, radius: number) => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setPin((prev) => ({ ...prev, lat: pos.lat, lng: pos.lng, name: 'Localização Personalizada (Arrastada)' }));
      });
      markerRef.current = marker;
    }
    if (circleRef.current) map.removeLayer(circleRef.current);
    circleRef.current = L.circle([lat, lng], { radius: radius * 1000, color: '#fbbf24', fillColor: '#fbbf24', fillOpacity: 0.1, weight: 2 }).addTo(map);
  };

  const redrawExtras = (map: L.Map) => {
    extraLayersRef.current.forEach((layer) => map.removeLayer(layer));
    extraLayersRef.current = [];
    const desenha = (lista: LocationEntry[], cor: string, prefixo: string) =>
      lista.forEach((loc) => {
        const marker = L.marker([loc.lat, loc.lng], { opacity: 0.6, title: `${prefixo}${loc.name} (${loc.radius}km)` }).addTo(map);
        const circle = L.circle([loc.lat, loc.lng], { radius: loc.radius * 1000, color: cor, fillColor: cor, fillOpacity: 0.08, weight: 1.5 }).addTo(map);
        extraLayersRef.current.push(marker, circle);
      });
    desenha(locationsRef.current, '#10b981', '');
    if (!singleListMode) desenha(excludedRef.current, '#ef4444', 'EXCLUIR: ');
  };

  // Ref callback (não useRef+useEffect) — o Dialog do Radix só monta este
  // <div> de verdade quando abre, então é aqui (container != null) que o
  // mapa precisa nascer; a limpeza (container === null) roda no fechamento.
  const initMap = useCallback((container: HTMLDivElement | null) => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    }
    if (!container) return;

    const map = L.map(container).setView([pin.lat, pin.lng], 10);
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);

    placePin(map, pin.lat, pin.lng, pin.radius);
    redrawExtras(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      setPin((prev) => ({ ...prev, lat: e.latlng.lat, lng: e.latlng.lng, name: 'Localização Personalizada (Clique)' }));
    });

    setTimeout(() => map.invalidateSize(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapRef.current) placePin(mapRef.current, pin.lat, pin.lng, pin.radius);
  }, [pin.lat, pin.lng, pin.radius]);

  useEffect(() => {
    if (mapRef.current) redrawExtras(mapRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, excluded]);

  useEffect(() => {
    if (searchQuery.trim().length < 3) {
      setSuggestions([]);
      return undefined;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5&countrycodes=BR`;
        const response = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
        const data = (await response.json()) as NominatimResult[];
        setSuggestions(data);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Clicar na sugestão já ADICIONA na lista do modo ativo (antes só movia o
  // pin e exigia o clique em "Adicionar", o que fazia a segunda cidade ser
  // improdutiva). O pin continua sendo a última adicionada pra ajustar o raio.
  const selectSuggestion = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const displayName = result.display_name.split(',').slice(0, 3).map((s) => s.trim()).join(', ');
    const entry: LocationEntry = { id: crypto.randomUUID(), name: displayName, lat, lng, radius: pin.radius };
    if (listaAtual.some((loc) => loc.name === displayName)) {
      toast.error('Esta localização já está na lista.');
    } else {
      setListaAtual([...listaAtual, entry]);
    }
    setPin({ name: displayName, lat, lng, radius: pin.radius });
    setSearchQuery('');
    setSuggestions([]);
  };

  const addLocation = () => {
    if (!(pin.radius > 0)) {
      toast.error('Informe um raio maior que 0.');
      return;
    }
    if (listaAtual.some((loc) => loc.name === pin.name)) {
      toast.error('Esta localização já está na lista.');
      return;
    }
    setListaAtual([...listaAtual, { id: crypto.randomUUID(), name: pin.name, lat: pin.lat, lng: pin.lng, radius: pin.radius }]);
  };

  const removeLocation = (id: string) => setListaAtual(listaAtual.filter((loc) => loc.id !== id));

  // Clicar numa localização da lista carrega ela no pin pra mexer só no raio,
  // sem precisar desarrastar o marcador no mapa.
  const editarRaio = (loc: LocationEntry) => setPin({ name: loc.name, lat: loc.lat, lng: loc.lng, radius: loc.radius });

  return (
    <div className="space-y-3">
      {!singleListMode && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('INCLUIR')}
            className={`flex-1 text-xs px-3 py-1.5 rounded-md border ${
              mode === 'INCLUIR' ? 'bg-emerald-900/40 border-emerald-600 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            Anunciar Nestes Lugares ({locations.length})
          </button>
          <button
            type="button"
            onClick={() => setMode('EXCLUIR')}
            className={`flex-1 text-xs px-3 py-1.5 rounded-md border ${
              mode === 'EXCLUIR' ? 'bg-red-900/40 border-red-600 text-red-300' : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            Excluir Lugares ({excluded.length})
          </button>
        </div>
      )}
      {modoEfetivo === 'EXCLUIR' && (
        <p className="text-xs text-slate-500">
          Lugares de exclusão não recebem anúncio: a Meta retira quem mora ou esteve aí da veiculação.
        </p>
      )}
      <div className="relative">
        <Input
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          placeholder="Buscar cidade, CEP ou endereço..."
          className="bg-slate-700 border-slate-600 text-slate-200"
        />
        {suggestions.length > 0 && (
          <div className="absolute w-full z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
            {suggestions.map((s, i) => (
              <div
                key={i}
                onClick={() => selectSuggestion(s)}
                className="p-3 cursor-pointer hover:bg-sky-700/50 transition-colors text-sm border-b border-slate-700 last:border-b-0 truncate text-slate-200"
              >
                {s.display_name}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label className="text-xs text-slate-400">Raio de Cobertura (km)</Label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={80}
            step={1}
            value={pin.radius}
            onChange={(e) => setPin((prev) => ({ ...prev, radius: parseInt(e.target.value, 10) }))}
            className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm text-sky-400 font-semibold w-14 text-right">{pin.radius} km</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Input value={pin.name} readOnly className="bg-slate-700 text-slate-400 border-slate-600 text-sm flex-grow" />
        <Button type="button" onClick={addLocation} size="sm" className="shrink-0">
          <Plus className="w-3.5 h-3.5 mr-1" /> {modoEfetivo === 'INCLUIR' ? 'Adicionar' : 'Excluir'}
        </Button>
      </div>

      <div className="space-y-2 max-h-32 overflow-y-auto border border-slate-700 p-2 rounded-lg bg-slate-900/50">
        {listaAtual.length === 0 ? (
          <p className="text-xs text-slate-500 italic text-center">
            {modoEfetivo === 'INCLUIR' ? 'Nenhuma localização adicionada.' : 'Nenhuma localização excluída.'}
          </p>
        ) : (
          listaAtual.map((loc) => (
            <div
              key={loc.id}
              className="flex items-center justify-between p-2 text-sm bg-slate-700/70 rounded-md border border-slate-600"
            >
              <button type="button" onClick={() => editarRaio(loc)} className="truncate pr-2 text-left flex-1" title="Ajustar o raio">
                <span className={modoEfetivo === 'INCLUIR' ? 'font-semibold text-sky-300' : 'font-semibold text-red-300'}>
                  {modoEfetivo === 'EXCLUIR' && 'Não anunciar: '}
                  {loc.name}
                </span>{' '}
                <span className="text-xs text-slate-400">({loc.radius} km)</span>
              </button>
              <button
                type="button"
                onClick={() => removeLocation(loc.id)}
                className="text-red-400 hover:text-red-300 p-1 shrink-0"
                title="Remover localização"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {searching && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}

      <div ref={initMap} className="w-full h-56 bg-slate-700 rounded-lg border border-slate-600 shadow-inner" />
    </div>
  );
}
