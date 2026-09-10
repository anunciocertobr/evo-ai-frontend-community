import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Target,
  Building2,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  Power,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
} from '@evoapi/design-system';
import { BaseHeader } from '@/components/base';
import {
  clientGoalsService,
  ClientGoal,
  ClientGoalFormData,
  ClientGoalObjective,
  ClientGoalAdAccount,
  ClientGoalChangelogEntry,
  ObjectiveType,
  ChangelogLevel,
  OBJECTIVE_TYPE_OPTIONS,
  SALES_CHANNEL_OPTIONS,
  CHANGELOG_LEVEL_OPTIONS,
} from '@/services/marketing/clientGoalsService';

const emptyObjective = (): ClientGoalObjective => ({
  key: `novo-${Math.random().toString(36).slice(2)}`,
  objective_type: 'mensagens',
  custom_label: '',
  budget: null,
  target_result_daily: null,
  target_result_weekly: null,
  target_result_monthly: null,
  cost_margin_daily_min: null,
  cost_margin_daily_max: null,
  cost_margin_weekly_min: null,
  cost_margin_weekly_max: null,
  cost_margin_monthly_min: null,
  cost_margin_monthly_max: null,
});

const emptyForm = (): ClientGoalFormData => ({
  name: '',
  segment: '',
  sales_channel: '',
  meta_budget: null,
  active: true,
  ad_accounts: [{ id: '', name: '' }],
  objectives: [emptyObjective()],
  changelog: [],
});

const objectiveLabel = (o: ClientGoalObjective) =>
  o.objective_type === 'outro'
    ? o.custom_label || 'Outro'
    : OBJECTIVE_TYPE_OPTIONS.find((opt) => opt.value === o.objective_type)?.label || o.objective_type;

const money = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function ObservationBadge({ objective }: { objective: ClientGoalObjective }) {
  const status = objective.status;
  if (!status || !status.trackable) {
    return (
      <Badge variant="outline" className="gap-1 text-slate-500">
        <MinusCircle className="h-3 w-3" /> Sem acompanhamento automático
      </Badge>
    );
  }
  if (status.days_out_of_margin > 0) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" /> {status.observation}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800">
      <CheckCircle2 className="h-3 w-3" /> {status.observation}
    </Badge>
  );
}

