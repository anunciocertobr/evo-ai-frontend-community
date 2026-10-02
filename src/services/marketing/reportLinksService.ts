import axios from 'axios';
import api from '@/services/core/api';
import type { ClientGoal } from './clientGoalsService';

export interface ReportLink {
  id: string;
  title: string;
  report_type: string;
  token: string;
  url: string;
  ad_account_ids: string[];
  expires_at: string;
  days_left: number;
  revoked_at: string | null;
  usable: boolean;
  created_at: string;
}

export interface PublicReportPayload {
  link: {
    title: string;
    expires_at: string;
    days_left: number;
  };
  goals: ClientGoal[];
}

/** Validades oferecidas na tela, em dias. O backend recusa acima de 365. */
export const VALIDITY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '1 dia' },
  { value: 7, label: '7 dias' },
  { value: 15, label: '15 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
  { value: 365, label: '1 ano' },
];

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  errors?: string[];
  error?: string;
}

class ReportLinksService {
  private readonly baseUrl = '/marketing/report_links';

  async list(): Promise<ReportLink[]> {
    const response = await api.get<ApiEnvelope<ReportLink[]>>(this.baseUrl);
    return response.data.data;
  }

  /**
   * `adAccountIds` é o que define o que quem abre o link enxerga — o filtro é
   * aplicado no backend, não aqui.
   */
  async create(input: {
    title: string;
    validDays: number;
    adAccountIds: string[];
  }): Promise<ReportLink> {
    const response = await api.post<ApiEnvelope<ReportLink>>(this.baseUrl, {
      report_snapshot: {
        title: input.title,
        report_type: 'marketing_client_goals',
        valid_days: input.validDays,
        ad_account_ids: input.adAccountIds,
      },
    });
    return response.data.data;
  }

  async revoke(id: string): Promise<ReportLink> {
    const response = await api.patch<ApiEnvelope<ReportLink>>(`${this.baseUrl}/${id}/revoke`);
    return response.data.data;
  }
}

/**
 * Leitura pública do relatório — SEM o interceptor de auth de `api`, de
 * propósito por dois motivos:
 *
 * 1. O endpoint público fica em `/public/api/v1/...`, fora do baseURL
 *    `/api/v1` da instância autenticada.
 * 2. O tratamento de 401 da instância autenticada mata a sessão do usuário.
 *    Um link inválido responde 404/410, mas deixar esse caminho sem o
 *    interceptor evita que uma falha do relatório derrube a sessão de quem
 *    está logado no CRM.
 */
export async function fetchPublicReport(token: string): Promise<PublicReportPayload> {
  const base = `${import.meta.env.VITE_API_URL}/public/api/v1`;
  const response = await axios.get<ApiEnvelope<PublicReportPayload>>(
    `${base}/report_links/${encodeURIComponent(token)}`,
  );
  return response.data.data;
}

export const reportLinksService = new ReportLinksService();
export default reportLinksService;