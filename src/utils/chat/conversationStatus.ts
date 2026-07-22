/**
 * Utilitário para traduzir e formatar status de conversas
 */

export type ConversationStatus = 'open' | 'resolved' | 'pending' | 'snoozed';

export interface StatusConfig {
  label: string;
  description: string;
  color: string;
  bgColor: string;
}

// Assinatura solta (não `(key, fallback?) => string`) porque o `t` retornado por
// useTranslation/useLanguage é tipado como TFunction do i18next (overloads com
// tipo de retorno genérico `string | object` conforme os options), incompatível
// estruturalmente com uma assinatura estrita de 2 string args / retorno string.
type Translate = (...args: any[]) => any;

// Fallback PT-BR hardcoded para chamadores que não têm acesso ao hook de i18n
// (ex.: fora de componentes React). Passar `t` do useLanguage('chat') sempre
// que possível para respeitar o idioma ativo do usuário.
const FALLBACK_LABELS: Record<string, string> = {
  open: 'Aberta',
  resolved: 'Concluída',
  pending: 'Pendente',
  snoozed: 'Pausada',
};

/**
 * Traduz o status da conversa
 */
export const getStatusLabel = (status: string, t?: Translate): string => {
  if (t) {
    return t(`contexts.conversations.statusNames.${status}`, FALLBACK_LABELS[status] || 'Desconhecido');
  }

  return FALLBACK_LABELS[status] || 'Desconhecido';
};

/**
 * Retorna configuração completa do status (label, cores, etc.)
 *
 * Cores seguem o fluxo operacional: pending=âmbar (precisa agir) →
 * open=azul (em atendimento) → resolved=verde (concluído) e
 * snoozed=cinza (pausado, neutro).
 */
export const getStatusConfig = (status: string, t?: Translate): StatusConfig => {
  const configs: Record<string, StatusConfig> = {
    open: {
      label: getStatusLabel('open', t),
      description: t
        ? t('conversationStatusIcon.open.description', 'Conversa ativa e em andamento')
        : 'Conversa ativa e em andamento',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    pending: {
      label: getStatusLabel('pending', t),
      description: t
        ? t('conversationStatusIcon.pending.description', 'Aguardando resposta do cliente')
        : 'Aguardando resposta do cliente',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    resolved: {
      label: getStatusLabel('resolved', t),
      description: t
        ? t('conversationStatusIcon.resolved.description', 'Conversa finalizada com sucesso')
        : 'Conversa finalizada com sucesso',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    snoozed: {
      label: getStatusLabel('snoozed', t),
      description: t
        ? t('conversationStatusIcon.snoozed.description', 'Conversa temporariamente pausada')
        : 'Conversa temporariamente pausada',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
    },
  };

  return (
    configs[status] || {
      label: t ? t('conversationStatusIcon.unknown.label', 'Desconhecido') : 'Desconhecido',
      description: t
        ? t('conversationStatusIcon.unknown.description', 'Status não identificado')
        : 'Status não identificado',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
    }
  );
};

/**
 * Verifica se o status indica que a conversa está ativa
 */
export const isActiveStatus = (status: string): boolean => {
  return status === 'open';
};

/**
 * Verifica se o status indica que a conversa está pendente
 */
export const isPendingStatus = (status: string): boolean => {
  return status === 'pending';
};
