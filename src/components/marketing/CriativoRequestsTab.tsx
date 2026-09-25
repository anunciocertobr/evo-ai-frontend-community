import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Folder,
  HardDrive,
  Home,
  Link2,
  Loader2,
  PlayCircle,
  RefreshCw,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@evoapi/design-system';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { formatDateTime } from '@/utils/time';
import { mediaLibraryService, type MediaEntry, type MediaProvider } from '@/services/marketing/mediaLibraryService';
import {
  criativoRequestsService,
  type CriativoLink,
  type CriativoProvider,
  type CriativoSolicitacao,
  type CriativoSolicitacaoDetalhe,
  type CriativoStatus,
  type CriativoStatusSubmissao,
} from '@/services/marketing/criativoRequestsService';

interface Crumb {
  ref: string;
  name: string;
}

const PROVIDERS: Array<{ key: MediaProvider; label: string; icon: typeof HardDrive }> = [
  { key: 'drive', label: 'Google Drive', icon: HardDrive },
  { key: 'dropbox', label: 'Dropbox', icon: Cloud },
];

function PROV_LABEL(p: CriativoProvider): string {
  return p === 'drive' ? 'Google Drive' : 'Dropbox';
}

const STATUS_LABEL: Record<CriativoStatusSubmissao, string> = {
  recebido: 'Recebido',
  produzindo: 'Produzindo',
  finalizado: 'Finalizado',
  recusado: 'Recusado',
};

const STATUS_BADGE: Record<CriativoStatusSubmissao, 'default' | 'outline' | 'secondary' | 'destructive'> = {
  recebido: 'outline',
  produzindo: 'secondary',
  finalizado: 'default',
  recusado: 'destructive',
};

const CAMPO_LABEL: Record<string, string> = {
  nome_cliente: 'Nome do Cliente / Projeto',
  objetivo: 'Objetivo Principal',
  orcamento_diario: 'Orçamento Diário Estimado (R$)',
  data_inicio: 'Data de Início Prevista',
  publico: 'Público-Alvo e Segmentação',
  localizacoes: 'Localização Geográfica (mapa)',
  link_destino: 'Link de Destino / WhatsApp / Landing Page',
  oferta: 'Oferta, Promoção ou CTA do Anúncio',
  nome_campanha: 'Nome da Campanha ou Anúncio Existente',
  urgencia: 'Grau de Urgência',
  instrucoes: 'Instruções Detalhadas do que Alterar',
  link_arquivos: 'Link para Arquivos / Drive / Novas Mídias',
};

function formatBytes(n?: number): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function copyLink(url: string) {
  navigator.clipboard
    .writeText(url)
    .then(() => toast.success('Link copiado.'))
    .catch(() => toast.error('Não foi possível copiar o link.'));
}

