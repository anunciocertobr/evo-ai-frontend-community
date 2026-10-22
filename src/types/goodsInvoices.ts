// NF-e 55 (mercadoria/e-commerce) e NFC-e 65 (balcão/delivery) — tipos
// independentes de fiscalInvoices.ts (que é só NFS-e/Guarulhos), por
// pedido explícito do usuário de manter as duas frentes separadas.

export type GoodsFiscalAmbiente = 'homologacao' | 'producao';
export type GoodsFiscalCrt = '1' | '2' | '3'; // Simples | Simples excesso | Normal
export type GoodsInvoiceModelo = '55' | '65'; // NF-e | NFC-e
export type GoodsInvoiceStatus = 'pending' | 'processing' | 'authorized' | 'error' | 'cancelled';

export interface GoodsFiscalProfile {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string | null;
  uf: string;
  inscricao_estadual: string;
  crt: GoodsFiscalCrt;
  ambiente: GoodsFiscalAmbiente;
  provider_key?: string | null;
  serie_nfe: string;
  numero_nfe_atual: number;
  serie_nfce: string;
  numero_nfce_atual: number;
  active: boolean;
  configured: boolean;
  csc_configured: boolean;
  certificate_expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoodsFiscalProfileFormData {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  uf: string;
  inscricao_estadual: string;
  crt: GoodsFiscalCrt;
  ambiente: GoodsFiscalAmbiente;
  serie_nfe?: string;
  serie_nfce?: string;
  active?: boolean;
}

export interface GoodsInvoiceEndereco {
  logradouro: string;
  numero: string;
  bairro: string;
  codigo_municipio: string;
  uf: string;
  cep: string;
}

/** Espelha Tax::CalculationService::Result (mesmo usado em
 * /products/:id/calcular_imposto) — um bloco por item, calculado no
 * backend a partir do produto vinculado, nunca no frontend. */
export interface GoodsInvoiceItemTaxResult {
  regime: string;
  base_calculo: number;
  cbs_valor: number;
  cbs_aliquota: number;
  ibs_valor: number;
  ibs_aliquota: number;
  imposto_seletivo_valor: number;
  imposto_seletivo_aliquota: number;
  legado_valor: number;
  legado_aliquota: number;
  total_impostos: number;
  preco_total: number;
  avisos: string[];
}

export interface GoodsInvoiceItem {
  product_id?: string;
  descricao: string;
  ncm: string;
  cfop: string;
  cst_csosn: string;
  origem: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  cclasstrib?: string | null;
  /** Preenchido pelo backend na resposta — nunca enviado na criação. */
  impostos?: GoodsInvoiceItemTaxResult | null;
  avisos?: string[];
}

export interface GoodsInvoice {
  id: string;
  goods_fiscal_profile_id: string;
  work_order_id?: string | null;
  modelo: GoodsInvoiceModelo;
  numero: string;
  serie: string;
  natureza_operacao: string;
  status: GoodsInvoiceStatus;
  chave_acesso?: string | null;
  protocolo?: string | null;
  data_emissao?: string | null;
  destinatario_nome?: string | null;
  destinatario_cpf_cnpj?: string | null;
  destinatario_endereco?: GoodsInvoiceEndereco;
  itens: GoodsInvoiceItem[];
  /** Campos decimal — serializados como string pelo Rails (BigDecimal#as_json). */
  valor_produtos: string;
  valor_desconto: string;
  valor_frete: string;
  valor_total: string;
  /** Agregados de Tax::CalculationService somados entre os itens (Reforma
   * Tributária LC 214/2025 + legado ICMS/PIS/COFINS/ISS estimado). */
  regime_tributario?: string | null;
  valor_cbs: string;
  valor_ibs: string;
  valor_imposto_seletivo: string;
  valor_legado: string;
  valor_total_impostos: string;
  avisos_fiscais: string[];
  erro_mensagem?: string | null;
  xml_envio?: string;
  xml_retorno?: string;
  created_at: string;
  updated_at: string;
}

// valor_produtos/valor_total NÃO entram aqui de propósito: o backend
// recalcula os dois a partir de itens + desconto + frete (ver
// GoodsInvoices::EmissionService) — nunca confia no total que o navegador
// mandar.
export interface GoodsInvoiceFormData {
  goods_fiscal_profile_id: string;
  work_order_id?: string;
  modelo: GoodsInvoiceModelo;
  natureza_operacao: string;
  destinatario_nome?: string;
  destinatario_cpf_cnpj?: string;
  destinatario_endereco?: GoodsInvoiceEndereco;
  itens: GoodsInvoiceItem[];
  valor_desconto?: number;
  valor_frete?: number;
}
