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
import { adminConfigService } from '@/services/admin/adminConfigService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import type { Pipeline, PipelineStage } from '@/types/analytics';

const CONFIG_TYPE = 'meta_leads_pipeline_default';
const NONE = '__none__';

interface DefaultSettings {
  [key: string]: string;
  META_LEADS_PIPELINE_ID: string;
  META_LEADS_STAGE_ID: string;
}

const DEFAULTS: DefaultSettings = {
  META_LEADS_PIPELINE_ID: '',
  META_LEADS_STAGE_ID: '',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Padrão da conta pra Meta::LeadAds::ImportService — pipeline/fase que um
// lead de formulário SEM mapeamento próprio (sem registro em
// MetaLeadFormsSettingsPage) cai por padrão, em vez de ficar preso em
// "Sem formulário mapeado" pra sempre. Mesma estrutura de
// MetaLeadsNotifyDefaultDialog, só trocando canal por pipeline/fase.
export function MetaLeadsPipelineDefaultDialog({ open, onOpenChange }: Props) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [settings, setSettings] = useState<DefaultSettings>(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([pipelinesService.getPipelines(), adminConfigService.getConfig(CONFIG_TYPE)])
      .then(async ([pipelineList, config]) => {
        setPipelines(pipelineList.data || []);
        const merged = {
          ...DEFAULTS,
          ...Object.fromEntries(Object.entries(config).filter(([, v]) => v !== null && v !== undefined)),
        } as DefaultSettings;
        setSettings(merged);
        if (merged.META_LEADS_PIPELINE_ID) {
          setLoadingStages(true);
          const pipeline = await pipelinesService.getPipeline(merged.META_LEADS_PIPELINE_ID);
          setStages(pipeline.stages || []);
          setLoadingStages(false);
        }
      })
      .catch(() => toast.error('Erro ao carregar o pipeline padrão da conta.'))
      .finally(() => setLoading(false));
  }, [open]);

  const handlePipelineChange = async (pipelineId: string) => {
    const resolved = pipelineId === NONE ? '' : pipelineId;
    setSettings((prev) => ({ ...prev, META_LEADS_PIPELINE_ID: resolved, META_LEADS_STAGE_ID: '' }));
    setStages([]);
    if (!resolved) return;
    setLoadingStages(true);
    try {
      const pipeline = await pipelinesService.getPipeline(resolved);
      setStages(pipeline.stages || []);
    } catch {
      toast.error('Falha ao buscar os estágios desse pipeline.');
    } finally {
      setLoadingStages(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminConfigService.saveConfig(CONFIG_TYPE, settings);
      toast.success('Pipeline padrão salvo!');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await adminConfigService.saveConfig(CONFIG_TYPE, DEFAULTS);
      setSettings(DEFAULTS);
      setStages([]);
      toast.success('Pipeline padrão removido — formulários sem mapeamento próprio voltam a ficar retidos.');
    } catch {
      toast.error('Erro ao limpar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pipeline padrão — leads sem formulário mapeado</DialogTitle>
          <DialogDescription>
            Vale pra todo formulário que ainda não tem um mapeamento próprio (aba Formulários). Sem isso,
            leads de formulário novo ficam retidos até alguém mapear manualmente.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-6">Carregando...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Pipeline</Label>
              <Select value={settings.META_LEADS_PIPELINE_ID || NONE} onValueChange={handlePipelineChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum (leads sem mapeamento ficam retidos)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {settings.META_LEADS_PIPELINE_ID && (
              <div>
                <Label className="text-xs">Estágio inicial</Label>
                <Select
                  value={settings.META_LEADS_STAGE_ID || undefined}
                  onValueChange={(v: string) => setSettings((prev) => ({ ...prev, META_LEADS_STAGE_ID: v }))}
                  disabled={loadingStages}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingStages ? 'Carregando...' : 'Selecione'} />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {(settings.META_LEADS_PIPELINE_ID || settings.META_LEADS_STAGE_ID) && (
            <Button variant="ghost" onClick={handleClear} disabled={saving} className="sm:mr-auto">
              Remover padrão
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading || Boolean(settings.META_LEADS_PIPELINE_ID) !== Boolean(settings.META_LEADS_STAGE_ID)}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
