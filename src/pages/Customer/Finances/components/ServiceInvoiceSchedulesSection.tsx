import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, Bot, Check, X, Pencil, Trash2 } from 'lucide-react';
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
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@evoapi/design-system';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { serviceInvoiceSchedulesService, serviceInvoiceScheduleConfirmationsService } from '@/services/finances/serviceInvoiceSchedulesService';
import {
  ServiceInvoiceSchedule,
  ServiceInvoiceScheduleFormData,
  ServiceInvoiceScheduleChannel,
  ServiceInvoiceScheduleConfirmation,
} from '@/types/serviceInvoiceSchedules';
import { FiscalEstablishment } from '@/types/fiscalInvoices';
import { ServicoLC116SearchButton } from '@/components/finances/ServicoLC116Autocomplete';

function currency(value: number | string): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const CHANNEL_LABELS: Record<ServiceInvoiceScheduleChannel, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  notification: 'Notificação no CRM',
};

const emptyForm = (establishmentId: string): ServiceInvoiceScheduleFormData => ({
  fiscal_establishment_id: establishmentId,
  tomador_nome: '',
  tomador_cpf_cnpj: '',
  discriminacao: '',
  codigo_servico_municipal: '',
  codigo_nbs: '',
  valor_servicos: 0,
  recurrence_type: 'monthly',
  day_of_month: 10,
  next_run_at: '',
  notify_before_value: 1,
  notify_before_unit: 'days',
  channels: ['notification'],
});

interface Props {
  establishments: FiscalEstablishment[];
}

