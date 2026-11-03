// Colunas extras da tela de Contatos (pedido do CRM + pixel Meta),
// ligadas/desligadas pelo botão "Colunas" — separado de ContactsTable.tsx
// porque esse arquivo só pode exportar componentes (react-refresh).
export const CONTACTS_EXTRA_COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'pedido_order_id', label: 'Order ID (pedido)' },
  { key: 'pedido_produtos', label: 'Produtos' },
  { key: 'pedido_valor', label: 'Valor do pedido' },
  { key: 'pixel_campanha', label: 'Campanha (pixel)' },
  { key: 'pixel_conjunto', label: 'Conjunto (pixel)' },
  { key: 'pixel_anuncio', label: 'Anúncio (pixel)' },
  { key: 'pixel_utm_source', label: 'UTM Source (pixel)' },
  { key: 'pixel_valor_venda', label: 'Valor venda (pixel)' },
];
