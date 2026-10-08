// Contrato do "rascunho" que o Assistente de Criação Meta (agente dedicado,
// ver MetaCreationAiButton.tsx) devolve dentro de um bloco cercado
// ```evo-meta-draft na resposta do chat.
//
// A IA NUNCA cria nada direto na Meta — esse bloco só diz pro CRM qual tela
// abrir e com quais campos já preenchidos. Quem revisa e aperta
// "Criar"/"Salvar" de verdade é sempre o usuário, através dos mesmos
// diálogos/formulários já existentes (AudienceCreateDialog, TargetingBuilder,
// LocationGroupsTab) — nada aqui chama a Graph API.

export type AiAudienceKind = 'site' | 'engagement' | 'instagram' | 'app' | 'video' | 'clientes' | 'lookalike';

export interface AiAudienceDraft {
  kind: 'audience';
  data: {
    audienceKind: AiAudienceKind;
    name?: string;
    description?: string;
    retentionDays?: number;
    urlContains?: string;
  };
}

export interface AiTargetingItemDraft {
  category: 'interests' | 'behaviors' | 'demographics';
  id: string;
  name: string;
}

export interface AiTargetingListDraft {
  kind: 'targeting_list';
  data: {
    name?: string;
    include?: AiTargetingItemDraft[];
    narrow?: AiTargetingItemDraft[];
    exclude?: AiTargetingItemDraft[];
    ageMin?: number;
    ageMax?: number;
    genders?: Array<'male' | 'female'>;
  };
}

export interface AiLocationGroupDraft {
  kind: 'location_group';
  data: {
    name?: string;
    places?: Array<{ query: string; radiusKm?: number }>;
  };
}

export type AiMetaDraft = AiAudienceDraft | AiTargetingListDraft | AiLocationGroupDraft;

const DRAFT_KINDS = new Set(['audience', 'targeting_list', 'location_group']);

// Extrai o ÚLTIMO bloco ```evo-meta-draft ... ``` de um texto de mensagem do
// chat (a IA pode "pensar em voz alta" antes) e valida o formato mínimo
// antes de devolver — qualquer coisa fora do esperado vira null, nunca lança.
export function extractMetaDraft(text: string): AiMetaDraft | null {
  if (!text) return null;
  const regex = /```evo-meta-draft\s*([\s\S]*?)```/g;
  const matches = text.matchAll(regex);
  let last: string | null = null;
  for (const match of matches) {
    last = match[1];
  }
  if (!last) return null;
  try {
    const parsed = JSON.parse(last.trim());
    if (!parsed || typeof parsed !== 'object') return null;
    if (!DRAFT_KINDS.has(parsed.kind)) return null;
    if (!parsed.data || typeof parsed.data !== 'object') return null;
    return parsed as AiMetaDraft;
  } catch {
    return null;
  }
}

// Geocodifica um nome de lugar (ex: "Curitiba, PR") via Nominatim — mesma
// API sem chave já usada pelo LocationMapPicker. A IA só descreve o lugar
// por nome (nunca inventa lat/lng); quem resolve a coordenada é o CRM.
export async function geocodePlace(
  query: string,
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=1&countrycodes=BR`;
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
    if (!res.ok) return null;
    const results = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
    const first = results[0];
    if (!first) return null;
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, displayName: first.display_name };
  } catch {
    return null;
  }
}

// Forma mínima de LocationEntry que este arquivo precisa — evita importar o
// componente LocationMapPicker.tsx só pelo tipo (import type não cria
// dependência em runtime, mas mantém este util livre de um import cruzado
// com a camada de componentes).
export interface GeocodedLocationEntry {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
}

// Geocodifica todos os lugares de um rascunho de grupo de localização de
// uma vez, descartando os que não foram encontrados — usado tanto pela
// página (abre um grupo novo) quanto pelo editor de grupo já aberto
// (soma aos locais que o usuário já tinha escolhido).
export async function resolveLocationDraftPlaces(
  places: Array<{ query: string; radiusKm?: number }>,
): Promise<GeocodedLocationEntry[]> {
  const resolved = await Promise.all(
    places.map(async (place): Promise<GeocodedLocationEntry | null> => {
      const geo = await geocodePlace(place.query);
      if (!geo) return null;
      return {
        id: `ai-${Math.random().toString(36).slice(2)}`,
        name: geo.displayName.split(',')[0]?.trim() || place.query,
        lat: geo.lat,
        lng: geo.lng,
        radius: place.radiusKm ?? 10,
      };
    }),
  );
  return resolved.filter((entry): entry is GeocodedLocationEntry => entry !== null);
}
