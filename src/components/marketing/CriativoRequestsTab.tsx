import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronRight,
  Cloud,
  Copy,
  Folder,
  HardDrive,
  Home,
  Link2,
  Loader2,
  RefreshCw,
  Send,
} from 'lucide-react';
import { Button, Badge, Input } from '@evoapi/design-system';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { formatDateTime } from '@/utils/time';
import { mediaLibraryService, type MediaEntry, type MediaProvider } from '@/services/marketing/mediaLibraryService';
import {
  criativoRequestsService,
  type CriativoLink,
  type CriativoProvider,
  type CriativoSolicitacao,
  type CriativoStatus,
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
          <Button size="sm" variant="ghost" onClick={loadSolicitacoes} disabled={loadingSolicitacoes} title="Atualizar">
            <RefreshCw className={`w-4 h-4 ${loadingSolicitacoes ? 'animate-spin' : ''}`} />
          </Button>
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
                  <Badge variant="outline">{PROV_LABEL(s.provedor)}</Badge>
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
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={!s.url} onClick={() => s.url && copyLink(s.url)}>
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar link
                  </Button>
                  {s.submissoes > 0 && (
                    <span className="flex items-center text-xs text-emerald-600 gap-1">
                      <Check className="w-3.5 h-3.5" /> Cliente ja enviou
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}