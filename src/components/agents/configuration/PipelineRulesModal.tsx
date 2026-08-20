import { useLanguage } from '@/hooks/useLanguage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
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
  // CRM-213: persist without leaving the modal. Edits reach the parent live via
  // onChange, but they were only written to the backend by the agent's OUTER Save —
  // closing the modal lost them. onSave runs that same save (AgentEditPage#handleSave)
  // and resolves to `false` on failure so the modal stays open. Optional so the modal
  // still renders if a caller does not wire it (then Save just closes).
  onSave?: () => Promise<boolean> | boolean | void;
  isSaving?: boolean;
}

export const PipelineRulesModal = ({
  open,
  onOpenChange,
  rules,
  onChange,
  availablePipelines,
  onSave,
  isSaving = false,
}: PipelineRulesModalProps) => {
  const { t } = useLanguage('aiAgents');

  const handleSaveClick = async () => {
    if (!onSave) {
      onOpenChange(false);
      return;
    }
    const result = await onSave();
    // Keep the modal open only when the save explicitly reported failure.
    if (result !== false) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `sm:max-w-*`/`sm:text-*` and not the plain utilities: tailwind-merge only cancels
          a responsive variant with another responsive variant. */}
      <DialogContent className="max-h-[90vh] gap-3 overflow-y-auto p-5 sm:max-w-[820px]">
        <DialogHeader className="sm:text-center">
          <DialogTitle className="text-xl font-bold text-foreground">
            {t('edit.configuration.pipelineRules.modalTitle') || 'Regras de Pipeline'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
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
        <DialogFooter className="gap-2 border-t pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            {t('edit.configuration.pipelineRules.close') || 'Fechar'}
          </Button>
          <Button onClick={handleSaveClick} disabled={isSaving}>
            {isSaving
              ? t('edit.configuration.pipelineRules.saving') || 'Salvando...'
              : t('edit.configuration.pipelineRules.save') || 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
