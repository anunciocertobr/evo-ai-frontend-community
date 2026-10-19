// Consulta pública de CNPJ (BrasilAPI, sem chave, CORS liberado) pra preencher
// o tomador da NFS-e sem digitar razão social/endereço à mão. Só o cliente PJ
// (CNPJ) tem dados públicos — CPF não é consultado.

export interface CnpjLookupResult {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  endereco: {
    logradouro: string;
    numero: string;
    bairro: string;
    cep: string;
    codigoMunicipio: string; // código IBGE (casa com o codigo_municipio do tomador)
    uf: string;
  };
}

interface BrasilApiCnpjResponse {
  razao_social?: string | null;
  nome_fantasia?: string | null;
  email?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cep?: string | null;
  uf?: string | null;
  codigo_municipio_ibge?: number | string | null;
}

const BRASILAPI_URL = 'https://brasilapi.com.br/api/cnpj/v1';

export function onlyDigits(value: string): string {
  return (value || '').replace(/\D/g, '');
}

// Validação de dígitos verificadores — evita disparar a consulta durante a
// digitação (e barrar CNPJ inexistente/inválido antes de gastar a request).
export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const checkDigit = (base: string, weights: number[]): number => {
    const sum = base.split('').reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const base = cnpj.slice(0, 12);
  const first = checkDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(base + String(first), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj === `${base}${first}${second}`;
}

export async function lookupCnpj(value: string): Promise<CnpjLookupResult> {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) throw new Error('CNPJ incompleto.');

  let response: Response;
  try {
    response = await fetch(`${BRASILAPI_URL}/${cnpj}`);
  } catch {
    throw new Error('Não foi possível consultar o CNPJ agora.');
  }

  if (!response.ok) {
    if (response.status === 404) throw new Error('CNPJ não encontrado na Receita.');
    throw new Error('Não foi possível consultar o CNPJ agora.');
  }

  const data = (await response.json()) as BrasilApiCnpjResponse;
  return {
    cnpj,
    razaoSocial: (data.razao_social || '').trim(),
    nomeFantasia: (data.nome_fantasia || '').trim(),
    email: (data.email || '').trim(),
    endereco: {
      logradouro: (data.logradouro || '').trim(),
      numero: (data.numero || '').trim(),
      bairro: (data.bairro || '').trim(),
      cep: onlyDigits(data.cep || ''),
      codigoMunicipio: data.codigo_municipio_ibge != null ? String(data.codigo_municipio_ibge) : '',
      uf: (data.uf || '').trim().toUpperCase(),
    },
  };
}
