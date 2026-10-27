import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Send } from 'lucide-react';
import {
  Alert,
  AlertDescription,
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
} from '@evoapi/design-system';
import { metaLeadFormsService, MetaLeadSubmissionDetail } from '@/services/admin/metaLeadFormsService';
import { metaLeadPageSettingsService } from '@/services/admin/metaLeadPageSettingsService';
import { metaConversionLeadsService, SendToMetaCrmResult } from '@/services/admin/metaConversionLeadsService';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadgenId: string | null;
  pageId: string;
  onUpdated?: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  unmapped_form: 'Sem formulário mapeado',
  processed: 'Processado',
  error: 'Erro',
};

const Row = ({ label, value }: { label: string; value?: string | number | null }) =>
  value === null || value === undefined || value === '' ? null : (
    <div className="flex justify-between gap-3 py-1 text-xs border-b border-border/50 last:border-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right break-all">{value}</span>
    </div>
  );

// Painel de "todas as colunas adicionais" do lead que não vêm da Graph API
// (não cabem na tabela de LeadFormLeadsDialog) — campanha/conjunto/anúncio
// como id puro, contato/card ligados no CRM, qualificação, e os dois campos
// editáveis (status da submissão + fase do card, quando existir um card).
// Busca sob demanda (não teria sentido buscar isso pra cada lead da lista
// inteira, só quando alguém pede os detalhes de um específico).
export default function MetaLeadSubmissionDetailDialog({ open, onOpenChange, leadgenId, pageId, onUpdated }: Props) {
  const [detail, setDetail] = useState<MetaLeadSubmissionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [stageId, setStageId] = useState('');

  // Envio manual pro Conversion Leads da Meta — independente de existir
  // MetaLeadSubmission no banco (funciona até pra lead de formulário
  // notify_only, que nunca persiste nada). Nunca grava nada aqui: cada
  // clique em "Enviar" é uma chamada isolada à Graph API, sem criar/
  // atualizar nenhum registro no nosso banco.
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [eventName, setEventName] = useState('Lead');
  const [datasetIds, setDatasetIds] = useState<string[]>(['']);
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<SendToMetaCrmResult[] | null>(null);

  useEffect(() => {
    if (!open || !leadgenId) return;
    setLoading(true);
    setNotFound(false);
    setDetail(null);
    setSendResults(null);
    setEmail('');
    setPhone('');
    setEventName('Lead');
    setDatasetIds(['']);
    metaLeadFormsService
      .getSubmission(leadgenId)
      .then((data) => {
        setDetail(data);
        setStatus(data.status);
        setStageId(data.pipeline_stage_id || '');
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    if (pageId) {
      metaLeadPageSettingsService
        .get(pageId)
        .then((settings) => {
          if (settings.dataset_ids.length > 0) setDatasetIds(settings.dataset_ids);
        })
        .catch(() => undefined);
    }
  }, [open, leadgenId, pageId]);

  const updateDatasetId = (index: number, value: string) => {
    setDatasetIds((prev) => prev.map((d, i) => (i === index ? value : d)));
  };
  const addDatasetId = () => setDatasetIds((prev) => [...prev, '']);
  const removeDatasetId = (index: number) => setDatasetIds((prev) => prev.filter((_, i) => i !== index));

  const handleSendToMeta = async () => {
    if (!leadgenId) return;
    const validDatasetIds = datasetIds.map((d) => d.trim()).filter(Boolean);
    if (validDatasetIds.length === 0) {
      toast.error('Informe ao menos um dataset.');
      return;
    }
    setSending(true);
    setSendResults(null);
    try {
      const results = await metaConversionLeadsService.sendToMetaCrm({
        leadgen_id: leadgenId,
        dataset_ids: validDatasetIds,
        event_name: eventName.trim() || 'Lead',
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setSendResults(results);
    } catch {
      toast.error('Falha ao enviar pro Meta.');
    } finally {
      setSending(false);
    }
  };

  const handleSave = async () => {
    if (!leadgenId || !detail) return;
    setSaving(true);
    try {
      const payload: { status?: string; pipeline_stage_id?: string } = {};
      if (status !== detail.status) payload.status = status;
      if (stageId && stageId !== detail.pipeline_stage_id) payload.pipeline_stage_id = stageId;
      if (Object.keys(payload).length === 0) {
        onOpenChange(false);
        return;
      }
      const updated = await metaLeadFormsService.updateSubmission(leadgenId, payload);
      setDetail(updated);
      toast.success('Lead atualizado.');
      onUpdated?.();
      onOpenChange(false);
    } catch {
      toast.error('Falha ao salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do lead</DialogTitle>
          <DialogDescription>Colunas que não aparecem na tabela, mais status e fase editáveis.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {(notFound || !detail) && (
              <p className="text-sm text-muted-foreground py-2 text-center">
                Esse lead ainda não passou pelo CRM (sem formulário mapeado na hora em que chegou, formulário "só
                notificar", ou é anterior a essa integração) — sem colunas extras do CRM, mas o envio manual pro
                Meta abaixo funciona do mesmo jeito.
              </p>
            )}
            {detail && (
              <>
            <div>
              <Label className="text-xs mb-1 block">Status da submissão</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {detail.pipeline_item_id && (
              <div>
                <Label className="text-xs mb-1 block">Fase do card ({detail.pipeline_name})</Label>
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(detail.available_stages || []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="rounded-md border border-border p-3">
              <Row label="Contato" value={detail.contact_name} />
              <Row label="Telefone (CRM)" value={detail.contact_phone} />
              <Row label="E-mail (CRM)" value={detail.contact_email} />
              <Row label="Pipeline" value={detail.pipeline_name} />
              <Row label="Qualidade do lead" value={detail.lead_quality} />
              <Row label="Nota do lead" value={detail.lead_score} />
              <Row label="Objeção" value={detail.lead_objection} />
              <Row label="Observação" value={detail.lead_observation} />
              <Row label="Notificado por WhatsApp em" value={detail.notified_whatsapp_at} />
              <Row label="Campaign ID" value={detail.campaign_id} />
              <Row label="Adset ID" value={detail.adset_id} />
              <Row label="Ad ID" value={detail.ad_id} />
              <Row label="Page ID" value={detail.page_id} />
              <Row label="Form ID" value={detail.form_id} />
              <Row label="Leadgen ID" value={detail.leadgen_id} />
              {detail.error_message && <Row label="Erro" value={detail.error_message} />}
            </div>
              </>
            )}

            <div className="rounded-md border border-border p-3 space-y-3">
              <p className="text-sm font-medium">Enviar pro Meta (Conversion Leads)</p>
              <p className="text-xs text-muted-foreground">
                Preencha e aperte Enviar — manda na hora, não salva nada no CRM. Dataset(s) pré-preenchido com o
                padrão da Página (editável).
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">E-mail</Label>
                  <Input value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder="opcional" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefone</Label>
                  <Input value={phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)} placeholder="opcional" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nome do evento</Label>
                <Input value={eventName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEventName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Dataset(s)</Label>
                {datasetIds.map((d, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={d}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateDatasetId(index, e.target.value)}
                      placeholder="ID do dataset (Events Manager > Conversion Leads)"
                    />
                    {datasetIds.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeDatasetId(index)} className="shrink-0 text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addDatasetId} className="w-full">
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar dataset
                </Button>
              </div>

              <Button onClick={handleSendToMeta} disabled={sending} className="w-full">
                <Send className="w-4 h-4 mr-1.5" /> {sending ? 'Enviando...' : 'Enviar pro Meta'}
              </Button>

              {sendResults && (
                <div className="space-y-1.5">
                  {sendResults.map((r, i) => (
                    <Alert key={i} variant={r.success ? 'default' : 'destructive'} className="py-2">
                      <AlertDescription className="text-xs">
                        <span className="font-mono">{r.dataset_id}</span>: {r.success ? 'Enviado com sucesso' : r.error}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Fechar
          </Button>
          {detail && (
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
