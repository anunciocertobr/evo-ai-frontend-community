// Cores/labels EXATOS do protótipo de referência (Melhorias CRM Chat §3.2) —
// não são as classes Tailwind genéricas usadas em outros lugares do CRM.
// Compartilhado entre ConversationStatusButton (botão de ação) e o pill de
// status no ChatHeader — a paleta precisa bater entre os dois.
export const STATUS_META: Record<string, { color: string; dark: string; label: string }> = {
  pending: { color: '#C77D14', dark: '#A9670F', label: 'Pendente' },
  open: { color: '#2563C9', dark: '#1E52A8', label: 'Atendimento em Aberto' },
  resolved: { color: '#359558', dark: '#2C834E', label: 'Atendimento concluído' },
  snoozed: { color: '#6B7280', dark: '#565C64', label: 'Conversa pausada' },
};

// Versões "pastel" da mesma paleta, para o pill de status (fundo claro +
// borda + texto na cor sólida do status). `pending` é pixel-exato ao
// protótipo; as demais foram derivadas mantendo a mesma relação de
// luminosidade (não são um alpha-blend limpo da cor sólida — o protótipo só
// especificou `pending` em RGB exato, então as outras são aproximação manual).
export const STATUS_META_LIGHT: Record<string, { bg: string; border: string; text: string }> = {
  pending: { bg: '#FDF3E3', border: '#E7B45C', text: '#C77D14' },
  open: { bg: '#E7EFFB', border: '#8CAEE0', text: '#2563C9' },
  resolved: { bg: '#E6F3EA', border: '#8FC5A2', text: '#359558' },
  snoozed: { bg: '#EEF0F2', border: '#B8BFC7', text: '#6B7280' },
};
