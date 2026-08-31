import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';

/**
 * Superfície de config do webhook de compra (CRM-493): quais plataformas de
 * pagamento estão registradas/configuradas e a URL assinada que o operador
 * registra numa delas. Consome /api/v1/purchase_webhooks (o ingress de entrega
 * em si é outro caminho, não-autenticado).
 */
export interface PurchaseWebhookProvider {
  provider: string;
  configured: boolean;
  requires_destination_secret: boolean;
}

export interface PurchaseWebhookProvidersPayload {
  providers: PurchaseWebhookProvider[];
  destination_secret_configured: boolean;
}

export interface PurchaseWebhookUrlPayload {
  url: string;
  host_kind: 'whitelabel' | 'global';
}

class PurchaseWebhooksService {
  private readonly baseUrl = '/purchase_webhooks';

  async providers(): Promise<PurchaseWebhookProvidersPayload> {
    const res = await api.get(`${this.baseUrl}/providers`);
    return extractData<PurchaseWebhookProvidersPayload>(res);
  }

  async mintUrl(params: {
    provider: string;
    pipelineId: string;
    product?: string;
  }): Promise<PurchaseWebhookUrlPayload> {
    const res = await api.get(`${this.baseUrl}/url`, {
      params: {
        provider: params.provider,
        pipeline_id: params.pipelineId,
        ...(params.product ? { product: params.product } : {}),
      },
    });
    return extractData<PurchaseWebhookUrlPayload>(res);
  }
}

export const purchaseWebhooksService = new PurchaseWebhooksService();
