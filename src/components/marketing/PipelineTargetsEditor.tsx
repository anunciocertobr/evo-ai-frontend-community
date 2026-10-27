import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@evoapi/design-system';
import { toast } from 'sonner';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import type { Pipeline, PipelineStage } from '@/types/analytics';

export interface PipelineTargetRow {
  pipeline_id: string;
  pipeline_stage_id: string;
}

interface Props {
  pipelines: Pipeline[];
  value: PipelineTargetRow[];
  onChange: (rows: PipelineTargetRow[]) => void;
}

// Lista de pares Pipeline+Estágio, com botão "+" pra mandar pra mais de um
// ao mesmo tempo — extraído de MetaLeadFormsSettingsPage (modal "Mapear
// formulário") pra ser reaproveitado também no padrão por Página (mesma
// escolha, só que valendo pra todos os formulários dela de uma vez).
export function PipelineTargetsEditor({ pipelines, value, onChange }: Props) {
  const [stagesByPipelineId, setStagesByPipelineId] = useState<Record<string, PipelineStage[]>>({});
  const [loadingStagesFor, setLoadingStagesFor] = useState<string | null>(null);

  const loadStagesFor = async (pipelineId: string) => {
    if (!pipelineId || stagesByPipelineId[pipelineId]) return;
    setLoadingStagesFor(pipelineId);
    try {
      const pipeline = await pipelinesService.getPipeline(pipelineId);
      setStagesByPipelineId((prev) => ({ ...prev, [pipelineId]: pipeline.stages || [] }));
    } catch {
      toast.error('Falha ao buscar os estágios desse Pipeline.');
    } finally {
      setLoadingStagesFor(null);
    }
  };

  // Linhas já preenchidas (editando um padrão existente) precisam dos
  // estágios do pipeline delas carregados de cara, não só quando o usuário
  // troca a seleção.
  useEffect(() => {
    value.forEach((row) => {
      if (row.pipeline_id) loadStagesFor(row.pipeline_id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (index: number, patch: Partial<PipelineTargetRow>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handlePipelineChange = (index: number, pipelineId: string) => {
    update(index, { pipeline_id: pipelineId, pipeline_stage_id: '' });
    loadStagesFor(pipelineId);
  };

  const add = () => onChange([...value, { pipeline_id: '', pipeline_stage_id: '' }]);
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      {value.map((row, index) => (
        <div key={index} className="flex items-end gap-2 rounded-lg border p-2.5">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Pipeline</Label>
            <Select value={row.pipeline_id} onValueChange={(v) => handlePipelineChange(index, v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Estágio</Label>
            <Select
              value={row.pipeline_stage_id}
              onValueChange={(v) => update(index, { pipeline_stage_id: v })}
              disabled={!row.pipeline_id || loadingStagesFor === row.pipeline_id}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingStagesFor === row.pipeline_id ? 'Carregando...' : 'Selecione...'} />
              </SelectTrigger>
              <SelectContent>
                {(stagesByPipelineId[row.pipeline_id] || []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="sm" onClick={() => remove(index)} className="shrink-0 text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="w-full">
        <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar pipeline
      </Button>
    </div>
  );
}
