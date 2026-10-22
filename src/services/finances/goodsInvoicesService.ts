import api from '@/services/core/api';
import { extractData, extractResponse } from '@/utils/apiHelpers';
import { GoodsInvoice, GoodsInvoiceFormData } from '@/types/goodsInvoices';

class GoodsInvoicesService {
  private readonly baseUrl = '/finances/goods_invoices';

  async list(): Promise<GoodsInvoice[]> {
    const response = await api.get(this.baseUrl);
    return (extractResponse<GoodsInvoice>(response).data as GoodsInvoice[]) ?? [];
  }

  async get(id: string): Promise<GoodsInvoice> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return extractData<GoodsInvoice>(response);
  }

  async create(
    goodsFiscalProfileId: string,
    payload: Omit<GoodsInvoiceFormData, 'goods_fiscal_profile_id'>,
  ): Promise<GoodsInvoice> {
    const response = await api.post(this.baseUrl, {
      goods_invoice: { ...payload, goods_fiscal_profile_id: goodsFiscalProfileId },
    });
    return extractData<GoodsInvoice>(response);
  }

  async cancel(id: string): Promise<GoodsInvoice> {
    const response = await api.post(`${this.baseUrl}/${id}/cancel`);
    return extractData<GoodsInvoice>(response);
  }
}

export const goodsInvoicesService = new GoodsInvoicesService();
