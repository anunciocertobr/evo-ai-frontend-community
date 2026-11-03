import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';
import type { MercadoLivreOrder, MercadoLivreStatus } from '@/types/orders/mercadoLivreOrder';

// Espelha o retorno real da API do ML (ver MercadoLivre::Client#items_details,
// testado contra a conta real 30/10/2026) — só os campos que a tela usa.
export interface MercadoLivreProduct {
  id: string;
  title: string;
  price: number;
  status: string;
  thumbnail: string | null;
  available_quantity: number;
  sold_quantity: number;
  permalink: string | null;
}

export interface MercadoLivreQuestion {
  id: number;
  text: string;
  status: string;
  date_created: string;
  item_id: string;
  from?: { id: number };
  answer?: { text: string; status: string; date_created: string } | null;
}

export interface MercadoLivreReview {
  id: number;
  title: string | null;
  content: string | null;
  rate: number;
  date_created: string;
  buying_date: string | null;
  status: string;
}

export interface MercadoLivreMessage {
  id: string;
  text: string;
  from?: { user_id: number };
  to?: { user_id: number };
  message_date?: { created: string; available: string; notified: string | null; read: string | null };
}

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

  async getProducts(status?: string): Promise<MercadoLivreProduct[]> {
    const response = await api.get(`${this.baseUrl}/products`, { params: status ? { status } : undefined });
    return extractData<MercadoLivreProduct[]>(response);
  }

  // `status` default do backend é UNANSWERED (ver MercadoLivreController#questions).
  async getQuestions(status?: string): Promise<{ questions: MercadoLivreQuestion[]; total: number }> {
    const response = await api.get(`${this.baseUrl}/questions`, { params: status ? { status } : undefined });
    const data = extractData<{ questions: MercadoLivreQuestion[]; total: number }>(response);
    return { questions: data?.questions || [], total: data?.total || 0 };
  }

  async answerQuestion(questionId: number, text: string): Promise<void> {
    await api.post(`${this.baseUrl}/questions/answer`, { question_id: questionId, text });
  }

  async getReviews(itemId: string): Promise<{ reviews: MercadoLivreReview[]; rating_average: number | null }> {
    const response = await api.get(`${this.baseUrl}/reviews`, { params: { item_id: itemId } });
    const data = extractData<{ reviews: MercadoLivreReview[]; rating_average: number | null }>(response);
    return { reviews: data?.reviews || [], rating_average: data?.rating_average ?? null };
  }

  async getMessages(orderId: string): Promise<{ results: MercadoLivreMessage[] }> {
    const response = await api.get(`${this.baseUrl}/orders/${orderId}/messages`);
    const data = extractData<{ results: MercadoLivreMessage[] }>(response);
    return { results: data?.results || [] };
  }

  async sendMessage(orderId: string, text: string): Promise<void> {
    await api.post(`${this.baseUrl}/orders/${orderId}/messages`, { text });
  }
}

export const mercadoLivreService = new MercadoLivreService();
