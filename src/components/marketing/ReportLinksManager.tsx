import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, Loader2, Copy, Check, Ban } from 'lucide-react';
import { toast } from 'sonner';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
  Badge,
} from '@evoapi/design-system';
import type { ClientGoal } from '@/services/marketing/clientGoalsService';
import reportLinksService, {
  ReportLink,
  VALIDITY_OPTIONS,
} from '@/services/marketing/reportLinksService';

const FIELD_CLASS = 'h-9';

interface AccountOption {
  id: string;
  label: string;
}

/**
 * O backend devolve a URL absoluta quando FRONTEND_URL está no ambiente; se
 * não estiver, devolve só o caminho e a gente completa com a origem do próprio
 * navegador — o link funciona nos dois casos.
 */
const absoluteUrl = (url: string) =>
  /^https?:\/\//i.test(url) ? url : `${window.location.origin}${url}`;

const linkStatus = (link: ReportLink) => {
  if (link.revoked_at) return { label: 'Revogado', className: 'bg-red-100 text-red-800' };
  if (!link.usable)
    return { label: 'Expirado', className: 'bg-muted text-muted-foreground' };
  return {
    label: link.days_left <= 1 ? 'Expira hoje' : `Ativo · ${link.days_left}d`,
    className: 'bg-green-100 text-green-800',
  };
};

interface ReportLinksManagerProps {
  goals: ClientGoal[];
}

const ReportLinksManager = ({ goals }: ReportLinksManagerProps) => {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ReportLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [validDays, setValidDays] = useState('30');
  const [selected, setSelected] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Contas de anúncio de todas as metas — é exatamente o universo que o
  // backend aceita, então não há como escolher algo inválido aqui.
  const accountOptions = useMemo<AccountOption[]>(() => {
    const seen = new Map<string, string>();
    goals.forEach((goal) => {
      goal.ad_accounts?.forEach((account) => {
        const id = (account.id || '').trim();
        if (!id || seen.has(id)) return;
        seen.set(id, `${goal.name} — ${account.name || 'sem nome'} (${id})`);
      });
    });
    return Array.from(seen, ([id, label]) => ({ id, label }));
  }, [goals]);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      setLinks(await reportLinksService.list());
    } catch {
      toast.error('Não foi possível carregar os links.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadLinks();
  }, [open, loadLinks]);

  const toggleAccount = (id: string) => {
    setSelected((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    );
  };

  const handleCreate = async () => {
    if (selected.length === 0) {
      toast.error('Selecione ao menos uma conta de anúncio.');
      return;
    }
    setCreating(true);
    try {
      await reportLinksService.create({
        title: title.trim() || `Relatório (${selected.length} conta(s))`,
        validDays: Number(validDays),
        adAccountIds: selected,
      });
      toast.success('Link criado. Copie e envie para o cliente.');
      setTitle('');
      setSelected([]);
      await loadLinks();
    } catch (error: unknown) {
      const response = (error as { response?: { data?: { errors?: string[] } } })?.response;
      toast.error(response?.data?.errors?.join(' ') || 'Erro ao criar o link.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await reportLinksService.revoke(id);
      toast.success('Link revogado.');
      await loadLinks();
    } catch {
      toast.error('Não foi possível revogar o link.');
    }
  };

  const handleCopy = async (link: ReportLink) => {
    try {
      await navigator.clipboard.writeText(absoluteUrl(link.url));
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Não foi possível copiar. Copie manualmente da lista.');
    }
  };

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
              Gere um link que abre sem login. Quem tiver o link vê somente as contas de anúncio
              marcadas abaixo, e o link para de funcionar na validade escolhida ou quando for
              revogado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="report-link-title">Nome do link</Label>
                <Input
                  id="report-link-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Relatório do cliente X"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-link-validity">Válido por</Label>
                <Select value={validDays} onValueChange={setValidDays}>
                  <SelectTrigger id="report-link-validity" className={FIELD_CLASS}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALIDITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Contas de anúncio visíveis</Label>
              {accountOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma conta de anúncio cadastrada ainda.
                </p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-border p-3">
                  {accountOptions.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selected.includes(option.id)}
                        onCheckedChange={() => toggleAccount(option.id)}
                      />
                      <span className="text-foreground">{option.label}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {selected.length} conta(s) selecionada(s).
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleCreate} disabled={creating || accountOptions.length === 0}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gerar link
              </Button>
            </DialogFooter>

            <div className="space-y-2 border-t border-border pt-4">
              <Label>Links gerados</Label>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : links.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum link gerado ainda.</p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {links.map((link) => {
                    const status = linkStatus(link);
                    return (
                      <div
                        key={link.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-foreground">
                              {link.title}
                            </span>
                            <Badge className={status.className}>{status.label}</Badge>
                          </div>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {absoluteUrl(link.url)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(link)}
                            aria-label="Copiar link"
                          >
                            {copiedId === link.id ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          {!link.revoked_at && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevoke(link.id)}
                              aria-label="Revogar link"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReportLinksManager;