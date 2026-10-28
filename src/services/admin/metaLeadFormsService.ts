import api from '../core/api';
import { extractData } from '../../utils/apiHelpers';

export type MetaLeadFormMode = 'pipeline' | 'notify_only';

export interface MetaLeadFormPipelineTarget {
  pipeline_id: string;
  pipeline_stage_id: string;
  pipeline_name?: string | null;
  pipeline_stage_name?: string | null;
}

export interface MetaLeadForm {
  id: string;
  page_id: string;
  form_id: string;
  form_name: string | null;
  active: boolean;
  mode: MetaLeadFormMode;
  pipelines: MetaLeadFormPipelineTarget[];
  created_at: string;
}

export interface MetaLeadFormPayload {
  page_id: string;
  form_id: string;
  form_name?: string;
  mode: MetaLeadFormMode;
  pipelines: Array<{ pipeline_id: string; pipeline_stage_id: string }>;
  active?: boolean;
}

export interface MetaLeadSubmission {
  id: string;
  leadgen_id: string;
  page_id: string;
  form_id: string;
  ad_id: string | null;
  adset_id: string | null;
  campaign_id: string | null;
  ad_name: string | null;
  adset_name: string | null;
  campaign_name: string | null;
  status: 'unmapped_form' | 'processed' | 'error';
  error_message: string | null;
  field_data: Array<{ name: string; values: string[] }>;
  lead_created_time: string | null;
  created_at: string;
  notified_whatsapp_at: string | null;
  contact_id: string | null;
  pipeline_item_id: string | null;
  pipeline_id: string | null;
  pipeline_name: string | null;
  pipeline_stage_id: string | null;
  pipeline_stage_name: string | null;
}

// Colunas extras só vêm no `show` (não no `index`, que é usado na lista
// "retidos" — mais leve de propósito) — pedidas pelo botão de editar da
// tela "Ver Leads" (LeadFormLeadsDialog).
export interface MetaLeadSubmissionDetail extends MetaLeadSubmission {
  found: true;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  lead_quality: string | null;
  lead_score: number | null;
  lead_objection: string | null;
  lead_observation: string | null;
  available_stages: Array<{ id: string; name: string }> | null;
}

// `found: false` = sem MetaLeadSubmission no banco (ex.: formulário "só
// notificar", que nunca persiste) — o backend ainda assim busca o lead ao
// vivo na Graph API pra pré-preencher nome/telefone/ad_id do envio manual
// (ver Api::V1::Admin::MetaLeadSubmissionsController#render_live_lookup).
export interface MetaLeadSubmissionLiveLookup {
  found: false;
  leadgen_id: string;
  ad_id: string | null;
  adset_id: string | null;
  campaign_id: string | null;
  field_data: Array<{ name: string; values: string[] }>;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
}

export type MetaLeadSubmissionLookup = MetaLeadSubmissionDetail | MetaLeadSubmissionLiveLookup;

export interface PipelineStatusForLead {
  status: MetaLeadSubmission['status'];
  contact_id: string | null;
  pipeline_item_id: string | null;
  pipeline_id: string | null;
  pipeline_name: string | null;
  pipeline_stage_id: string | null;
  pipeline_stage_name: string | null;
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

  // `leadgenId` é o id do lead na Graph API — é também o identificador na
  // rota (ver comentário em Api::V1::Admin::MetaLeadSubmissionsController),
  // não o UUID interno do registro. `pageId` é obrigatório pro caso
  // `found: false` (lead sem MetaLeadSubmission persistida) — o backend
  // precisa saber de qual Página buscar na Graph API.
  async getSubmission(leadgenId: string, pageId: string): Promise<MetaLeadSubmissionLookup> {
    const response = await api.get(`/admin/meta_lead_submissions/${leadgenId}`, { params: { page_id: pageId } });
    return extractData<MetaLeadSubmissionLookup>(response);
  },

  async pixelsForAd(adId: string): Promise<Array<{ id: string; name: string }>> {
    const response = await api.get('/admin/meta_lead_submissions/pixels_for_ad', { params: { ad_id: adId } });
    return extractData<Array<{ id: string; name: string }>>(response);
  },

  async updateSubmission(leadgenId: string, payload: { status?: string; pipeline_stage_id?: string }): Promise<MetaLeadSubmissionDetail> {
    const response = await api.patch(`/admin/meta_lead_submissions/${leadgenId}`, payload);
    return extractData<MetaLeadSubmissionDetail>(response);
  },
};