export default function ServiceInvoiceSchedulesSection({ establishments }: Props) {
  const [schedules, setSchedules] = useState<ServiceInvoiceSchedule[]>([]);
  const [pending, setPending] = useState<ServiceInvoiceScheduleConfirmation[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ServiceInvoiceScheduleFormData>(emptyForm(''));
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<ServiceInvoiceScheduleConfirmation | null>(null);
  const [editValor, setEditValor] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const activeEstablishments = useMemo(() => establishments.filter((e) => e.active), [establishments]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [schedulesData, pendingData] = await Promise.all([
        serviceInvoiceSchedulesService.list(),
        serviceInvoiceScheduleConfirmationsService.pending(),
      ]);
      setSchedules(schedulesData);
      setPending(pendingData);
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao carregar agendamentos de NFS-e.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateDialog = () => {
    setForm(emptyForm(activeEstablishments[0]?.id || ''));
    setDialogOpen(true);
  };

  const toggleChannel = (channel: ServiceInvoiceScheduleChannel) => {
    setForm((prev) => ({
      ...prev,
      channels: prev.channels.includes(channel) ? prev.channels.filter((c) => c !== channel) : [...prev.channels, channel],
    }));
  };

  const handleSave = async () => {
    if (!form.fiscal_establishment_id) return toast.error('Selecione um estabelecimento fiscal.');
    if (!form.tomador_nome.trim() || !form.tomador_cpf_cnpj.trim()) return toast.error('Informe nome e CPF/CNPJ do tomador.');
    if (!form.discriminacao.trim() || !form.codigo_servico_municipal.trim()) return toast.error('Informe discriminação e código de serviço.');
    if (!form.codigo_nbs.trim()) return toast.error('Informe o código NBS.');
    if (!form.valor_servicos || form.valor_servicos <= 0) return toast.error('Informe um valor válido.');
    if (!form.next_run_at) return toast.error('Informe a data/hora da primeira emissão.');
    if (form.recurrence_type === 'monthly' && !form.day_of_month) return toast.error('Informe o dia do mês.');
    if (form.recurrence_type === 'weekly' && form.day_of_week === undefined) return toast.error('Informe o dia da semana.');
    if (form.channels.length === 0) return toast.error('Escolha ao menos um canal de notificação.');
    if (form.channels.includes('whatsapp') && !form.notify_whatsapp_number) return toast.error('Informe o número de WhatsApp pra notificar.');
    if (form.channels.includes('telegram') && !form.notify_telegram_chat_id) return toast.error('Informe o chat ID do Telegram pra notificar.');

    setSaving(true);
    try {
      await serviceInvoiceSchedulesService.create(form);
      toast.success('Agendamento criado.');
      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao criar agendamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (schedule: ServiceInvoiceSchedule) => {
    try {
      await serviceInvoiceSchedulesService.remove(schedule.id);
      toast.success('Agendamento removido.');
      loadData();
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao remover.');
    }
  };

  const handleConfirm = async (confirmation: ServiceInvoiceScheduleConfirmation) => {
    setProcessingId(confirmation.id);
    try {
      await serviceInvoiceScheduleConfirmationsService.confirm(confirmation.id);
      toast.success('Confirmado — a NFS-e está sendo emitida.');
      loadData();
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao confirmar.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (confirmation: ServiceInvoiceScheduleConfirmation) => {
    setProcessingId(confirmation.id);
    try {
      await serviceInvoiceScheduleConfirmationsService.decline(confirmation.id);
      toast.success('Emissão recusada pra esse ciclo.');
      loadData();
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao recusar.');
    } finally {
      setProcessingId(null);
    }
  };

  const openEditDialog = (confirmation: ServiceInvoiceScheduleConfirmation) => {
    setEditTarget(confirmation);
    setEditValor(String(confirmation.invoice_attrs.valor_servicos));
    setEditDescricao(confirmation.invoice_attrs.discriminacao);
  };

  const handleEditAndConfirm = async () => {
    if (!editTarget) return;
    setProcessingId(editTarget.id);
    try {
      await serviceInvoiceScheduleConfirmationsService.editAndConfirm(editTarget.id, {
        valor_servicos: editValor,
        discriminacao: editDescricao,
      });
      toast.success('Alterado e confirmado — a NFS-e está sendo emitida.');
      setEditTarget(null);
      loadData();
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao confirmar com alteração.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <Bot className="w-4 h-4" /> Confirmações pendentes
          </p>
          {pending.map((confirmation) => (
            <div key={confirmation.id} className="flex items-center justify-between gap-3 bg-card rounded-lg border border-border p-3">
              <div className="text-sm">
                <p className="font-medium">{confirmation.tomador_nome}</p>
                <p className="text-muted-foreground text-xs">
                  {currency(confirmation.invoice_attrs.valor_servicos)} — previsto pra{' '}
                  {new Date(confirmation.scheduled_for).toLocaleString('pt-BR')}
                </p>
                {confirmation.status !== 'notified' && (
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    aguardando resposta no chat ({confirmation.status})
                  </Badge>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" onClick={() => handleConfirm(confirmation)} disabled={processingId === confirmation.id}>
                  <Check className="w-3.5 h-3.5 mr-1" /> Confirmar
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEditDialog(confirmation)} disabled={processingId === confirmation.id}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDecline(confirmation)} disabled={processingId === confirmation.id}>
                  <X className="w-3.5 h-3.5 mr-1" /> Recusar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <p className="font-medium text-sm flex items-center gap-2">
              <Bot className="w-4 h-4" /> Emissão recorrente automática
            </p>
            <p className="text-xs text-muted-foreground">Avisa antes e só emite com sua confirmação.</p>
          </div>
          <Button size="sm" onClick={openCreateDialog} disabled={activeEstablishments.length === 0}>
            <Plus className="w-4 h-4 mr-1" /> Novo agendamento
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tomador</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Recorrência</TableHead>
              <TableHead>Próxima emissão</TableHead>
              <TableHead>Canais</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((schedule) => (
              <TableRow key={schedule.id}>
                <TableCell className="max-w-[160px] truncate">{schedule.tomador_nome}</TableCell>
                <TableCell>{currency(schedule.valor_servicos)}</TableCell>
                <TableCell className="capitalize">{schedule.recurrence_type}</TableCell>
                <TableCell>{new Date(schedule.next_run_at).toLocaleString('pt-BR')}</TableCell>
                <TableCell>{schedule.channels.map((c) => CHANNEL_LABELS[c]).join(', ')}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(schedule)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {schedules.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum agendamento criado ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo agendamento de NFS-e</DialogTitle>
            <DialogDescription>
              Avisa antes de emitir — a emissão só acontece depois que você confirmar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Estabelecimento fiscal</Label>
              <Select value={form.fiscal_establishment_id} onValueChange={(v) => setForm((p) => ({ ...p, fiscal_establishment_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {activeEstablishments.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.municipio_nome} ({e.uf})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tomador</Label>
                <Input value={form.tomador_nome} onChange={(e) => setForm((p) => ({ ...p, tomador_nome: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">CPF/CNPJ</Label>
                <Input value={form.tomador_cpf_cnpj} onChange={(e) => setForm((p) => ({ ...p, tomador_cpf_cnpj: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Discriminação do serviço</Label>
              <Textarea rows={2} value={form.discriminacao} onChange={(e) => setForm((p) => ({ ...p, discriminacao: e.target.value }))} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Cód. serviço municipal</Label>
                <div className="flex gap-1">
                  <Input value={form.codigo_servico_municipal} onChange={(e) => setForm((p) => ({ ...p, codigo_servico_municipal: e.target.value }))} />
                  <ServicoLC116SearchButton onSelect={(s) => setForm((p) => ({ ...p, codigo_servico_municipal: s.codigo }))} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Código NBS</Label>
                <Input
                  value={form.codigo_nbs}
                  maxLength={9}
                  onChange={(e) => setForm((p) => ({ ...p, codigo_nbs: e.target.value.replace(/\D/g, '') }))}
                />
              </div>
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor_servicos}
                  onChange={(e) => setForm((p) => ({ ...p, valor_servicos: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Recorrência</Label>
                <Select
                  value={form.recurrence_type}
                  onValueChange={(v) => setForm((p) => ({ ...p, recurrence_type: v as 'once' | 'monthly' | 'weekly' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Uma vez só</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.recurrence_type === 'monthly' && (
                <div>
                  <Label className="text-xs">Dia do mês</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={form.day_of_month ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, day_of_month: Number(e.target.value) }))}
                  />
                </div>
              )}
              {form.recurrence_type === 'weekly' && (
                <div>
                  <Label className="text-xs">Dia da semana</Label>
                  <Select value={String(form.day_of_week ?? 1)} onValueChange={(v) => setForm((p) => ({ ...p, day_of_week: Number(v) }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((label, idx) => (
                        <SelectItem key={idx} value={String(idx)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Data/hora da primeira emissão</Label>
              <Input
                type="datetime-local"
                value={form.next_run_at}
                onChange={(e) => setForm((p) => ({ ...p, next_run_at: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Avisar com quanto tempo de antecedência?</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.notify_before_value}
                  onChange={(e) => setForm((p) => ({ ...p, notify_before_value: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label className="text-xs">Unidade</Label>
                <Select value={form.notify_before_unit} onValueChange={(v) => setForm((p) => ({ ...p, notify_before_unit: v as 'days' | 'hours' }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Dias</SelectItem>
                    <SelectItem value="hours">Horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Canais de notificação (pode marcar mais de um)</Label>
              {(Object.keys(CHANNEL_LABELS) as ServiceInvoiceScheduleChannel[]).map((channel) => (
                <label key={channel} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.channels.includes(channel)} onCheckedChange={() => toggleChannel(channel)} />
                  {CHANNEL_LABELS[channel]}
                </label>
              ))}
            </div>

            {form.channels.includes('whatsapp') && (
              <div>
                <Label className="text-xs">Número de WhatsApp pra notificar</Label>
                <Input
                  placeholder="11999999999"
                  value={form.notify_whatsapp_number || ''}
                  onChange={(e) => setForm((p) => ({ ...p, notify_whatsapp_number: e.target.value }))}
                />
              </div>
            )}
            {form.channels.includes('telegram') && (
              <div>
                <Label className="text-xs">Chat ID do Telegram pra notificar</Label>
                <Input
                  placeholder="Fale com o bot pelo menos uma vez pra conseguir esse ID"
                  value={form.notify_telegram_chat_id || ''}
                  onChange={(e) => setForm((p) => ({ ...p, notify_telegram_chat_id: e.target.value }))}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar e confirmar emissão</DialogTitle>
            <DialogDescription>A mudança vale só pra esta vez — o agendamento recorrente não muda.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" step="0.01" value={editValor} onChange={(e) => setEditValor(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea rows={2} value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditAndConfirm} disabled={processingId === editTarget?.id}>
              Confirmar emissão com essa mudança
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
