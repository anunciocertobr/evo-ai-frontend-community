import api from '@/services/core/api';

export type MetaBillingSessionStatus = 'idle' | 'active' | 'error';

export interface MetaBillingSession {
  status: MetaBillingSessionStatus;
  cookiesImportedAt: string | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
  hasCookies: boolean;
}

class MetaBillingService {
  async getSession(): Promise<MetaBillingSession> {
    const response = await api.get<MetaBillingSession>('/meta/billing_session');
    return response.data;
  }

  async importCookies(cookiesJson: string): Promise<MetaBillingSession> {
    const response = await api.post<MetaBillingSession>('/meta/billing_session/import_cookies', {
      cookies_json: cookiesJson,
    });
    return response.data;
  }
}

export const metaBillingService = new MetaBillingService();
