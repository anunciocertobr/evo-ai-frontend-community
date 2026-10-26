export interface MercadoLivreOrder {
  id: string;
  ml_order_id: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  items: Array<{ name?: string; quantity?: number; unitPrice?: number }>;
  items_count: number;
  total_price: number;
  placed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MercadoLivreStatus {
  connected: boolean;
  user_id: string | null;
}
