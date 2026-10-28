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
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@evoapi/design-system';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import {
  metaLeadFormsService,
  MetaLeadForm as MetaLeadFormMapping,
  MetaLeadFormMode,
} from '@/services/admin/metaLeadFormsService';
import { PipelineTargetsEditor, PipelineTargetRow } from './PipelineTargetsEditor';
import type { Pipeline } from '@/types/analytics';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  formId: string;
  formName: string;
  onSaved?: () => void;
}

// Regras de Kanban (pipeline/estágio) por formulário específico, aberto
// direto do menu "⋮" de Criação Meta — mesmo mapeamento do botão "Mapear
// formulário" de Lead Ads (Meta), só que já com página+formulário escolhidos
// (sem o seletor de BM/Página/Formulário daquela tela), igual o sininho de
// "Notificar" já faz. Reaproveita o PipelineTargetsEditor pra não duplicar o
// editor de linhas Pipeline+Estágio.
export function MetaLeadFormPipelineDialog({ open, onOpenChange, pageId, formId, formName, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [existing, setExisting] = useState<MetaLeadFormMapping | null>(null);
  const [mode, setMode] = useState<MetaLeadFormMode>('pipeline');
  const [pipelineRows, setPipelineRows] = useState<PipelineTargetRow[]>([{ pipeline_id: '', pipeline_stage_id: '' }]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([pipelinesService.getPipelines(), metaLeadFormsService.list()])
      .then(([pipelineList, mappings]) => {
        setPipelines(pipelineList.data || []);
        const current = mappings.find((m) => m.form_id === formId) || null;
        setExisting(current);
        setMode(current?.mode ?? 'pipeline');
        setPipelineRows(
          current && current.pipelines.length > 0
            ? current.pipelines.map((p) => ({ pipeline_id: p.pipeline_id, pipeline_stage_id: p.pipeline_stage_id }))
            : [{ pipeline_id: '', pipeline_stage_id: '' }],
        );
      })
      .catch(() => toast.error('Falha ao carregar o Kanban desse formulário.'))
      .finally(() => setLoading(false));
  }, [open, formId]);

  const pipelineRowsComplete = pipelineRows.every((r) => r.pipeline_id && r.pipeline_stage_id);
  const canSave = mode === 'notify_only' || (pipelineRowsComplete && pipelineRows.length > 0);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        page_id: pageId,
        form_id: formId,
        form_name: formName,
        mode,
        pipelines: mode === 'pipeline' ? pipelineRows : [],
      };
      if (existing) {
        await metaLeadFormsService.update(existing.id, payload);
      } else {
        await metaLeadFormsService.create(payload);
      }
      toast.success('Kanban desse formulário salvo! Leads retidos já foram processados.');
      onOpenChange(false);
      onSaved?.();
    } catch {
      toast.error('Falha ao salvar o Kanban desse formulário.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!existing) return;
    setSaving(true);
    try {
      await metaLeadFormsService.remove(existing.id);
      toast.success('Mapeamento removido — esse formulário volta a usar o Pipeline padrão da conta/Página.');
      onOpenChange(false);
      onSaved?.();
    } catch {
      toast.error('Falha ao remover o mapeamento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kanban deste formulário</DialogTitle>
          <DialogDescription>
            Formulário: {formName}. Regras de Pipeline/Estágio só pra ele — soma com o padrão da Página/conta, não
            substitui.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-6">Carregando...</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">O que fazer com cada lead</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as MetaLeadFormMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pipeline">Criar card no Pipeline + Contato</SelectItem>
                  <SelectItem value="notify_only">Só notificar por WhatsApp (não salva no CRM)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === 'pipeline' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Pipeline / Estágio (pode mandar pra mais de um, soma com o padrão da Página)</Label>
                <PipelineTargetsEditor pipelines={pipelines} value={pipelineRows} onChange={setPipelineRows} />
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {existing && (
            <Button variant="ghost" onClick={handleRemove} disabled={saving} className="text-destructive">
              Remover mapeamento
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || loading || !canSave}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
