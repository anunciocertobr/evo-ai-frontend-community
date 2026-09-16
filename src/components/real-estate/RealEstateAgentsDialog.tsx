import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Badge,
  Switch,
} from '@evoapi/design-system';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { adminConfigService } from '@/services/admin/adminConfigService';

export interface RealEstateAgent {
  id: string;
  name: string;
  identification: string;
  business_hours: string;
  phone: string;
  email: string;
  status: 'active' | 'paused';
}

const CONFIG_TYPE = 'real_estate';
const CONFIG_KEY = 'REAL_ESTATE_AGENTS';

function safeParseAgents(raw: unknown): RealEstateAgent[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const emptyAgent = (): RealEstateAgent => ({
  id: crypto.randomUUID(),
  name: '',
  identification: '',
  business_hours: '',
  phone: '',
  email: '',
  status: 'active',
});

interface RealEstateAgentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RealEstateAgentsDialog({ open, onOpenChange }: RealEstateAgentsDialogProps) {
  const [agents, setAgents] = useState<RealEstateAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formAgent, setFormAgent] = useState<RealEstateAgent | null>(null);
  const [isNewAgent, setIsNewAgent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RealEstateAgent | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    adminConfigService
      .getConfig(CONFIG_TYPE)
      .then((config) => setAgents(safeParseAgents(config[CONFIG_KEY])))
      .catch(() => toast.error('Erro ao carregar corretores'))
      .finally(() => setLoading(false));
  }, [open]);

  const persist = async (next: RealEstateAgent[]) => {
    setSaving(true);
    try {
      await adminConfigService.saveConfig(CONFIG_TYPE, { [CONFIG_KEY]: JSON.stringify(next) });
      setAgents(next);
      return true;
    } catch {
      toast.error('Erro ao salvar corretores');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setFormAgent(emptyAgent());
    setIsNewAgent(true);
  };

  const openEdit = (agent: RealEstateAgent) => {
    setFormAgent({ ...agent });
    setIsNewAgent(false);
  };

  const handleSaveForm = async () => {
    if (!formAgent) return;
    if (!formAgent.name.trim()) {
      toast.error('Informe o nome do corretor');
      return;
    }
    const next = isNewAgent
      ? [...agents, formAgent]
      : agents.map((a) => (a.id === formAgent.id ? formAgent : a));
    const ok = await persist(next);
    if (ok) {
      toast.success(isNewAgent ? 'Corretor adicionado' : 'Corretor atualizado');
      setFormAgent(null);
    }
  };

  const handleToggleStatus = (agent: RealEstateAgent) => {
    const next = agents.map((a) =>
      a.id === agent.id ? { ...a, status: (a.status === 'active' ? 'paused' : 'active') as RealEstateAgent['status'] } : a,
    );
    persist(next);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const next = agents.filter((a) => a.id !== confirmDelete.id);
    const ok = await persist(next);
    if (ok) toast.success('Corretor removido');
    setConfirmDelete(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Corretores
            </DialogTitle>
            <DialogDescription>
              Corretores cadastrados aqui ficam disponíveis para atendimento dos leads do site de
              imóveis.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" /> Adicionar corretor
            </Button>
          </div>

          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-8">Carregando...</div>
          ) : agents.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8 border border-dashed rounded-md">
              Nenhum corretor cadastrado ainda.
            </div>
          ) : (
            <div className="border rounded-md overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Identificação</th>
                    <th className="px-3 py-2">Horário</th>
                    <th className="px-3 py-2">Telefone</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{agent.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{agent.identification || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{agent.business_hours || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{agent.phone || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{agent.email || '—'}</td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => handleToggleStatus(agent)} disabled={saving}>
                          <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                            {agent.status === 'active' ? 'Ativo' : 'Pausado'}
                          </Badge>
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(agent)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmDelete(agent)}
                          title="Excluir"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form de criação/edição de corretor */}
      <Dialog open={Boolean(formAgent)} onOpenChange={(o) => !o && setFormAgent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isNewAgent ? 'Novo corretor' : 'Editar corretor'}</DialogTitle>
          </DialogHeader>
          {formAgent && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={formAgent.name}
                  onChange={(e) => setFormAgent({ ...formAgent, name: e.target.value })}
                  placeholder="Nome do corretor"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Número de identificação (CRECI)</Label>
                <Input
                  value={formAgent.identification}
                  onChange={(e) => setFormAgent({ ...formAgent, identification: e.target.value })}
                  placeholder="Ex: CRECI 123456-F"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Horário de atendimento</Label>
                <Input
                  value={formAgent.business_hours}
                  onChange={(e) => setFormAgent({ ...formAgent, business_hours: e.target.value })}
                  placeholder="Ex: Seg a Sex, 9h às 18h"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input
                    value={formAgent.phone}
                    onChange={(e) => setFormAgent({ ...formAgent, phone: e.target.value })}
                    placeholder="55 11 91234-1234"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formAgent.email}
                    onChange={(e) => setFormAgent({ ...formAgent, email: e.target.value })}
                    placeholder="corretor@empresa.com"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <Label>Status</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {formAgent.status === 'active' ? 'Ativo' : 'Pausado'}
                  </span>
                  <Switch
                    checked={formAgent.status === 'active'}
                    onCheckedChange={(checked) =>
                      setFormAgent({ ...formAgent, status: checked ? 'active' : 'paused' })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormAgent(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveForm} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <Dialog open={Boolean(confirmDelete)} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir corretor</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir "{confirmDelete?.name}"? Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={saving}>
              {saving ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
