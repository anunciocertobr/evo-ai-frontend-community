import { useLanguage } from '@/hooks/useLanguage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@evoapi/design-system';
import PipelineRules, { PipelineRule } from '@/pages/Customer/Agents/Agent/sections/PipelineRules';

interface PipelineRulesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: PipelineRule[];
  onChange: (rules: PipelineRule[]) => void;
  availablePipelines?: Array<{
    id: string;
    name: string;
    stages: Array<{ id: string; name: string }>;
  }>;
}

export const PipelineRulesModal = ({
  open,
  onOpenChange,
  rules,
  onChange,
  availablePipelines,
}: PipelineRulesModalProps) => {
  const { t } = useLanguage('aiAgents');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `sm:max-w-*`/`sm:text-*`: a base do DialogContent traz `sm:max-w-lg` e a do
          DialogHeader `sm:text-left`. Variantes responsivas não colidem com os
          utilitários simples no tailwind-merge — o `sm:` do pacote vencia acima de
          640px, e era daí que vinha o modal estreito com rolagem. */}
      <DialogContent className="max-h-[90vh] gap-3 overflow-y-auto p-5 sm:max-w-[820px]">
        <DialogHeader className="sm:text-center">
          <DialogTitle className="text-xl font-bold text-[#131917]">
            {t('edit.configuration.pipelineRules.modalTitle') || 'Regras de Pipeline'}
          </DialogTitle>
          <DialogDescription className="text-[#8A928F]">
            {t('edit.configuration.pipelineRules.modalDescription') ||
              'Configure quando e como o agente deve mover conversas entre pipelines e estágios.'}
          </DialogDescription>
        </DialogHeader>
        <div className="py-1">
          <PipelineRules
            rules={rules}
            onChange={onChange}
            availablePipelines={availablePipelines}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
