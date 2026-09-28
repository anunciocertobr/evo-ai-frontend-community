import { ConversionEvent, MensagemDestino, ObjectiveKey, OBJECTIVE_BY_KEY } from '@/services/marketing/metaAdsManagerService';

// Regras de apoio ao formulário de conjunto, fora do componente (o eslint
// `react-refresh/only-export-components` exige que um .tsx de componente
// exporte só componentes — mesmo padrão de `audienceDetail.ts` e
// `audienceNaming.ts` ao lado do AudienceCreateDialog).

export interface AdAccountPageOption {
  id: string;
  name: string;
  hasInstagram: boolean;
}

// Onde o lead da campanha é capturado. "Conversa" e "Conversão" não podem
// coexistir no mesmo conjunto: a Meta aceita UMA meta de desempenho por
// conjunto, e é por isso que a tela deixa só uma das duas marcada.
export type ConversaoTipo = 'NENHUMA' | 'FORMULARIO' | 'WHATSAPP' | 'SITE';

export interface AdSetMetaValues {
  pageId: string;
  // Destino da conversa, quando a meta de desempenho é "conversa".
  mensagemDestino: MensagemDestino;
  whatsappPhone: string;
  conversaoTipo: ConversaoTipo;
  conversionLocation: string;
  conversionEvent: ConversionEvent;
}

export const emptyAdSetMeta = (): AdSetMetaValues => ({
  pageId: '',
  mensagemDestino: 'WHATSAPP',
  whatsappPhone: '',
  conversaoTipo: 'NENHUMA',
  conversionLocation: '',
  conversionEvent: 'PURCHASE',
});

// Texto que explica a seção "onde a conversa acontece" — o usuário perguntou
// justamente pelo significado desse bloco.
export const CONVERSA_DESCRICAO =
  'A conversa acontece DEPOIS que a pessoa clica no anúncio: o Messenger, o WhatsApp ou o Direct do Instagram ' +
  'abrem como canal de atendimento. Escolher aqui troca o destino do anúncio E do conjunto ao mesmo tempo — ' +
  'deixar o criativo apontando pra um destino e o conjunto pro outro é o que a Meta chama de "incompatibilidade ' +
  'entre criativo e objetivo".';

export const CONVERSAO_DESCRICAO =
  'É aqui que o lead é registrado. Um conjunto registra em UM lugar só: formulário dentro do anúncio, conversa no ' +
  'WhatsApp ou conversão no site (pixel).';

// Metas de desempenho liberadas para o objetivo da campanha, com o rótulo que
// o painel mostra. Vem da lista validada objetivo a objetivo na conta real —
// escolher uma meta que o objetivo da campanha não aceita é recusado pela Meta
// com o subcode 2490408.
export function goalsForObjective(objectiveKey: ObjectiveKey | '' | null | undefined) {
  return (objectiveKey ? OBJECTIVE_BY_KEY[objectiveKey] : undefined)?.goals ?? [];
}

export function goalIsValid(objectiveKey: ObjectiveKey | '' | null | undefined, goal: string | undefined | null): boolean {
  if (!goal) return false;
  return goalsForObjective(objectiveKey).some((g) => g.value === goal);
}

export function goalLabelFor(objectiveKey: ObjectiveKey | '' | null | undefined, goal: string | undefined | null): string {
  const found = goalsForObjective(objectiveKey).find((g) => g.value === goal);
  return found?.label ?? goal ?? '';
}

// A meta de desempenho do conjunto é sempre derivada do objetivo DA CAMPANHA
// mais a escolha feita no próprio conjunto. Meta só aceita um `optimization_goal`
// por conjunto, então a conversa e a conversão são mutuamente exclusivas e a
// conversa tem prioridade quando as duas estiverem marcadas.
export function optimizationGoalFor(objectiveKey: ObjectiveKey | '' | null | undefined, values: AdSetMetaValues): string {
  const goals = goalsForObjective(objectiveKey);
  // A conversão tem precedência porque marcar lá já zera a conversa (os dois
  // campos são mutuamente exclusivos — ver AdSetMetaFields).
  if (values.conversaoTipo === 'FORMULARIO') {
    return goals.find((g) => g.value === 'LEAD_GENERATION')?.value ?? goals[0]?.value ?? '';
  }
  if (values.conversaoTipo === 'SITE') {
    return goals.find((g) => g.value === 'OFFSITE_CONVERSIONS')?.value ?? goals[0]?.value ?? '';
  }
  if (values.conversaoTipo === 'WHATSAPP') {
    return goals.find((g) => g.value === 'CONVERSATIONS')?.value ?? goals[0]?.value ?? '';
  }
  const conversa = goals.find((g) => g.value === 'CONVERSATIONS')?.value;
  return conversa ?? goals[0]?.value ?? '';
}

// Meta de desempenho que o conjunto vai ter — usado tanto no formulário
// (mostrar o que será enviado) quanto na validação.
export function pendingWhatsappValidation(values: AdSetMetaValues, optimizationGoal: string): boolean {
  return optimizationGoal === 'CONVERSATIONS' && values.mensagemDestino === 'WHATSAPP' && !values.whatsappPhone.trim();
}

// A conversa só pode ser o destino do conjunto quando o objetivo da campanha
// tem a meta "Conversas" na lista — nos outros (reconhecimento, app) a Meta
// recusa o `destination_type`.
export function conversaDisponivel(objectiveKey: ObjectiveKey | '' | null | undefined): boolean {
  return goalsForObjective(objectiveKey).some((g) => g.value === 'CONVERSATIONS');
}

export function conversaoDisponivel(objectiveKey: ObjectiveKey | '' | null | undefined): boolean {
  return goalsForObjective(objectiveKey).some((g) => g.value === 'LEAD_GENERATION' || g.value === 'OFFSITE_CONVERSIONS');
}

// Opções de "onde acontecem as conversões" que o objetivo atual aceita.
export function conversaoTiposFor(objectiveKey: ObjectiveKey | '' | null | undefined): Array<{ value: ConversaoTipo; label: string; hint: string }> {
  const goals = goalsForObjective(objectiveKey).map((g) => g.value);
  const opcoes: Array<{ value: ConversaoTipo; label: string; hint: string }> = [
    { value: 'NENHUMA', label: 'Nenhuma', hint: 'O conjunto não registra lead' },
  ];
  if (goals.includes('LEAD_GENERATION')) {
    opcoes.push({
      value: 'FORMULARIO',
      label: 'Formulário',
      hint: 'Formulário abre dentro do próprio anúncio, sem sair do Facebook',
    });
  }
  if (goals.includes('CONVERSATIONS')) {
    opcoes.push({ value: 'WHATSAPP', label: 'WhatsApp', hint: 'A conversa acontece no número escolhido' });
  }
  if (goals.includes('OFFSITE_CONVERSIONS')) {
    opcoes.push({ value: 'SITE', label: 'Site ou App', hint: 'Metaixa o evento do pixel no site/app' });
  }
  return opcoes;
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
