import api from '@/services/core/api';

const ENDPOINT = '/reports/criativos';

export type CriativoProvider = 'drive' | 'dropbox';

export type CriativoStatusSubmissao = 'recebido' | 'produzindo' | 'finalizado' | 'recusado';

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
  ultima_status?: CriativoStatusSubmissao;
}

export interface CriativoArquivoSubmissao {
  nome: string;
  tamanho?: number;
  tipo?: string;
  ref?: string;
  preview?: string;
  download?: string;
}

export interface CriativoSubmissao {
  id: string;
  criado_em: string;
  status: CriativoStatusSubmissao;
  campos: Record<string, string>;
  arquivos: CriativoArquivoSubmissao[];
}

export interface CriativoSolicitacaoDetalhe {
  grant: string;
  url?: string;
  nome?: string;
  provedor: CriativoProvider;
  pasta_ref: string;
  pasta_nome?: string;
  criado_em?: string;
  submissoes: CriativoSubmissao[];
}

export interface CriativoRemocao {
  removido: boolean;
  erros_ao_excluir?: string[];
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

  detalhe(grant: string): Promise<CriativoSolicitacaoDetalhe> {
    return call<CriativoSolicitacaoDetalhe>('detalhe', { grant });
  }

  atualizarStatus(grant: string, submissaoId: string, status: CriativoStatusSubmissao): Promise<CriativoSubmissao | CriativoRemocao> {
    return call<CriativoSubmissao | CriativoRemocao>('atualizar_status', {
      grant,
      submissao_id: submissaoId,
      status,
    });
  }

  removerLink(grant: string): Promise<CriativoRemocao> {
    return call<CriativoRemocao>('remover_link', { grant });
  }
}

export const criativoRequestsService = new CriativoRequestsService();