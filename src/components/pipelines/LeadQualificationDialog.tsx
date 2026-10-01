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
  Slider,
  Textarea,
} from '@evoapi/design-system';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import type { PipelineItem } from '@/types/analytics';

export type LeadQuality = 'baixa' | 'media' | 'alta';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  item: PipelineItem | null;
  onQualified: (updated: PipelineItem) => void;
}

const QUALITY_OPTIONS: Array<{ value: LeadQuality | 'none'; label: string }> = [
  { value: 'none', label: 'Não definida' },
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
];

export default function LeadQualificationDialog({ open, onOpenChange, pipelineId, item, onQualified }: Props) {
  const [quality, setQuality] = useState<LeadQuality | 'none'>('none');
  const [score, setScore] = useState(50);
  const [objection, setObjection] = useState('');
  const [observation, setObservation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuality((item?.lead_quality as LeadQuality | null) || 'none');
    setScore(item?.lead_score ?? 50);
    setObjection(item?.lead_objection || '');
    setObservation(item?.lead_observation || '');
  }, [open, item]);

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const updated = await pipelinesService.qualifyItem(pipelineId, item.id, {
        lead_quality: quality === 'none' ? null : quality,
        lead_score: score,
        lead_objection: objection || null,
        lead_observation: observation || null,
      });
      onQualified(updated);
      toast.success('Qualificação do lead salva!');
      onOpenChange(false);
    } catch {
      toast.error('Falha ao salvar a qualificação do lead.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Qualificar Lead</DialogTitle>
          <DialogDescription>
            Avalie o potencial deste lead — usado pra priorizar atendimento e, quando configurado, pra avisar a
            Meta sobre a qualidade (ajuda a otimização de campanha).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Qualidade</Label>
            <Select value={quality} onValueChange={(v) => setQuality(v as LeadQuality | 'none')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Score do Lead</Label>
              <span className="text-sm font-medium">{score}</span>
            </div>
            <Slider value={[score]} onValueChange={(v) => setScore(v[0])} min={1} max={100} step={1} className="w-full" />
          </div>

          <div className="space-y-1.5">
            <Label>Objeção</Label>
            <Textarea
              value={objection}
              onChange={(e) => setObjection(e.target.value)}
              placeholder="O que está travando o fechamento? (ex: preço, prazo...)"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Qualquer outra nota sobre esse lead"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
