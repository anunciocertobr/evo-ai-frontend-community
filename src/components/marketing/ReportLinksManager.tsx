import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Checkbox,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@evoapi/design-system';
import {
  reportLinksService,
  fetchMetaAdAccounts,
  VALIDITY_OPTIONS,
  type ReportLink,
  type ReportType,
} from '@/services/marketing/reportLinksService';

/**
 * Teto espelhando ReportSnapshot::MAX_AD_ACCOUNTS. Validamos aqui para dar
 * erro na hora, mas quem garante é o backend — este aviso é conveniência,
 * não proteção.
 */
const MAX_ACCOUNTS = 12;

interface Props {
  reportType: ReportType;
  defaultTitle?: string;
}

/**
 * Gerador de link público de relatório.
 *
 * Fica montado nas telas de conteúdo do Dashboard (a "Relatórios" entre
 * elas) em vez de dentro do relatório em si: o conteúdo de Relatórios é um
 * HTML de 130 KB salvo por usuário, que o dono edita à mão. Um botão
 * injetado nele desapareceria na primeira edição do item, então o botão vive
 * no wrapper React da página.
 */
export default function ReportLinksManager({ reportType, defaultTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ReportLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState(defaultTitle ?? '');
  const [validDays, setValidDays] = useState('30');
  const [selected, setSelected] = useState<string[]>([]);
  const [includeGoogle, setIncludeGoogle] = useState(false);
  const [includeGa4, setIncludeGa4] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      setLinks(await reportLinksService.list());
    } catch {
      setError('Não foi possível carregar os links.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadLinks();
    // Contas vêm da Graph API (mesma lista da tela de Relatórios) — não das
    // metas de cliente, que só conhecem as contas já cadastradas em meta.
    fetchMetaAdAccounts()
      .then(list => {
        setAccounts(list);
        setAccountsError(null);
      })
      .catch(() => {
        setAccounts([]);
        setAccountsError('Não foi possível carregar as contas de anúncio.');
      });
  }, [open, loadLinks]);

  const options = useMemo(
    () => accounts.map(a => ({ value: a.id, label: `${a.name} (${a.id})` })),
    [accounts],
  );

  const toggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(0, MAX_ACCOUNTS),
    );
  };

  const handleCreate = async () => {
    if (selected.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      await reportLinksService.create({
        title: title.trim() || `Relatório (${selected.length} conta(s))`,
        validDays: Number(validDays),
        adAccountIds: selected,
        reportType,
        includeGoogleAds: includeGoogle,
        includeGa4: includeGa4,
      });
      setTitle('');
      setSelected([]);
      await loadLinks();
    } catch (e) {
      setError(extractError(e));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await reportLinksService.revoke(id);
      await loadLinks();
    } catch {
      setError('Não foi possível revogar o link.');
    }
  };

  const copy = async (link: ReportLink) => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError('Não foi possível copiar. Selecione e copie manualmente.');
    }
  };

  const mine = links.filter(l => l.report_type === reportType);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Link2 className="mr-2 h-4 w-4" />
        Compartilhar relatório
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Compartilhar relatório</DialogTitle>
            <DialogDescription>
              Gere um link que abre sem login. Quem tiver o link vê somente as contas que você
              marcar, e o link para de funcionar na validade escolhida ou quando for revogado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rl-title">Nome do link</Label>
              <Input
                id="rl-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Relatório do cliente X"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rl-valid">Validade</Label>
              <Select value={validDays} onValueChange={setValidDays}>
                <SelectTrigger id="rl-valid">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALIDITY_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Contas de anúncio que o cliente pode ver</Label>
              {accountsError && <p className="text-sm text-destructive">{accountsError}</p>}
              {!accountsError && options.length === 0 && (
                <p className="text-sm text-muted-foreground">Carregando contas…</p>
              )}
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
                {options.map(o => (
                  <label key={o.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selected.includes(o.value)}
                      onCheckedChange={() => toggle(o.value)}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selected.length} selecionada(s) — máximo {MAX_ACCOUNTS}.
              </p>
            </div>

            {reportType === 'ads_reports' && (
              <div className="space-y-2">
                <Label>Incluir também</Label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={includeGoogle}
                    onCheckedChange={v => setIncludeGoogle(v === true)}
                  />
                  <span>Google Ads</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={includeGa4} onCheckedChange={v => setIncludeGa4(v === true)} />
                  <span>GA4 (tráfego)</span>
                </label>
                <p className="text-xs text-muted-foreground">
                  Google Ads e GA4 são integração de conta única: entram inteiros ou não entram.
                </p>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="space-y-2">
              <Label>Links</Label>
              {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
              {!loading && mine.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum link ainda.</p>
              )}
              {mine.map(l => (
                <div key={l.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{l.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{l.url}</div>
                  </div>
                  <Badge variant={l.usable ? 'default' : 'secondary'}>
                    {l.revoked_at ? 'revogado' : l.usable ? `${l.days_left}d` : 'expirado'}
                  </Badge>
                  {l.usable && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => copy(l)}>
                        {copiedId === l.id ? 'Copiado' : 'Copiar link'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleRevoke(l.id)}>
                        Revogar
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleCreate} disabled={creating || selected.length === 0}>
              {creating ? 'Criando…' : 'Criar link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function extractError(e: unknown): string {
  const anyE = e as { response?: { data?: { errors?: string[]; error?: string } } };
  const payload = anyE?.response?.data;
  if (Array.isArray(payload?.errors) && payload.errors.length > 0)
    return payload.errors.join(' · ');
  if (payload?.error) return payload.error;
  return 'Não foi possível criar o link.';
}
