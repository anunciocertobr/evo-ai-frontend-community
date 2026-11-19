import apiPublic from '@/services/core/apiPublic';

export interface PublicMenuProduct {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  image_url?: string | null;
}

export interface PublicMenuCategory {
  id: string | null;
  name: string;
  products: PublicMenuProduct[];
}

export interface PublicMenuSettings {
  company_name: string | null;
  header_color: string | null;
  background_color: string | null;
  footer_color: string | null;
  icon_color: string | null;
  text_color: string | null;
  title_color: string | null;
  company_name_color: string | null;
  gtm_id: string | null;
  whatsapp_number: string | null;
  google_client_id: string | null;
  // Pagamento online ligado (Organização > Cardápio Digital) e nome do
  // provedor escolhido ("InfinitePay" ou "Mercado Pago").
  checkout_enabled?: boolean;
  checkout_provider?: string;
}

export type OrderStatus = 'pending' | 'sent' | 'failed' | 'awaiting_payment' | 'paid';

export interface SubmitOrderResult {
  order_token: string;
  // Presente só com o pagamento online ligado — o cliente deve ser levado pra cá.
  checkout_url?: string;
}

export interface ConfirmPaymentParams {
  // InfinitePay
  transaction_nsu?: string;
  slug?: string;
  // Mercado Pago
  payment_id?: string;
  receipt_url?: string;
  capture_method?: string;
}

export interface GoogleLoginResult {
  found: boolean;
  email: string;
  full_name: string | null;
  cpf: string | null;
  phone: string | null;
  instagram: string | null;
  zip: string | null;
  address: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

export interface PublicMenu {
  categories: PublicMenuCategory[];
  settings: PublicMenuSettings;
}

export interface OrderCustomer {
  full_name: string;
  cpf?: string;
  birth_date?: string;
  gender?: string;
  phone: string;
  instagram?: string;
  email?: string;
  zip?: string;
  address: string;
  number: string;
  neighborhood?: string;
  city: string;
  state?: string;
}

export interface OrderItem {
  // Usado no pagamento online: o backend recalcula o preço pelo produto.
  product_id?: string;
  name: string;
  price: number;
  quantity: number;
}

/**
 * Service para a API pública (anônima) do cardápio digital.
 * Endpoints: GET /public/api/v1/menu, POST /public/api/v1/menu/orders.
 * Não requer autenticação — lista os produtos com status "active" do
 * catálogo, agrupados por categoria, e envia pedidos pro WhatsApp
 * configurado em Organização > Cardápio Digital.
 */
class MenuService {
  async getMenu(): Promise<PublicMenu> {
    const { data } = await apiPublic.get<{ data: PublicMenu }>('/menu');
    return data.data;
  }

  async submitOrder(
    customer: OrderCustomer,
    items: OrderItem[],
    paymentMethod: string,
    notes: string,
    orderToken: string,
  ): Promise<SubmitOrderResult> {
    const { data } = await apiPublic.post<SubmitOrderResult>('/menu/orders', {
      customer,
      items,
      payment_method: paymentMethod,
      notes,
      order_token: orderToken,
    });
    return data;
  }

  // O envio pro WhatsApp roda em background (pode levar alguns segundos) —
  // o checkout consulta esse status pra decidir se mostra o fallback "enviar
  // você mesmo pelo WhatsApp" quando o envio automático falha de verdade.
  async getOrderStatus(orderToken: string): Promise<OrderStatus> {
    const { data } = await apiPublic.get<{ status: OrderStatus }>(`/menu/orders/${orderToken}/status`);
    return data.status;
  }

  // Cliente voltou do checkout (InfinitePay ou Mercado Pago): o backend
  // confirma o pagamento direto no provedor e, se pago, dispara a mensagem
  // "Pedido PAGO" pro WhatsApp da loja.
  async confirmPayment(orderToken: string, params: ConfirmPaymentParams): Promise<string> {
    const { data } = await apiPublic.post<{ status: string }>(`/menu/orders/${orderToken}/confirm_payment`, params);
    return data.status;
  }

  // Verifica o ID token do "Entrar com Google" e devolve o que o CRM já sabe
  // sobre esse e-mail (Contact + último WorkOrder), pra pré-preencher o
  // checkout — o cliente continua podendo editar tudo.
  async googleLogin(credential: string): Promise<GoogleLoginResult> {
    const { data } = await apiPublic.post<{ data: GoogleLoginResult }>('/menu/google_login', { credential });
    return data.data;
  }
}

export const menuService = new MenuService();
export default menuService;
