import api from '../core/api';
import { extractData } from '../../utils/apiHelpers';

export interface MetaLeadForm {
  id: string;
  page_id: string;
  form_id: string;
  form_name: string | null;
  active: boolean;
  pipeline_id: string;
  pipeline_stage_id: string;
  pipeline_name: string | null;
  pipeline_stage_name: string | null;
  created_at: string;
}

export interface MetaLeadFormPayload {
  page_id: string;
  form_id: string;
  form_name?: string;
  pipeline_id: string;
  pipeline_stage_id: string;
  active?: boolean;
}

export interface MetaLeadSubmission {
  id: string;
  leadgen_id: string;
  page_id: string;
  form_id: string;
  ad_name: string | null;
  adset_name: string | null;
  campaign_name: string | null;
  status: 'unmapped_form' | 'processed' | 'error';
  error_message: string | null;
  field_data: Array<{ name: string; values: string[] }>;
  lead_created_time: string | null;
  created_at: string;
}

export const metaLeadFormsService = {
  async list(): Promise<MetaLeadForm[]> {
    const response = await api.get('/admin/meta_lead_forms');
    return extractData<MetaLeadForm[]>(response);
  },

  async create(payload: MetaLeadFormPayload): Promise<MetaLeadForm> {
    const response = await api.post('/admin/meta_lead_forms', payload);
    return extractData<MetaLeadForm>(response);
  },

  async update(id: string, payload: Partial<MetaLeadFormPayload>): Promise<MetaLeadForm> {
    const response = await api.patch(`/admin/meta_lead_forms/${id}`, payload);
    return extractData<MetaLeadForm>(response);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/admin/meta_lead_forms/${id}`);
  },

  async listSubmissions(status?: string): Promise<MetaLeadSubmission[]> {
    const response = await api.get('/admin/meta_lead_submissions', { params: status ? { status } : undefined });
    return extractData<MetaLeadSubmission[]>(response);
  },
};
