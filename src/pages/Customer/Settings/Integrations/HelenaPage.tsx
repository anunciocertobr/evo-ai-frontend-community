import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MessageSquare, Plus, Loader2, Pencil } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@evoapi/design-system';
import IntegrationBackButton from '@/components/integrations/shared/IntegrationBackButton';
import HelenaModal from '@/components/integrations/providers/helena/HelenaModal';
import { integrationsService } from '@/services/integrations';
import { IntegrationHook } from '@/types/integrations';

// Helena permite mais de uma conta conectada (allow_multiple_hooks: true,
// ver apps.yml) — diferente da maioria das integrações de token (que usam
// GenericIntegrationSettings, feito só pra 1 hook por app_id). Pedido do
// usuário: "tenho mais de uma conta da helena entao em integraçoes tem
// que da pra adicionar mais de um". Lista cada conta + botão "+" no
// topo, mesmo espírito da tela de MCCs do Google Ads (GoogleAdsPage),
// só sem fluxo OAuth — aqui é colar token direto.
export default function HelenaPage() {
  const navigate = useNavigate();
  const [hooks, setHooks] = useState<IntegrationHook[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHook, setEditingHook] = useState<IntegrationHook | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IntegrationHook | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await integrationsService.getIntegrationHooks('helena');
      setHooks(items);
    } catch {
      toast.error('Erro ao carregar as contas Helena conectadas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditingHook(undefined);
    setModalOpen(true);
  };

  const openEdit = (hook: IntegrationHook) => {
    setEditingHook(hook);
    setModalOpen(true);
  };

  const handleSubmit = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (editingHook) {
        await integrationsService.updateIntegrationHook(editingHook.id, data);
        toast.success('Conta Helena atualizada.');
      } else {
        await integrationsService.createIntegrationHook('helena', data);
        toast.success('Conta Helena conectada.');
      }
      setModalOpen(false);
      await load();
    } catch {
      toast.error('Erro ao salvar a conta Helena.');
      throw new Error('save failed');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await integrationsService.deleteIntegrationHook(deleteTarget.id);
      toast.success('Conta Helena desconectada.');
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error('Erro ao desconectar a conta.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none p-4 pb-0">
        <div className="flex items-center gap-4 mb-6">
          <IntegrationBackButton onBack={() => navigate('/settings/integrations')} />
          <div className="flex items-center gap-3 flex-1">
            <MessageSquare className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Helena (WTS)</h1>
              <p className="text-muted-foreground text-sm">
                Importa contatos com dados de origem de campanha (Meta/Instagram), exibidos em Marketing &gt;
                Rastreamentos &gt; Externo. Conecte quantas contas precisar.
              </p>
            </div>
          </div>
          <Button onClick={openNew} className="shrink-0">
            <Plus className="w-4 h-4 mr-2" /> Adicionar conta
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 mt-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : hooks.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Nenhuma conta Helena conectada ainda. Clique em &quot;Adicionar conta&quot; acima.
            </CardContent>
          </Card>
        ) : (
          <div className="max-w-xl space-y-3">
            {hooks.map((hook) => (
              <Card key={hook.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{(hook.settings?.label as string) || `Conta ${hook.id.slice(0, 8)}`}</p>
                    <p className="text-xs text-muted-foreground">Token configurado</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(hook)}>
                      <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(hook)}>
                      Remover
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <HelenaModal
        hook={editingHook}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleSubmit}
        isNew={!editingHook}
        loading={saving}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar conta Helena?</DialogTitle>
            <DialogDescription>
              {(deleteTarget?.settings?.label as string) || 'Esta conta'} deixará de aparecer no seletor da aba
              Externo de Rastreamentos. Os contatos já importados não são apagados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Removendo...' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
