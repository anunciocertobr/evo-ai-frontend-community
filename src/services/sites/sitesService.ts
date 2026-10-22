import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';

export interface Site {
  id: string;
  url: string;
  name: string | null;
  hostname: string | null;
  active: boolean;
  leads_count: number;
  created_at: string;
  updated_at: string;
}

export interface SiteLeadSubmission {
  id: string;
  event_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  value: string | null;
  currency: string | null;
  transaction_id: string | null;
  product_ids: string[];
  content_category: string[];
  payment_method: string | null;
  action_source: string | null;
  gender: string | null;
  birth_date: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  address_country: string | null;
  page_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  utm_id: string | null;
  gclid: string | null;
  fbclid: string | null;
  fbp: string | null;
  fbc: string | null;
  ttclid: string | null;
  msclkid: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
}

export interface SiteWebhookInfo {
  webhook_url: string;
  leads_count: number;
}

export interface UpdateSitePayload {
  name?: string;
  url?: string;
  active?: boolean;
  refetch_title?: boolean;
}

// Dashboards > Sites — card por URL cadastrada, com webhook próprio que
// recebe leads de formulário/e-commerce de uma tag do Google Tag Manager
// (ver Api::V1::SitesController / Api::V1::Webhooks::SitesController).
class SitesService {
  async list(): Promise<Site[]> {
    const response = await api.get('/sites');
    return extractData<Site[]>(response);
  }

  async get(id: string): Promise<Site> {
    const response = await api.get(`/sites/${id}`);
    return extractData<Site>(response);
  }

  async create(url: string, name?: string): Promise<Site> {
    const response = await api.post('/sites', { url, name });
    return extractData<Site>(response);
  }

  async update(id: string, payload: UpdateSitePayload): Promise<Site> {
    const response = await api.patch(`/sites/${id}`, payload);
    return extractData<Site>(response);
  }

  async destroy(id: string): Promise<void> {
    await api.delete(`/sites/${id}`);
  }

  async getLeads(id: string): Promise<SiteLeadSubmission[]> {
    const response = await api.get(`/sites/${id}/leads`);
    return extractData<SiteLeadSubmission[]>(response);
  }

  async getWebhookInfo(id: string): Promise<SiteWebhookInfo> {
    const response = await api.get(`/sites/${id}/webhook_info`);
    return extractData<SiteWebhookInfo>(response);
  }

  async regenerateWebhookToken(id: string): Promise<SiteWebhookInfo> {
    const response = await api.post(`/sites/${id}/regenerate_webhook_token`);
    return extractData<SiteWebhookInfo>(response);
  }
}

export const sitesService = new SitesService();
