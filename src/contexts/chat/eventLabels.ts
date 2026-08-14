import type { ConversationEventLabel } from '@/services/chat/websocket/ChatActionCableConnector';
import type { Label } from '@/types/settings/labels';

/**
 * Monta as etiquetas de um evento de conversa (CRM-155).
 *
 * `labels_data` traz id/título/cor e é a fonte preferida. `labels` continua
 * sendo lista de títulos (contrato dos webhooks externos) e sobra como fallback
 * para backend anterior ao CRM-155 — sem cor, o que faz o merge do ChatContext
 * preservar as etiquetas que já estavam na tela em vez de apagá-las.
 *
 * `createdAt`/`updatedAt` aceitam número porque o backend manda os timestamps
 * do evento como epoch (`push_timestamps`), não como string ISO.
 */
export function mapEventLabels(
  labelsData: ConversationEventLabel[] | undefined,
  labels: unknown,
  createdAt: string | number,
  updatedAt: string | number
): Label[] {
  if (labelsData) {
    return labelsData.map((label) => ({
      id: String(label.id),
      title: String(label.title ?? ''),
      description: '',
      color: String(label.color ?? ''),
      show_on_sidebar: false,
      created_at: String(createdAt),
      updated_at: String(updatedAt),
    }));
  }

  if (!Array.isArray(labels)) return [];

  return labels.map((label: string | Record<string, unknown>) => {
    if (typeof label === 'string') {
      return {
        id: label,
        title: label,
        description: '',
        color: '',
        show_on_sidebar: false,
        created_at: String(createdAt),
        updated_at: String(updatedAt),
      };
    }
    return {
      id: String(label.id),
      title: String(label.title || ''),
      description: String(label.description || ''),
      color: String(label.color || ''),
      show_on_sidebar: Boolean(label.show_on_sidebar),
      created_at: String(label.created_at || createdAt),
      updated_at: String(label.updated_at || updatedAt),
    };
  });
}
