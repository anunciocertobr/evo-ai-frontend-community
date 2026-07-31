import { Button } from '@evoapi/design-system';
import { ArrowLeft, Save, Loader2, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { getAgentTypeLabel } from '@/utils/agents';

interface AgentEditHeaderProps {
  onBack: () => void;
  onSave: () => void;
  onTestAgent?: () => void;
  isDirty: boolean;
  isSaving: boolean;
  agentName?: string;
  agentType?: string;
}

const AgentEditHeader = ({
  onBack,
  onSave,
  onTestAgent,
  isDirty,
  isSaving,
  agentName,
  agentType,
}: AgentEditHeaderProps) => {
  const { t } = useLanguage('aiAgents');

  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-[#ECEEF2] bg-white px-6">
      <Button
        variant="ghost"
        onClick={onBack}
        className="h-auto gap-2 px-2 py-0 text-sm font-semibold text-[#4A5157] hover:bg-transparent hover:text-[#1A211E]"
      >
        <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
        {t('actions.back') || 'Voltar'}
      </Button>

      {agentName && (
        <div className="flex min-w-0 items-center gap-3 px-4 py-[14px]">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[11px] border border-[#DCF0E4] bg-[#F0FAF4]">
            <span className="text-base font-extrabold text-[#359558]">
              {agentName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-bold text-[#1A211E]">{agentName}</p>
            <p className="truncate text-xs font-normal text-[#9AA3A0]">
              {getAgentTypeLabel(agentType || 'llm', t)}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-[14px]">
        {onTestAgent && (
          <Button
            variant="outline"
            onClick={onTestAgent}
            className="h-auto gap-2 rounded-[9px] border-[#D7DCE3] bg-white px-4 py-[9px] text-sm font-semibold text-[#3A423F]"
          >
            <MessageSquare className="h-4 w-4" />
            {t('actions.testAgent') || 'Teste seu agente'}
          </Button>
        )}
        <Button
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className="h-auto gap-2 rounded-[9px] bg-[#359558] px-5 py-[9px] text-sm font-semibold text-white hover:bg-[#2C834E] disabled:opacity-55"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('messages.saving') || 'Salvando...'}
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {t('actions.save') || 'Salvar'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default AgentEditHeader;
