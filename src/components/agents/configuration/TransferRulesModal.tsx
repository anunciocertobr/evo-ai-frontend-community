import { useLanguage } from '@/hooks/useLanguage';
import TransferRules, { TransferRule } from '@/pages/Customer/Agents/Agent/sections/TransferRules';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@evoapi/design-system';

interface TransferRulesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: TransferRule[];
  onChange: (rules: TransferRule[]) => void;
  availableUsers?: Array<{ id: string; name: string }>;
  availableTeams?: Array<{ id: string; name: string }>;
}

export const TransferRulesModal = ({
  open,
  onOpenChange,
  rules,
  onChange,
  availableUsers,
  availableTeams,
}: TransferRulesModalProps) => {
  const { t } = useLanguage('aiAgents');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `sm:max-w-*`/`sm:text-*` and not the plain utilities: tailwind-merge only cancels
          a responsive variant with another responsive variant. */}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader className="sm:text-center">
          <DialogTitle className="text-xl font-bold text-[#131917]">
            {t('edit.configuration.transferRules.modalTitle') || 'Regras de Transferência'}
          </DialogTitle>
          <DialogDescription className="text-[#8A928F]">
            {t('edit.configuration.transferRules.modalDescription') ||
              'Configure quando e como o agente deve transferir conversas para humanos ou times.'}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <TransferRules
            rules={rules}
            onChange={onChange}
            availableUsers={availableUsers}
            availableTeams={availableTeams}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
