import { ConversionEvent, MensagemDestino } from '@/services/marketing/metaAdsManagerService';

// Regras de apoio ao formulário de conjunto, fora do componente (o eslint
// `react-refresh/only-export-components` exige que um .tsx de componente
// exporte só componentes — mesmo padrão de `audienceDetail.ts` e
// `audienceNaming.ts` ao lado do AudienceCreateDialog).

export interface AdAccountPageOption {
  id: string;
  name: string;
  hasInstagram: boolean;
}

export interface AdSetMetaValues {
  pageId: string;
  mensagemDestino: MensagemDestino;
  whatsappPhone: string;
  conversionLocation: string;
  conversionEvent: ConversionEvent;
}

export const emptyAdSetMeta = (): AdSetMetaValues => ({
  pageId: '',
  mensagemDestino: 'MESSENGER',
  whatsappPhone: '',
  conversionLocation: '',
  conversionEvent: 'PURCHASE',
});

// O que cada objetivo de conjunto aceita como destino é decidido pela Meta, não
// pelo app: mensagens vão pra conversa, conversão vai pro site/app, lead vai
// pro formulário dentro do anúncio. Mostrar o campo errado aqui é o que gera
// "Incompatibilidade entre criativo e objetivo" lá na Meta.
export type DestinoKind = 'mensagem' | 'conversao' | 'formulario' | 'nenhum';

export function destinoKindFor(optimizationGoal: string | undefined | null): DestinoKind {
  switch ((optimizationGoal || '').toUpperCase()) {
    case 'CONVERSATIONS':
    case 'MESSAGING':
      return 'mensagem';
    case 'LEAD_GENERATION':
    case 'LEADS':
      return 'formulario';
    case 'OFFSITE_CONVERSIONS':
    case 'ONLINE_CONVERSIONS':
    case 'APP_CONVERSIONS':
      return 'conversao';
    default:
      return 'nenhum';
  }
}

// Posições por plataforma: a Meta só aceita `facebook_positions` com
// `facebook` ligado em publisher_platforms, e vice-versa. Mandar posição de
// plataforma desligada é recusado com "Invalid parameter".
export const FACEBOOK_POSITIONS = [
  { value: 'feed', label: 'Feed' },
  { value: 'reels', label: 'Reels' },
  { value: 'stories', label: 'Stories' },
  { value: 'in_stream', label: 'Vídeo ao vivo' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'video_feeds', label: 'Feed de vídeo' },
  { value: 'search', label: 'Resultados de pesquisa' },
  { value: 'right_column', label: 'Coluna direita' },
];

export const INSTAGRAM_POSITIONS = [
  { value: 'feed', label: 'Feed' },
  { value: 'reels', label: 'Reels' },
  { value: 'stories', label: 'Stories' },
  { value: 'explore', label: 'Explorar' },
  { value: 'in_stream', label: 'Vídeo ao vivo' },
  { value: 'profile_feed', label: 'Perfil' },
];