export function CriativoRequestsTab() {
  const [provider, setProvider] = useState<MediaProvider>('drive');
  const [status, setStatus] = useState<CriativoStatus | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ ref: '', name: 'Raiz' }]);
  const [folders, setFolders] = useState<MediaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<CriativoLink | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<CriativoSolicitacao[]>([]);
  const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(false);
  const [urlsDialogOpen, setUrlsDialogOpen] = useState(false);
  const [detalheGrant, setDetalheGrant] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<CriativoSolicitacaoDetalhe | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [busyStatus, setBusyStatus] = useState<string | null>(null);
  const [deletandoGrant, setDeletandoGrant] = useState<string | null>(null);

  const location = crumbs[crumbs.length - 1].ref;
  const locationName = crumbs[crumbs.length - 1].name;

  const loadStatus = useCallback(() => {
    criativoRequestsService
      .status()
      .then(setStatus)
      .catch(() => setStatus({ drive: false, dropbox: false }));
  }, []);

  const loadFolders = useCallback(async (prov: MediaProvider, loc: string) => {
    setLoading(true);
    try {
      setFolders(await mediaLibraryService.list(prov, loc));
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao carregar as pastas.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSolicitacoes = useCallback(() => {
    setLoadingSolicitacoes(true);
    criativoRequestsService
      .solicitacoes()
      .then(setSolicitacoes)
      .catch(() => toast.error('Erro ao carregar as solicitações.'))
      .finally(() => setLoadingSolicitacoes(false));
  }, []);

  useEffect(() => {
    loadStatus();
    loadSolicitacoes();
  }, [loadStatus, loadSolicitacoes]);

  useEffect(() => {
    loadFolders(provider, location);
  }, [provider, location, loadFolders]);

  const switchProvider = (next: MediaProvider) => {
    if (next === provider) return;
    setProvider(next);
    setCrumbs([{ ref: '', name: 'Raiz' }]);
    setGenerated(null);
  };

  const openFolder = (entry: MediaEntry) => {
    setCrumbs((prev) => [...prev, { ref: entry.ref, name: entry.name }]);
    setGenerated(null);
  };

  const goToCrumb = (i: number) => {
    setCrumbs((prev) => prev.slice(0, i + 1));
    setGenerated(null);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const link = await criativoRequestsService.gerarLink({
        nome: nome.trim() || undefined,
        provedor: provider,
        pastaRef: location,
        pastaNome: location === '' ? 'Raiz' : locationName,
      });
      setGenerated(link);
      toast.success('Link gerado.');
      loadSolicitacoes();
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao gerar o link.');
    } finally {
      setGenerating(false);
    }
  };

  const openDetail = useCallback(async (grant: string) => {
    setDetalheGrant(grant);
    setDetalhe(null);
    setLoadingDetalhe(true);
    try {
      setDetalhe(await criativoRequestsService.detalhe(grant));
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao carregar o conteúdo enviado.');
      setDetalheGrant(null);
    } finally {
      setLoadingDetalhe(false);
    }
  }, []);

  const aplicarStatus = async (subId: string, next: CriativoStatusSubmissao) => {
    if (!detalheGrant) return;
    if (
      next === 'recusado' &&
      !window.confirm('Recusar este envio exclui os arquivos dele do Drive/Dropbox. Continuar?')
    ) {
      return;
    }
    setBusyStatus(`${subId}:${next}`);
    try {
      await criativoRequestsService.atualizarStatus(detalheGrant, subId, next);
      toast.success(
        next === 'recusado'
          ? 'Envio recusado e arquivos excluídos.'
          : `Status atualizado para "${STATUS_LABEL[next]}".`
      );
      setDetalhe(await criativoRequestsService.detalhe(detalheGrant));
      loadSolicitacoes();
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao atualizar o status.');
    } finally {
      setBusyStatus(null);
    }
  };

  const removerLink = async (grant: string) => {
    if (
      !window.confirm(
        'Excluir este link apaga as submissões e os arquivos enviados pelo cliente no Drive/Dropbox. Continuar?'
      )
    ) {
      return;
    }
    setDeletandoGrant(grant);
    try {
      await criativoRequestsService.removerLink(grant);
      toast.success('Link excluído.');
      if (detalheGrant === grant) {
        setDetalheGrant(null);
        setDetalhe(null);
      }
      loadSolicitacoes();
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao excluir o link.');
    } finally {
      setDeletandoGrant(null);
    }
  };

  const providerConnected = provider === 'drive' ? status?.drive : status?.dropbox;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Escolha a pasta de destino (Google Drive ou Dropbox) e gere um link público pra mandar ao cliente. O cliente
        envia os criativos e os arquivos caem direto nessa pasta — cada cliente pode ter a própria pasta e o próprio link.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {PROVIDERS.map(({ key, label, icon: Icon }) => (
            <Button key={key} size="sm" variant={provider === key ? 'default' : 'outline'} onClick={() => switchProvider(key)}>
              <Icon className="w-4 h-4 mr-1.5" /> {label}
              {status && (
                <Badge variant={provider === key ? 'default' : 'outline'} className="ml-1.5">
                  {provider === key ? (providerConnected ? 'Conectado' : 'Desconectado') : status[key] ? 'Conectado' : 'Desconectado'}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {providerConnected && (
          <Button size="sm" variant="ghost" onClick={() => loadFolders(provider, location)} disabled={loading} title="Atualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>

      {providerConnected === false ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {PROV_LABEL(provider)} não está conectado.{' '}
          <Link to="/settings/integrations" className="underline underline-offset-2 font-medium">
            Conectar em Configurações &gt; Integrações
          </Link>
        </div>
      ) : (
        <>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {crumbs.map((crumb, i) => (
              <span key={`${crumb.ref}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                {i === crumbs.length - 1 ? (
                  <span className="font-medium">{crumb.name}</span>
                ) : (
                  <button
                    type="button"
                    className="text-primary hover:underline flex items-center gap-1"
                    onClick={() => goToCrumb(i)}
                  >
                    {i === 0 && <Home className="w-3.5 h-3.5" />} {crumb.name}
                  </button>
                )}
              </span>
            ))}
          </nav>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando pastas...
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
              Pasta vazia. Você pode gerar o link apontando pra pasta atual.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {folders
                .filter((f) => f.kind === 'folder')
                .map((entry) => (
                  <button
                    key={`${entry.provider}:${entry.ref}`}
                    type="button"
                    className="rounded-lg border border-border bg-card p-4 text-left hover:bg-muted/40 transition-colors"
                    onClick={() => openFolder(entry)}
                  >
                    <Folder className="w-8 h-8 text-sky-400 mb-2" />
                    <p className="text-xs font-medium truncate" title={entry.name}>
                      {entry.name}
                    </p>
                  </button>
                ))}
            </div>
          )}

          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h4 className="text-sm font-semibold">
              Gerar link público pra pasta <span className="text-primary">{location === '' ? 'Raiz' : locationName}</span>
            </h4>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1 max-w-sm space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="solicitacao-nome">
                  Nome do cliente (opcional)
                </label>
                <Input
                  id="solicitacao-nome"
                  value={nome}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNome(e.target.value)}
                  placeholder="Ex: Restaurante Sabor"
                />
              </div>
              <Button onClick={handleGenerate} disabled={generating || !providerConnected}>
                {generating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Link2 className="w-4 h-4 mr-1.5" />}
                Gerar link
              </Button>
            </div>

            {generated && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Link público do cliente (não expira enquanto estiver ativo). O cliente NAO precisa estar logado.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-xs break-all bg-background border border-border rounded px-2 py-1 flex-1">{generated.url}</code>
                  <Button size="sm" onClick={() => copyLink(generated.url)}>
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar link
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Todos os envios do cliente caem na pasta selecionada.</p>
              </div>
            )}
          </div>
        </>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <Send className="w-4 h-4" /> Solicitações recebidas
          </h4>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setUrlsDialogOpen(true)}>
              <Link2 className="w-3.5 h-3.5 mr-1.5" /> Ver URLs geradas
            </Button>
            <Button size="sm" variant="ghost" onClick={loadSolicitacoes} disabled={loadingSolicitacoes} title="Atualizar">
              <RefreshCw className={`w-4 h-4 ${loadingSolicitacoes ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {loadingSolicitacoes ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : solicitacoes.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
            Nenhum link gerado ainda.
          </div>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {solicitacoes.map((s) => (
              <div key={s.grant} className="p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h5 className="text-sm font-semibold">{s.nome || '(Sem nome)'}</h5>
                  <div className="flex items-center gap-2">
                    {s.ultima_status && s.ultima_status !== 'recebido' && (
                      <Badge variant={STATUS_BADGE[s.ultima_status]}>{STATUS_LABEL[s.ultima_status]}</Badge>
                    )}
                    <Badge variant="outline">{PROV_LABEL(s.provedor)}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Pasta: <span className="text-foreground">{s.pasta_nome || s.pasta_ref}</span>
                  </span>
                  <span>
                    Criado em: <span className="text-foreground">{formatDateTime(s.criado_em || '')}</span>
                  </span>
                  <span>
                    Envios: <span className="text-foreground">{s.submissoes}</span>
                  </span>
                  <span>
                    Arquivos: <span className="text-foreground">{s.arquivos}</span>
                  </span>
                  {s.ultima_submissao && (
                    <span>
                      Ultimo envio: <span className="text-foreground">{formatDateTime(s.ultima_submissao)}</span>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" disabled={!s.url} onClick={() => s.url && copyLink(s.url)}>
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar link
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openDetail(s.grant)}>
                    <Eye className="w-3.5 h-3.5 mr-1.5" /> Ver envios
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={deletandoGrant === s.grant}
                    onClick={() => removerLink(s.grant)}
                  >
                    {deletandoGrant === s.grant ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Excluir
                  </Button>
                  {s.submissoes > 0 && (
                    <span className="flex items-center text-xs text-emerald-600 gap-1">
                      <Check className="w-3.5 h-3.5" /> Cliente já enviou
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={urlsDialogOpen} onOpenChange={setUrlsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>URLs geradas</DialogTitle>
            <DialogDescription>
              Links públicos enviados aos clientes. Cada um pode ser copiado ou excluído (a exclusão apaga também os
              arquivos enviados no Drive/Dropbox).
            </DialogDescription>
          </DialogHeader>
          {solicitacoes.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
              Nenhum link gerado ainda.
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {solicitacoes.map((s) => (
                <div
                  key={s.grant}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-semibold">{s.nome || '(Sem nome)'}</p>
                    <code className="text-[11px] break-all text-muted-foreground">{s.url}</code>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" disabled={!s.url} onClick={() => s.url && copyLink(s.url)}>
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deletandoGrant === s.grant}
                      onClick={() => removerLink(s.grant)}
                    >
                      {deletandoGrant === s.grant ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={detalheGrant !== null}
        onOpenChange={(open) => {
          if (!open) setDetalheGrant(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detalhe?.nome || 'Envio do cliente'}</DialogTitle>
            <DialogDescription>
              {detalhe && (
                <>
                  {PROV_LABEL(detalhe.provedor)} · Pasta {detalhe.pasta_nome || detalhe.pasta_ref}
                  {detalhe.url && (
                    <>
                      {' · '}
                      <button
                        type="button"
                        className="underline underline-offset-2 font-medium"
                        onClick={() => detalhe.url && copyLink(detalhe.url)}
                      >
                        Copiar link do cliente
                      </button>
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {loadingDetalhe ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : !detalhe || detalhe.submissoes.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
              Nenhum envio até agora.
            </div>
          ) : (
            <div className="space-y-4">
              {detalhe.submissoes.map((sub, i) => (
                <div key={sub.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <span className="font-semibold">
                        Envio {i + 1} de {detalhe.submissoes.length}
                      </span>
                      <span className="text-muted-foreground"> · {formatDateTime(sub.criado_em)}</span>
                    </div>
                    <Badge variant={STATUS_BADGE[sub.status]}>{STATUS_LABEL[sub.status]}</Badge>
                  </div>

                  {Object.values(sub.campos).some((v) => (v || '').trim() !== '') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                      {Object.entries(sub.campos)
                        .filter(([, v]) => (v || '').trim() !== '')
                        .map(([key, value]) => (
                          <div key={key}>
                            <span className="text-muted-foreground">{CAMPO_LABEL[key] || key}: </span>
                            <span className="text-foreground whitespace-pre-wrap">{value}</span>
                          </div>
                        ))}
                    </div>
                  )}

                  {sub.arquivos.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {sub.arquivos.map((arq) => (
                        <div
                          key={`${sub.id}-${arq.nome}`}
                          className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-2 pr-3"
                        >
                          {arq.preview ? (
                            <a href={arq.preview} target="_blank" rel="noopener noreferrer" title={arq.nome}>
                              <img src={arq.preview} alt={arq.nome} className="w-16 h-16 rounded object-cover" />
                            </a>
                          ) : (
                            <div className="w-16 h-16 rounded bg-background border border-border flex items-center justify-center">
                              <FileText className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="space-y-0.5">
                            <p className="text-xs font-medium max-w-[200px] truncate" title={arq.nome}>
                              {arq.nome}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatBytes(arq.tamanho)}
                              {arq.tipo ? ` · ${arq.tipo}` : ''}
                            </p>
                            {arq.download && (
                              <a
                                href={arq.download}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary inline-flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" /> Baixar / visualizar
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {sub.status !== 'finalizado' && (
                    <div className="flex flex-wrap gap-2">
                      {sub.status === 'recebido' && (
                        <Button
                          size="sm"
                          onClick={() => aplicarStatus(sub.id, 'produzindo')}
                          disabled={busyStatus !== null}
                        >
                          {busyStatus === `${sub.id}:produzindo` ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <PlayCircle className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Produzir
                        </Button>
                      )}
                      {sub.status === 'produzindo' && (
                        <Button
                          size="sm"
                          onClick={() => aplicarStatus(sub.id, 'finalizado')}
                          disabled={busyStatus !== null}
                        >
                          {busyStatus === `${sub.id}:finalizado` ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Finalizar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => aplicarStatus(sub.id, 'recusado')}
                        disabled={busyStatus !== null}
                      >
                        {busyStatus === `${sub.id}:recusado` ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Recusar e excluir
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setDetalheGrant(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}