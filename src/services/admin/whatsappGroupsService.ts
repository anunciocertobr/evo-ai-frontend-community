import api from '../core/api';
import { extractData } from '../../utils/apiHelpers';

export interface WhatsappGroup {
  jid: string;
  name: string;
}

export const whatsappGroupsService = {
  async list(inboxId: string): Promise<WhatsappGroup[]> {
    if (!inboxId) return [];
    const response = await api.get('/admin/whatsapp_groups', { params: { inbox_id: inboxId } });
    return extractData<WhatsappGroup[]>(response);
  },
};
