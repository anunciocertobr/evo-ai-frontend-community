export type FiscalAmbiente = 'homologacao' | 'producao';

export type FiscalProviderKey = 'guarulhos_gissonline';

export const SUPPORTED_MUNICIPIOS: Array<{
  ibge_code: string;
  nome: string;
  uf: string;
  provider_key: FiscalProviderKey | null;
}> = [
  { ibge_code: '3518800', nome: 'Guarulhos', uf: 'SP', provider_key: 'guarulhos_gissonline' },
  { ibge_code: '3550308', nome: 'São Paulo', uf: 'SP', provider_key: null },
  { ibge_code: '3509502', nome: 'Campinas', uf: 'SP', provider_key: null },
  { ibge_code: '3519055', nome: 'Hortolândia', uf: 'SP', provider_key: null },
];

export interface FiscalEstablishment {
  id: string;
  municipio_ibge_code: string;
  municipio_nome: string;
  uf: string;
  inscricao_municipal: string;
  cnae_override?: string | null;
  /** Serializado como string pelo Rails (BigDecimal#as_json) — nunca number. */
  aliquota_iss_pct: string;
  ambiente: FiscalAmbiente;
  provider_key: FiscalProviderKey;
  rps_serie: string;
  rps_numero_atual: number;
  active: boolean;
  certificate_expires_at?: string | null;
  configured: boolean;
  created_at: string;
  updated_at: string;
}

export interface FiscalEstablishmentFormData {
  municipio_ibge_code: string;
  municipio_nome: string;
  uf: string;
  inscricao_municipal: string;
  cnae_override?: string;
  aliquota_iss_pct: number;
  ambiente: FiscalAmbiente;
  provider_key: FiscalProviderKey;
  rps_serie?: string;
  active?: boolean;
}

export type ServiceInvoiceStatus = 'pending' | 'processing' | 'authorized' | 'error' | 'cancelled';

export interface ServiceInvoiceEndereco {
  logradouro: string;
  numero: string;
  bairro: string;
  codigo_municipio: string;
  uf: string;
  cep: string;
}

export interface ServiceInvoice {
  id: string;
  fiscal_establishment_id: string;
  work_order_id?: string | null;
  numero_rps: string;
  serie_rps: string;
  numero_nfse?: string | null;
  codigo_verificacao?: string | null;
  protocolo?: string | null;
  status: ServiceInvoiceStatus;
  tomador_nome: string;
  tomador_cpf_cnpj: string;
  tomador_email?: string | null;
  tomador_endereco: ServiceInvoiceEndereco;
  discriminacao: string;
  codigo_servico_municipal: string;
  /** Código NBS (Nomenclatura Brasileira de Serviços) — exigido pelo manual
   * técnico de Guarulhos pós Reforma Tributária (LC 214/2025), até 9 dígitos. */
  codigo_nbs: string;
  /** Override opcional do código de tributação municipal — em branco, o
   * backend usa a tabela padrão por item de serviço (Guarulhos::Client). */
  codigo_tributacao_municipio?: string | null;
  /** Campos decimal — serializados como string pelo Rails (BigDecimal#as_json). */
  valor_servicos: string;
  aliquota_iss_pct: string;
  valor_iss: string;
  valor_deducoes: string;
  erro_mensagem?: string | null;
  xml_envio?: string;
  xml_retorno?: string;
  created_at: string;
  updated_at: string;
}

// Dados do serviço da última nota emitida pra este tomador — preenche o
// resto do formulário (além de nome/endereço) ao escolher um tomador salvo.
export interface FiscalTomadorLastService {
  discriminacao?: string;
  codigo_servico_municipal?: string;
  codigo_nbs?: string;
  codigo_tributacao_municipio?: string;
  valor_servicos?: number;
  aliquota_iss_pct?: number;
}

export interface FiscalTomador {
  id: string;
  nome: string;
  cpf_cnpj: string;
  email?: string | null;
  endereco: ServiceInvoiceEndereco;
  last_service?: FiscalTomadorLastService;
  created_at: string;
  updated_at: string;
}

export interface FiscalTomadorFormData {
  nome: string;
  cpf_cnpj: string;
  email?: string;
  endereco: ServiceInvoiceEndereco;
  last_service?: FiscalTomadorLastService;
}

export interface ServiceInvoiceFormData {
  fiscal_establishment_id: string;
  work_order_id?: string;
  tomador_nome: string;
  tomador_cpf_cnpj: string;
  tomador_email?: string;
  tomador_endereco: ServiceInvoiceEndereco;
  discriminacao: string;
  codigo_servico_municipal: string;
  codigo_nbs: string;
  codigo_tributacao_municipio?: string;
  valor_servicos: number;
  valor_deducoes?: number;
  aliquota_iss_pct?: number;
}
