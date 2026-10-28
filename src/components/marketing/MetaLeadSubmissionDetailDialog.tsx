import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@evoapi/design-system';
import { metaLeadFormsService, MetaLeadSubmissionDetail } from '@/services/admin/metaLeadFormsService';
import { MetaCrmSendForm } from './MetaCrmSendForm';

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

  // Pré-preenchimento do formulário manual (MetaCrmSendForm) com o que o
  // CRM já sabe do lead — só existe quando a submissão foi persistida
  // (mode: pipeline); notify_only não tem de onde puxar, o componente
  // deixa os campos em branco pro usuário preencher na mão.
  const [initialEmail, setInitialEmail] = useState<string | null>(null);
  const [initialPhone, setInitialPhone] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !leadgenId) return;
    setLoading(true);
    setNotFound(false);
    setDetail(null);
    setInitialEmail(null);
    setInitialPhone(null);
    metaLeadFormsService
      .getSubmission(leadgenId)
      .then((data) => {
        setDetail(data);
        setStatus(data.status);
        setStageId(data.pipeline_stage_id || '');
        setInitialEmail(data.contact_email);
        setInitialPhone(data.contact_phone);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [open, leadgenId]);

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

            {leadgenId && (
              <MetaCrmSendForm leadgenId={leadgenId} pageId={pageId} initialEmail={initialEmail} initialPhone={initialPhone} />
            )}
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
