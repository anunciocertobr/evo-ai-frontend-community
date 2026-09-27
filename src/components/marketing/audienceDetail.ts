import type { AudienceDetail } from '@/services/marketing/metaCreationService';

// Todos os tipos que a Meta aceita criar via API — o que o Ad Manager chama de
// "Custom audience" + "Lookalike". Antes o fluxo só cobria site/pixel, lista de
// clientes e semelhante; públicos de vídeo, engajamento de Página, Instagram e
// app caíam todos no fallback "Site (Pixel)" e travavam pedindo um pixel.

export type AudienceKind = 'site' | 'engagement' | 'instagram' | 'video' | 'app' | 'clientes' | 'lookalike' | 'salvo';

export interface ParsedDetail {
  kind: AudienceKind;
  retentionDays: number;
  urlContains: string;
  pixelId: string;
  videoId: string;
  pageId: string;
  igUserId: string;
  appId: string;
  engagementEvent: string;
  appEvent: string;
  originAudienceId: string;
  country: string;
  ratio: number;
  lookalikeType: 'similarity' | 'reach';
  note?: string;
}

// O teto de retenção NÃO é o mesmo pra todos os tipos: público de site/pixel
// vai até 180 dias na Graph API, enquanto engajamento, Instagram, app e vídeo
// vão até 365 (acima do limite, a Meta rejeita com erro genérico de parâmetro).
export const clampRetention = (days: number, maxDays = 365): number =>
  Math.min(maxDays, Math.max(1, Math.round(days) || 1));

// Extrai o ID numérico de um link de vídeo do Facebook/Instagram
// (facebook.com/reel/123, /watch/?v=123, .../videos/123) — colar o link é o
// jeito mais natural de o usuário informar o vídeo.
export const extractVideoId = (raw: string): string => {
  const value = raw.trim();
  if (/^\d+$/.test(value)) return value;
  const match = value.match(/(?:videos|reel|reels|watch)\/(\d+)/) || value.match(/[?&]v=(\d+)/);
  return match ? match[1] : '';
};

// Descobre o que o público de origem REALMENTE é a partir do que a Meta devolve
// na leitura. A leitura de custom audience NÃO expõe video_id, page_id,
// app_id nem ig_user_id (esses campos só existem na criação) — o que volta é a
// `rule` (event_sources + filtro de evento/URL), data_source*,
// video_group_ids, pixel_id, origin_audience_id e lookalike_spec. Sem isso, um
// público de vídeo era tratado como site e o formulário exigia um pixel sem
// relação nenhuma com o público, travando a criação da cópia.
export function parseAudienceDetail(detail: AudienceDetail): ParsedDetail {
  const out: ParsedDetail = {
    kind: 'site',
    retentionDays: detail.retention_days || 30,
    urlContains: '',
    pixelId: detail.pixel_id || '',
    videoId: '',
    pageId: '',
    igUserId: '',
    appId: '',
    engagementEvent: 'page_engaged',
    appEvent: 'any',
    originAudienceId: detail.origin_audience_id || '',
    country: detail.lookalike_spec?.country || 'BR',
    ratio: Math.round((detail.lookalike_spec?.ratio || 0.01) * 100),
    lookalikeType: detail.lookalike_spec?.type === 'reach' ? 'reach' : 'similarity',
  };

  if (detail.subtype === 'LOOKALIKE') {
    out.kind = 'lookalike';
    out.retentionDays = 30;
    return out;
  }
  if (detail.subtype === 'CUSTOM') {
    out.kind = 'clientes';
    return out;
  }

  // A rule vem como string JSON; o formato antigo de vídeo (object_id +
  // event_name) também aparece nos públicos criados no Ad Manager.
  let rule: Record<string, unknown> | null = null;
  try {
    const raw = typeof detail.rule === 'string' ? JSON.parse(detail.rule) : detail.rule;
    rule = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  } catch {
    rule = null;
  }

  const inclusions = (rule?.inclusions || {}) as { rules?: unknown[] };
  const rules = Array.isArray(inclusions.rules)
    ? inclusions.rules
    : Array.isArray(rule?.rules)
      ? (rule.rules as unknown[])
      : [];
  const first = (rules[0] || {}) as {
    event_sources?: Array<{ id?: string | number; type?: string }>;
    filter?: { filters?: Array<{ field?: string; value?: string }> };
    object_id?: string | number;
    event_name?: string;
    retention_seconds?: number;
  };

  const source = first.event_sources?.[0];
  const filters = first.filter?.filters || [];
  const urlFilter = filters.find((f) => f.field === 'url' && f.value);
  const eventFilter = filters.find((f) => f.field === 'event' && f.value);
  const sourceType = (source?.type || '').toLowerCase();
  const sourceId = String(source?.id ?? first.object_id ?? '');
  const event = (eventFilter?.value || first.event_name || '').toLowerCase();

  if (first.retention_seconds) {
    out.retentionDays = clampRetention(Math.round(first.retention_seconds / 86_400));
  }

  if (sourceType === 'pixel') {
    out.kind = 'site';
    out.urlContains = urlFilter?.value || '';
  } else if (sourceType === 'app') {
    out.kind = 'app';
    out.appId = sourceId;
    out.appEvent = event || 'any';
  } else if (sourceType === 'video' || event.startsWith('video')) {
    out.kind = 'video';
    out.videoId = sourceId;
    if (!sourceId) {
      out.note =
        'A Meta não devolve o ID do vídeo na leitura deste público. Cole o link ou o ID do vídeo abaixo para criar a cópia.';
    }
  } else if (sourceType === 'page' || sourceType === 'ig') {
    // No Instagram o event_source também é tipo 'page' (é o ig_user_id) — o
    // que distingue é o prefixo `ig_` no filtro de evento.
    if (event.startsWith('ig_')) {
      out.kind = 'instagram';
      out.igUserId = sourceId;
      out.engagementEvent = event || 'ig_business_profile_engaged';
    } else {
      out.kind = 'engagement';
      out.pageId = detail.facebook_page_id || sourceId;
      out.engagementEvent = event || 'page_engaged';
    }
  } else if (
    detail.subtype === 'VIDEO' ||
    (detail.video_group_ids || []).length > 0 ||
    (detail.data_source_types || []).some((t) => String(t).toUpperCase().includes('VIDEO'))
  ) {
    out.kind = 'video';
    out.note =
      'A Meta não devolve o ID do vídeo na leitura deste público. Cole o link ou o ID do vídeo abaixo para criar a cópia.';
  } else if (
    !sourceId &&
    ((detail.included_custom_audiences || []).length > 0 || (detail.excluded_custom_audiences || []).length > 0)
  ) {
    out.kind = 'salvo';
    out.note =
      'Este público combina outros públicos (é um público salvo de direcionamento). Para copiar esse tipo, use a aba Direcionamento.';
  }

  return out;
}
