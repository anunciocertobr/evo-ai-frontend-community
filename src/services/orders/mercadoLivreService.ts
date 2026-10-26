import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';
import type { MercadoLivreOrder, MercadoLivreStatus } from '@/types/orders/mercadoLivreOrder';

class MercadoLivreService {
  private readonly baseUrl = '/mercado_livre';

  async getStatus(): Promise<MercadoLivreStatus> {
    const response = await api.get(`${this.baseUrl}/status`);
    return extractData<MercadoLivreStatus>(response);
  }

  async getOrders(): Promise<MercadoLivreOrder[]> {
    const response = await api.get(`${this.baseUrl}/orders`);
    return extractData<MercadoLivreOrder[]>(response);
  }

  async syncOrders(): Promise<MercadoLivreOrder[]> {
    const response = await api.post(`${this.baseUrl}/orders/sync`);
    return extractData<MercadoLivreOrder[]>(response);
  }
}

export const mercadoLivreService = new MercadoLivreService();
