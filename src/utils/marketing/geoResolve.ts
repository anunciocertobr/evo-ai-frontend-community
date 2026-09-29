import type { LocationEntry } from '@/components/marketing/LocationMapPicker';

// Extraído de TrafficPanelPage.tsx ("Duplicar campanha") pra ser reaproveitado
// também por "Importar de públicos salvos" (Grupos de Localização) — os dois
// precisam resolver a MESMA forma crua de geo_locations da Graph API
// (cities/places sem coordenada, custom_locations com lat/lng) em
// LocationEntry[] pro mapa, geocodificando via Nominatim o que só tem nome.

// Cache simples (por sessão) pra não repetir a mesma consulta ao Nominatim
// quando várias origens (conjuntos duplicados, públicos salvos) miram a
// mesma cidade.
const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

export async function geocodeCityName(query: string): Promise<{ lat: number; lng: number } | null> {
  if (geocodeCache.has(query)) return geocodeCache.get(query) ?? null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=BR`;
    const response = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
    const data = (await response.json()) as Array<{ lat: string; lon: string }>;
    const first = data[0];
    const result = first ? { lat: parseFloat(first.lat), lng: parseFloat(first.lon) } : null;
    geocodeCache.set(query, result);
    return result;
  } catch {
    geocodeCache.set(query, null);
    return null;
  }
}

// Uma cidade/bairro REAL (direcionamento por nome, sem pin+raio desenhado no
// mapa) chega da Graph API sem lat/lng — sem isso, entradas assim eram
// descartadas em silêncio (sumiam do mapa sem explicação). Geocodifica via
// Nominatim; o que não for encontrado entra em `unresolved` pra avisar quem
// chamou, em vez de sumir sem aviso.
export async function pinsFromOrigin(
  entries: Array<{ name?: string; region?: string; country?: string; lat?: number; lng?: number; radius?: number }> | undefined,
  unresolved: string[],
): Promise<LocationEntry[]> {
  const resolved = await Promise.all(
    (entries || []).map(async (e): Promise<LocationEntry | null> => {
      if (typeof e.lat === 'number' && typeof e.lng === 'number') {
        return { id: crypto.randomUUID(), name: e.name || `${e.lat}, ${e.lng}`, lat: e.lat, lng: e.lng, radius: e.radius || 15 };
      }
      if (!e.name) return null;
      const query = [e.name, e.region, e.country || 'Brasil'].filter(Boolean).join(', ');
      const coords = await geocodeCityName(query);
      if (!coords) {
        unresolved.push(e.name);
        return null;
      }
      return { id: crypto.randomUUID(), name: e.name, lat: coords.lat, lng: coords.lng, radius: e.radius || 15 };
    }),
  );
  return resolved.filter((e): e is LocationEntry => e !== null);
}
