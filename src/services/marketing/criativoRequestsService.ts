import api from '@/services/core/api';

const ENDPOINT = '/reports/criativos';

export type CriativoProvider = 'drive' | 'dropbox';

export interface CriativoSolicitacao {
  grant: string;
  url?: string;
  nome?: string;
  provedor: CriativoProvider;
  pasta_ref: string;
  pasta_nome?: string;
  criado_por?: string;
  criado_em?: string;
  submissoes: number;
  arquivos: number;
  ultima_submissao?: string;
}

export interface CriativoStatus {
  drive: boolean;
  dropbox: boolean;
}

export interface CriativoLink {
  url: string;
  grant: string;
}

// Mesmo padrão do googleDriveService: um endpoint único que despacha por
// `acao` (ver Api::V1::Reports::CriativosController).
async function call<T>(acao: string, extra: Record<string, unknown> = {}): Promise<T> {
  const response = await api.post(ENDPOINT, { acao, ...extra });
  return response.data.data as T;
}

class CriativoRequestsService {
  status(): Promise<CriativoStatus> {
    return call<CriativoStatus[]>('status').then((r) => r?.[0] ?? { drive: false, dropbox: false });
  }

  gerarLink(params: {
    nome?: string;
    provedor: CriativoProvider;
    pastaRef: string;
    pastaNome?: string;
  }): Promise<CriativoLink> {
    return call<CriativoLink>('gerar_link', {
      nome: params.nome,
      provedor: params.provedor,
      pasta_ref: params.pastaRef,
      pasta_nome: params.pastaNome,
    });
  }

  solicitacoes(): Promise<CriativoSolicitacao[]> {
    return call<Array<{ solicitacoes: CriativoSolicitacao[] }>>('solicitacoes').then((r) => r?.[0]?.solicitacoes ?? []);
  }
}

export const criativoRequestsService = new CriativoRequestsService();