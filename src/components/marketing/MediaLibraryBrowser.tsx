import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronRight,
  Cloud,
  File as FileIcon,
  Film,
  Folder,
  FolderPlus,
  HardDrive,
  Home,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button, Input } from '@evoapi/design-system';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { mediaLibraryService, type MediaEntry, type MediaKind, type MediaProvider } from '@/services/marketing/mediaLibraryService';

const PROVIDER_STORAGE_KEY = 'media-library-provider';
const MAX_PICK_MB = 40;

const PROVIDERS: Array<{ key: MediaProvider; label: string; icon: typeof HardDrive }> = [
  { key: 'drive', label: 'Google Drive', icon: HardDrive },
  { key: 'dropbox', label: 'Dropbox', icon: Cloud },
];

interface Crumb {
  ref: string;
  name: string;
}

function loadProvider(): MediaProvider {
  try {
    const stored = localStorage.getItem(PROVIDER_STORAGE_KEY);
    return stored === 'dropbox' ? 'dropbox' : 'drive';
  } catch {
    return 'drive';
  }
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function KindIcon({ kind }: { kind: MediaKind }) {
  const cls = 'w-8 h-8 text-slate-500';
  if (kind === 'folder') return <Folder className="w-8 h-8 text-sky-400" />;
  if (kind === 'image') return <ImageIcon className={cls} />;
  if (kind === 'video') return <Film className={cls} />;
  return <FileIcon className={cls} />;
}

function Thumb({ entry }: { entry: MediaEntry }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (entry.kind === 'image' || entry.kind === 'video') {
      mediaLibraryService.thumbnail(entry).then((url) => alive && setSrc(url));
    }
    return () => {
      alive = false;
    };
  }, [entry]);

  if (src) return <img src={src} alt={entry.name} className="w-full h-full object-cover" />;
  return <KindIcon kind={entry.kind} />;
}

interface Props {
  // manage: gerenciar (criar pasta, subir, excluir). pick: escolher um arquivo
  // pra usar como criativo — devolve um File pronto pro fluxo de upload.
  mode: 'manage' | 'pick';
  onPick?: (file: File) => void;
}

