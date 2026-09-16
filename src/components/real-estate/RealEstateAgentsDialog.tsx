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
  Checkbox,
} from '@evoapi/design-system';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { adminConfigService } from '@/services/admin/adminConfigService';
import { getAgentsKanbanStats, type AgentKanbanStats } from '@/services/realEstate/realEstateAgentsService';
import { RealEstateAgentLeadsDialog } from './RealEstateAgentLeadsDialog';

export interface OpeningHours {
  open: string;
  close: string;
  closed: boolean;
}

// Mesma convenção de chave de dia usada em Unidade.horarios (OrganizationDataPage.tsx)
// e no back-end (Public::RealEstate::AgentAssignmentService::WEEKDAY_KEYS).
export type WeekdayKey = 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab';

export interface RealEstateAgent {
  id: string;
  name: string;
  identification: string;
  business_hours: Record<WeekdayKey, OpeningHours>;
  phone: string;
  email: string;
  status: 'active' | 'paused';
}

const CONFIG_TYPE = 'real_estate';
const CONFIG_KEY = 'REAL_ESTATE_AGENTS';

const WEEKDAYS: Array<{ key: WeekdayKey; label: string }> = [
  { key: 'seg', label: 'Seg' },
  { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' },
  { key: 'sex', label: 'Sex' },
  { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
];

// Nomes por extenso pro checklist do formulário (a tabela usa a versão
// abreviada de WEEKDAYS acima, que já cabe melhor na coluna).
const WEEKDAYS_FULL: Array<{ key: WeekdayKey; label: string }> = [
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
];

function defaultBusinessHours(): RealEstateAgent['business_hours'] {
  return {
    seg: { open: '09:00', close: '18:00', closed: false },
    ter: { open: '09:00', close: '18:00', closed: false },
    qua: { open: '09:00', close: '18:00', closed: false },
    qui: { open: '09:00', close: '18:00', closed: false },
    sex: { open: '09:00', close: '18:00', closed: false },
    sab: { open: '09:00', close: '13:00', closed: true },
    dom: { open: '09:00', close: '13:00', closed: true },
  };
}

// Resumo curto pra caber na coluna da tabela — não precisa ser exaustivo,
// só dar uma ideia rápida sem abrir o corretor pra editar.
function summarizeHours(hours: RealEstateAgent['business_hours']): string {
  const openDays = WEEKDAYS.filter((d) => !hours[d.key]?.closed);
  if (openDays.length === 0) return 'Fechado';

  const first = openDays[0];
  const sameSchedule = openDays.every(
    (d) => hours[d.key].open === hours[first.key].open && hours[d.key].close === hours[first.key].close,
  );
  const range = sameSchedule ? `${hours[first.key].open}–${hours[first.key].close}` : 'horários variados';

  if (openDays.length === 7) return `Todos os dias, ${range}`;

  const indices = openDays.map((d) => WEEKDAYS.findIndex((w) => w.key === d.key));
  const isConsecutive = indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1);
  if (isConsecutive) return `${first.label} a ${openDays[openDays.length - 1].label}, ${range}`;
  return `${openDays.map((d) => d.label).join('/')}, ${range}`;
}

function safeParseAgents(raw: unknown): RealEstateAgent[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Normaliza registros antigos/incompletos — evita quebrar a grade de
    // horário se `business_hours` vier ausente ou num formato inesperado.
    return parsed.map((a) => ({
      ...a,
      business_hours:
        a?.business_hours && typeof a.business_hours === 'object' && !Array.isArray(a.business_hours)
          ? { ...defaultBusinessHours(), ...a.business_hours }
          : defaultBusinessHours(),
    }));
  } catch {
    return [];
  }
}

const emptyAgent = (): RealEstateAgent => ({
  id: crypto.randomUUID(),
  name: '',
  identification: '',
  business_hours: defaultBusinessHours(),
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
  const [kanbanStats, setKanbanStats] = useState<Record<string, AgentKanbanStats>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formAgent, setFormAgent] = useState<RealEstateAgent | null>(null);
  const [isNewAgent, setIsNewAgent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RealEstateAgent | null>(null);
  const [leadsAgent, setLeadsAgent] = useState<RealEstateAgent | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    adminConfigService
      .getConfig(CONFIG_TYPE)
      .then((config) => setAgents(safeParseAgents(config[CONFIG_KEY])))
      .catch(() => toast.error('Erro ao carregar corretores'))
      .finally(() => setLoading(false));
    // Melhor esforço: se essa chamada falhar, a tabela só mostra "—" na
    // coluna do Kanban, sem travar o carregamento da lista de corretores.
    getAgentsKanbanStats()
      .then(setKanbanStats)
      .catch(() => setKanbanStats({}));
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
    setFormAgent({ ...agent, business_hours: { ...agent.business_hours } });
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

  const updateFormDay = (day: WeekdayKey, updates: Partial<OpeningHours>) => {
    if (!formAgent) return;
    setFormAgent({
      ...formAgent,
      business_hours: { ...formAgent.business_hours, [day]: { ...formAgent.business_hours[day], ...updates } },
    });
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
                    <th className="px-3 py-2">Telefone</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Ativo</th>
                    <th className="px-3 py-2">Horários</th>
                    <th className="px-3 py-2">Identificação</th>
                    <th className="px-3 py-2">Kanban</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => {
                    const stats = kanbanStats[agent.id];
                    return (
                      <tr key={agent.id} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{agent.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{agent.phone || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{agent.email || '—'}</td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => handleToggleStatus(agent)} disabled={saving}>
                            <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                              {agent.status === 'active' ? 'Ativo' : 'Pausado'}
                            </Badge>
                          </button>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {summarizeHours(agent.business_hours)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{agent.identification || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {stats ? (
                            <button
                              type="button"
                              onClick={() => setLeadsAgent(agent)}
                              className="text-left hover:underline"
                              title="Ver leads deste corretor"
                            >
                              <div className="font-medium text-primary">
                                {stats.total} lead{stats.total === 1 ? '' : 's'}
                              </div>
                              <div className="text-[0.65rem] text-muted-foreground">
                                {stats.stages.map((s) => `${s.name}: ${s.count}`).join(' · ')}
                              </div>
                            </button>
                          ) : (
                            '—'
                          )}
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
                    );
                  })}
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
        <DialogContent className="sm:max-w-xl">
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
              <div className="space-y-1.5">
                <Label>Horário de atendimento</Label>
                <p className="text-xs text-muted-foreground">
                  Usado pela distribuição automática de leads quando "respeitar horário" está
                  ativo (Organização &gt; Imobiliária).
                </p>
                <div className="space-y-1.5">
                  {WEEKDAYS_FULL.map(({ key, label }) => {
                    const day = formAgent.business_hours[key];
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <Checkbox
                          checked={!day.closed}
                          onCheckedChange={(checked) => updateFormDay(key, { closed: !checked })}
                        />
                        <span className="w-20 shrink-0 text-sm">{label}</span>
                        <Input
                          type="time"
                          value={day.open}
                          disabled={day.closed}
                          onChange={(e) => updateFormDay(key, { open: e.target.value })}
                          className="h-8 w-28"
                        />
                        <span className="text-xs text-muted-foreground">até</span>
                        <Input
                          type="time"
                          value={day.close}
                          disabled={day.closed}
                          onChange={(e) => updateFormDay(key, { close: e.target.value })}
                          className="h-8 w-28"
                        />
                      </div>
                    );
                  })}
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

      <RealEstateAgentLeadsDialog agent={leadsAgent} onOpenChange={(o) => !o && setLeadsAgent(null)} />
    </>
  );
}