export default function ClientGoalsPage() {
  const [goals, setGoals] = useState<ClientGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientGoalFormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClientGoal | null>(null);
  const [newChangeEntry, setNewChangeEntry] = useState<ClientGoalChangelogEntry>({
    change_date: new Date().toISOString().slice(0, 10),
    level: 'conta',
    reference_name: '',
    description: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clientGoalsService.list(true);
      setGoals(data);
    } catch (error) {
      console.error('ClientGoalsPage.load error:', error);
      toast.error('Erro ao carregar a lista de clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setNewChangeEntry({ change_date: new Date().toISOString().slice(0, 10), level: 'conta', reference_name: '', description: '' });
    setDialogOpen(true);
  };

  const openEdit = (goal: ClientGoal) => {
    setEditingId(goal.id);
    setForm({
      name: goal.name,
      segment: goal.segment || '',
      sales_channel: goal.sales_channel || '',
      meta_budget: goal.meta_budget,
      active: goal.active,
      ad_accounts: goal.ad_accounts.length ? goal.ad_accounts : [{ id: '', name: '' }],
      objectives: goal.objectives.length ? goal.objectives : [emptyObjective()],
      changelog: goal.changelog,
    });
    setNewChangeEntry({ change_date: new Date().toISOString().slice(0, 10), level: 'conta', reference_name: '', description: '' });
    setDialogOpen(true);
  };

  const updateAdAccount = (index: number, field: keyof ClientGoalAdAccount, value: string) => {
    setForm((prev) => {
      const list = [...prev.ad_accounts];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, ad_accounts: list };
    });
  };

  const addAdAccount = () => setForm((prev) => ({ ...prev, ad_accounts: [...prev.ad_accounts, { id: '', name: '' }] }));

  const removeAdAccount = (index: number) =>
    setForm((prev) => ({ ...prev, ad_accounts: prev.ad_accounts.filter((_, i) => i !== index) }));

  const updateObjective = (index: number, patch: Partial<ClientGoalObjective>) => {
    setForm((prev) => {
      const list = [...prev.objectives];
      list[index] = { ...list[index], ...patch };
      return { ...prev, objectives: list };
    });
  };

  const addObjective = () => setForm((prev) => ({ ...prev, objectives: [...prev.objectives, emptyObjective()] }));

  const removeObjective = (index: number) =>
    setForm((prev) => ({ ...prev, objectives: prev.objectives.filter((_, i) => i !== index) }));

  const addChangelogEntry = () => {
    if (!newChangeEntry.description.trim()) {
      toast.error('Descreva a mudança antes de adicionar.');
      return;
    }
    setForm((prev) => ({ ...prev, changelog: [newChangeEntry, ...prev.changelog] }));
    setNewChangeEntry({ change_date: new Date().toISOString().slice(0, 10), level: 'conta', reference_name: '', description: '' });
  };

  const removeChangelogEntry = (index: number) =>
    setForm((prev) => ({ ...prev, changelog: prev.changelog.filter((_, i) => i !== index) }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Informe o nome do cliente.');
      return;
    }
    const cleanedAdAccounts = form.ad_accounts.filter((a) => a.id.trim());
    if (!cleanedAdAccounts.length) {
      toast.error('Informe ao menos uma conta de anúncio.');
      return;
    }
    const invalidObjective = form.objectives.find((o) => o.objective_type === 'outro' && !o.custom_label?.trim());
    if (invalidObjective) {
      toast.error('Todo objetivo "Outro" precisa de um rótulo.');
      return;
    }

    setSaving(true);
    try {
      const payload: ClientGoalFormData = { ...form, ad_accounts: cleanedAdAccounts };
      if (editingId) {
        await clientGoalsService.update(editingId, payload);
        toast.success('Cliente atualizado.');
      } else {
        await clientGoalsService.create(payload);
        toast.success('Cliente cadastrado.');
      }
      setDialogOpen(false);
      load();
    } catch (error) {
      console.error('ClientGoalsPage.handleSave error:', error);
      toast.error('Erro ao salvar. Confira os campos e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (goal: ClientGoal) => {
    try {
      await clientGoalsService.update(goal.id, { ...goal, active: !goal.active });
      toast.success(goal.active ? 'Cliente pausado.' : 'Cliente reativado.');
      load();
    } catch (error) {
      console.error('ClientGoalsPage.handleToggleActive error:', error);
      toast.error('Erro ao atualizar status.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await clientGoalsService.remove(deleteTarget.id);
      toast.success('Cliente removido.');
      setDeleteTarget(null);
      load();
    } catch (error) {
      console.error('ClientGoalsPage.handleDelete error:', error);
      toast.error('Erro ao remover.');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <BaseHeader
        title="Metas de Clientes"
        subtitle="Contas de anúncio, objetivos, orçamentos e metas de custo por resultado — com acompanhamento automático de quantos dias cada objetivo está fora da meta."
        primaryAction={{ label: 'Novo Cliente', icon: <Plus className="h-4 w-4" />, onClick: openCreate }}
      />

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : goals.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum cliente cadastrado ainda.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {goals.map((goal) => (
              <Card key={goal.id} className={!goal.active ? 'opacity-60' : ''}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Target className="h-4 w-4" /> {goal.name}
                      {!goal.active && <Badge variant="outline">Pausado</Badge>}
                    </CardTitle>
                    <p className="mt-1 text-xs text-slate-500">
                      {goal.segment || 'Sem segmento'} · Fecha venda: {goal.sales_channel || 'não informado'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" title={goal.active ? 'Pausar' : 'Reativar'} onClick={() => handleToggleActive(goal)}>
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(goal)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(goal)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-1 text-xs">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    {goal.ad_accounts.map((a) => (
                      <Badge key={a.id} variant="outline">
                        {a.name || a.id} ({a.id})
                      </Badge>
                    ))}
                    <span className="ml-auto font-medium">Orçamento Meta: {money(goal.meta_budget)}</span>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    {goal.objectives.map((o) => (
                      <div key={o.key} className="flex flex-col gap-1 rounded-md border p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{objectiveLabel(o)}</span>
                          <span className="text-slate-500">Orçamento: {money(o.budget)}</span>
                        </div>
                        <ObservationBadge objective={o} />
                      </div>
                    ))}
                  </div>
                  {goal.changelog.length > 0 && (
                    <>
                      <Separator />
                      <div className="text-xs">
                        <p className="mb-1 font-medium text-slate-500">Últimas mudanças</p>
                        {goal.changelog.slice(0, 2).map((c, idx) => (
                          <p key={idx} className="text-slate-500">
                            {c.change_date} — [{c.level}] {c.reference_name ? `${c.reference_name}: ` : ''}
                            {c.description}
                          </p>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
            <DialogDescription>
              Configure segmento, contas de anúncio, objetivos com orçamento/metas e o histórico de mudanças.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Nome do Cliente</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: Burger House" />
              </div>
              <div>
                <Label>Segmento</Label>
                <Input
                  value={form.segment || ''}
                  onChange={(e) => setForm((p) => ({ ...p, segment: e.target.value }))}
                  placeholder="Ex: Hamburgueria / Delivery"
                />
              </div>
              <div>
                <Label>Onde fecha venda?</Label>
                <Select value={form.sales_channel || ''} onValueChange={(v) => setForm((p) => ({ ...p, sales_channel: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SALES_CHANNEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Orçamento Total pra Meta (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.meta_budget ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, meta_budget: e.target.value === '' ? null : Number(e.target.value) }))}
                />
              </div>
            </div>

            <Separator />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-sm font-semibold">Contas de Anúncio</Label>
                <Button size="sm" variant="outline" onClick={addAdAccount} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Adicionar Conta
                </Button>
              </div>
              <div className="space-y-2">
                {form.ad_accounts.map((acc, index) => (
                  <div key={index} className="flex gap-2">
                    <Input placeholder="ID da conta (act_...)" value={acc.id} onChange={(e) => updateAdAccount(index, 'id', e.target.value)} />
                    <Input placeholder="Nome da conta" value={acc.name} onChange={(e) => updateAdAccount(index, 'name', e.target.value)} />
                    <Button size="icon" variant="ghost" onClick={() => removeAdAccount(index)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-sm font-semibold">Objetivos a Trabalhar</Label>
                <Button size="sm" variant="outline" onClick={addObjective} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Adicionar Objetivo
                </Button>
              </div>
              <div className="space-y-4">
                {form.objectives.map((obj, index) => (
                  <Card key={obj.key || index}>
                    <CardContent className="space-y-3 pt-4">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <Label>Tipo de Objetivo</Label>
                          <Select
                            value={obj.objective_type}
                            onValueChange={(v) => updateObjective(index, { objective_type: v as ObjectiveType })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {OBJECTIVE_TYPE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {obj.objective_type === 'outro' && (
                          <div className="flex-1">
                            <Label>Rótulo do Objetivo</Label>
                            <Input value={obj.custom_label || ''} onChange={(e) => updateObjective(index, { custom_label: e.target.value })} />
                          </div>
                        )}
                        <div className="w-40">
                          <Label>Orçamento (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={obj.budget ?? ''}
                            onChange={(e) => updateObjective(index, { budget: e.target.value === '' ? null : Number(e.target.value) })}
                          />
                        </div>
                        <Button size="icon" variant="ghost" className="mt-6" onClick={() => removeObjective(index)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>

                      {obj.objective_type === 'seguidores' || obj.objective_type === 'outro' ? (
                        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-700">
                          A API do Meta não expõe esse resultado diretamente nos Insights — este objetivo fica registrado, mas o
                          acompanhamento automático de "dias fora da meta" não é calculado para ele.
                        </p>
                      ) : null}

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {(
                          [
                            { key: 'daily', label: 'Diário' },
                            { key: 'weekly', label: 'Semanal' },
                            { key: 'monthly', label: 'Mensal' },
                          ] as const
                        ).map((period) => (
                          <div key={period.key} className="space-y-1 rounded-md border p-2">
                            <p className="text-xs font-semibold text-slate-500">{period.label}</p>
                            <Label className="text-xs">Meta de Resultado</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={(obj[`target_result_${period.key}` as keyof ClientGoalObjective] as number) ?? ''}
                              onChange={(e) =>
                                updateObjective(index, {
                                  [`target_result_${period.key}`]: e.target.value === '' ? null : Number(e.target.value),
                                })
                              }
                            />
                            <Label className="text-xs">Custo por Resultado — Margem Aceita (R$)</Label>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Mín"
                                value={(obj[`cost_margin_${period.key}_min` as keyof ClientGoalObjective] as number) ?? ''}
                                onChange={(e) =>
                                  updateObjective(index, {
                                    [`cost_margin_${period.key}_min`]: e.target.value === '' ? null : Number(e.target.value),
                                  })
                                }
                              />
                              <span className="text-xs text-slate-400">até</span>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Máx"
                                value={(obj[`cost_margin_${period.key}_max` as keyof ClientGoalObjective] as number) ?? ''}
                                onChange={(e) =>
                                  updateObjective(index, {
                                    [`cost_margin_${period.key}_max`]: e.target.value === '' ? null : Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {editingId && obj.status && (
                        <div className="pt-1">
                          <ObservationBadge objective={obj} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-semibold">Mudanças na Conta / Campanha / Conjunto / Anúncio</Label>
              <p className="mb-2 text-xs text-slate-500">
                Registre mudanças feitas (ex: aumento de orçamento, pausa de campanha, troca de criativo) com a data — ajuda a
                explicar variações de resultado depois.
              </p>
              <div className="mb-3 grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-4">
                <Input
                  type="date"
                  value={newChangeEntry.change_date}
                  onChange={(e) => setNewChangeEntry((p) => ({ ...p, change_date: e.target.value }))}
                />
                <Select value={newChangeEntry.level} onValueChange={(v) => setNewChangeEntry((p) => ({ ...p, level: v as ChangelogLevel }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANGELOG_LEVEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Nome (opcional)"
                  value={newChangeEntry.reference_name || ''}
                  onChange={(e) => setNewChangeEntry((p) => ({ ...p, reference_name: e.target.value }))}
                />
                <Button variant="outline" className="gap-1" onClick={addChangelogEntry}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
                <Textarea
                  className="sm:col-span-4"
                  placeholder="O que mudou?"
                  value={newChangeEntry.description}
                  onChange={(e) => setNewChangeEntry((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto text-xs">
                {form.changelog.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-md border p-2">
                    <span>
                      {c.change_date} — [{c.level}] {c.reference_name ? `${c.reference_name}: ` : ''}
                      {c.description}
                    </span>
                    <Button size="icon" variant="ghost" onClick={() => removeChangelogEntry(idx)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove "{deleteTarget?.name}" e todo o histórico de acompanhamento automático dele. Essa ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