export function MediaLibraryBrowser({ mode, onPick }: Props) {
  const [provider, setProvider] = useState<MediaProvider>(loadProvider);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ ref: '', name: 'Raiz' }]);
  const [entries, setEntries] = useState<MediaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newFolderName, setNewFolderName] = useState<string | null>(null);
  const [pickingRef, setPickingRef] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const location = crumbs[crumbs.length - 1].ref;

  const load = useCallback(async (prov: MediaProvider, loc: string) => {
    setLoading(true);
    try {
      const isConnected = await mediaLibraryService.getStatus(prov);
      setConnected(isConnected);
      if (!isConnected) {
        setEntries([]);
        return;
      }
      setEntries(await mediaLibraryService.list(prov, loc));
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao carregar a biblioteca.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(provider, location);
  }, [provider, location, load]);

  const switchProvider = (next: MediaProvider) => {
    if (next === provider) return;
    try {
      localStorage.setItem(PROVIDER_STORAGE_KEY, next);
    } catch {
      /* preferência é só conveniência */
    }
    setProvider(next);
    setCrumbs([{ ref: '', name: 'Raiz' }]);
    setNewFolderName(null);
  };

  const openFolder = (entry: MediaEntry) => setCrumbs((prev) => [...prev, { ref: entry.ref, name: entry.name }]);

  const handleCreateFolder = async () => {
    const name = newFolderName?.trim();
    if (!name) return;
    setBusy(true);
    try {
      await mediaLibraryService.createFolder(provider, location, name);
      toast.success('Pasta criada.');
      setNewFolderName(null);
      await load(provider, location);
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao criar pasta.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        await mediaLibraryService.upload(provider, location, file);
      }
      toast.success(files.length > 1 ? `${files.length} arquivos enviados.` : 'Arquivo enviado.');
      await load(provider, location);
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao enviar arquivo.');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (entry: MediaEntry) => {
    if (!window.confirm(`Excluir "${entry.name}"?`)) return;
    try {
      await mediaLibraryService.remove(entry);
      toast.success('Excluído.');
      await load(provider, location);
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao excluir.');
    }
  };

  const handlePick = async (entry: MediaEntry) => {
    if (!onPick) return;
    if (entry.size && entry.size > MAX_PICK_MB * 1024 * 1024) {
      toast.error(`Arquivo grande demais (${formatSize(entry.size)}) — limite de ${MAX_PICK_MB}MB.`);
      return;
    }
    setPickingRef(entry.ref);
    try {
      onPick(await mediaLibraryService.download(entry));
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Não foi possível baixar o arquivo.');
    } finally {
      setPickingRef(null);
    }
  };

  const visibleEntries = mode === 'pick' ? entries.filter((e) => e.kind === 'folder' || e.kind === 'image' || e.kind === 'video') : entries;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {PROVIDERS.map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              size="sm"
              variant={provider === key ? 'default' : 'outline'}
              onClick={() => switchProvider(key)}
            >
              <Icon className="w-4 h-4 mr-1.5" /> {label}
            </Button>
          ))}
        </div>
        {connected && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => load(provider, location)} disabled={loading} title="Atualizar">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setNewFolderName('')} disabled={busy}>
              <FolderPlus className="w-4 h-4 mr-1.5" /> Nova pasta
            </Button>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />} Enviar
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>
        )}
      </div>

      {connected === false ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {provider === 'drive' ? 'Google Drive' : 'Dropbox'} não está conectado.{' '}
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
                    onClick={() => setCrumbs((prev) => prev.slice(0, i + 1))}
                  >
                    {i === 0 && <Home className="w-3.5 h-3.5" />} {crumb.name}
                  </button>
                )}
              </span>
            ))}
          </nav>

          {newFolderName !== null && (
            <div className="flex items-center gap-2 max-w-sm">
              <Input
                autoFocus
                value={newFolderName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFolderName(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') setNewFolderName(null);
                }}
                placeholder="Nome da pasta (ex: Criativos Setembro)"
              />
              <Button size="sm" onClick={handleCreateFolder} disabled={busy || !newFolderName.trim()}>
                Criar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNewFolderName(null)}>
                Cancelar
              </Button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : visibleEntries.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
              Pasta vazia. Envie imagens ou vídeos, ou crie uma subpasta.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {visibleEntries.map((entry) => {
                const isFolder = entry.kind === 'folder';
                const picking = pickingRef === entry.ref;
                return (
                  <div key={`${entry.provider}:${entry.ref}`} className="group relative rounded-lg border border-border bg-card overflow-hidden">
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => (isFolder ? openFolder(entry) : mode === 'pick' ? handlePick(entry) : undefined)}
                      disabled={picking || (!isFolder && mode === 'manage')}
                    >
                      <div className="h-28 bg-muted/40 flex items-center justify-center overflow-hidden">
                        {picking ? <Loader2 className="w-6 h-6 animate-spin" /> : <Thumb entry={entry} />}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-medium truncate" title={entry.name}>
                          {entry.name}
                        </p>
                        <p className="text-[0.7rem] text-muted-foreground">
                          {isFolder ? 'Pasta' : entry.kind === 'video' ? 'Vídeo' : entry.kind === 'image' ? 'Imagem' : 'Arquivo'}
                          {entry.size ? ` · ${formatSize(entry.size)}` : ''}
                        </p>
                      </div>
                    </button>
                    {mode === 'pick' && !isFolder && (
                      <span className="absolute top-1.5 right-1.5 rounded-full bg-primary text-primary-foreground p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                    {mode === 'manage' && (
                      <button
                        type="button"
                        title="Excluir"
                        onClick={() => handleDelete(entry)}
                        className="absolute top-1.5 right-1.5 rounded-md bg-background/90 p-1 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
