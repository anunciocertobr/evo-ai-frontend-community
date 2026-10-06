import type { LocationGroupPin } from '@/services/marketing/metaCreationService';

// Converte a localização de um targeting da Meta (público salvo, conjunto de
// anúncios) nos pinos de um Grupo de Localização. Pin+raio (custom_locations)
// já tem coordenada. Cidade vem só com o nome: é localizada pelo Nominatim, o
// mesmo serviço da busca do editor. Região e país não têm ponto no mapa, então
// ficam de fora e aparecem na lista de "não importados".

export interface ImportedLocations {
  pins: LocationGroupPin[];
  skipped: string[];
}

interface CoordLocation {
  latitude?: number;
  longitude?: number;
  radius?: number;
  distance_unit?: string;
}

interface NamedLocation {
  name?: string;
  region?: string;
  radius?: number;
  distance_unit?: string;
}

export interface TargetingLike {
  geo_locations?: {
    countries?: string[];
    regions?: NamedLocation[];
    cities?: NamedLocation[];
    places?: NamedLocation[];
    custom_locations?: CoordLocation[];
  };
  excluded_custom_locations?: CoordLocation[];
}

const DEFAULT_RADIUS_KM = 15;
const NOMINATIM_DELAY_MS = 1100; // o Nominatim pede no máximo 1 requisição por segundo

function toKm(radius?: number, unit?: string): number {
  const r = Number(radius) || DEFAULT_RADIUS_KM;
  return unit === 'mile' ? Math.round(r * 1.609 * 10) / 10 : r;
}

function coordPin(loc: CoordLocation, exclude: boolean): LocationGroupPin | null {
  if (typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') return null;
  return {
    name: `Ponto (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})`,
    lat: loc.latitude,
    lng: loc.longitude,
    radius: toKm(loc.radius, loc.distance_unit),
    ...(exclude ? { exclude: true } : {}),
  };
}

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=br`;
  const response = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
  const data = (await response.json()) as Array<{ lat: string; lon: string }>;
  if (!data[0]) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export async function pinsFromTargeting(
  targeting: TargetingLike | null | undefined,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportedLocations> {
  const pins: LocationGroupPin[] = [];
  const skipped: string[] = [];
  const geo = targeting?.geo_locations;

  (geo?.custom_locations || []).forEach((loc) => {
    const pin = coordPin(loc, false);
    if (pin) pins.push(pin);
  });
  (targeting?.excluded_custom_locations || []).forEach((loc) => {
    const pin = coordPin(loc, true);
    if (pin) pins.push(pin);
  });

  (geo?.regions || []).forEach((r) => skipped.push(`Região: ${r.name || '—'} (sem ponto no mapa)`));
  (geo?.countries || []).forEach((c) => skipped.push(`País: ${c} (sem ponto no mapa)`));

  const cities = [...(geo?.cities || []), ...(geo?.places || [])];
  for (let i = 0; i < cities.length; i++) {
    const city = cities[i];
    const label = [city.name, city.region].filter(Boolean).join(', ');
    onProgress?.(i, cities.length);
    try {
      const found = label ? await geocode(`${label}, Brasil`) : null;
      if (found) {
        pins.push({ name: label, lat: found.lat, lng: found.lng, radius: toKm(city.radius, city.distance_unit) });
      } else {
        skipped.push(`Cidade não localizada: ${label || '—'}`);
      }
    } catch {
      skipped.push(`Cidade não localizada: ${label || '—'}`);
    }
    if (i < cities.length - 1) await new Promise((resolve) => setTimeout(resolve, NOMINATIM_DELAY_MS));
  }
  onProgress?.(cities.length, cities.length);

  return { pins, skipped };
}
