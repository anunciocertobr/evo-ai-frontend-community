import { Button } from '@evoapi/design-system';
import { ArrowLeft, Save, Loader2, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

interface AgentEditHeaderProps {
  onBack: () => void;
  onSave: () => void;
  onTestAgent?: () => void;
  isDirty: boolean;
  isSaving: boolean;
  agentName?: string;
  agentType?: string;
}

const getAgentTypeLabel = (type: string, t: (key: string) => string): string => {
  const typeLabels: Record<string, string> = {
    llm: t('basicInfo.types.llm') || 'LLM',
    a2a: t('basicInfo.types.a2a') || 'A2A',
    sequential: t('basicInfo.types.sequential') || 'Sequencial',
    parallel: t('basicInfo.types.parallel') || 'Paralelo',
    loop: t('basicInfo.types.loop') || 'Loop',
    workflow: t('basicInfo.types.workflow') || 'Workflow',
    task: t('basicInfo.types.task') || 'Task',
    external: t('basicInfo.types.external') || 'Integração Externa',
  };
  return typeLabels[type] || type;
};

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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-sidebar-foreground/70 hover:text-sidebar-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('actions.back') || 'Voltar'}
        </Button>

        {agentName && (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-sidebar-accent/50 ring-1 ring-primary/40">
              <span className="text-sm font-semibold text-sidebar-foreground">
                {agentName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-sidebar-foreground">{agentName}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">
                {getAgentTypeLabel(agentType || 'llm', t)}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onTestAgent && (
          <Button variant="outline" onClick={onTestAgent} className="gap-2">
            <MessageSquare className="h-4 w-4" />
            {t('actions.testAgent') || 'Teste seu agente'}
          </Button>
        )}
        <Button onClick={onSave} disabled={!isDirty || isSaving} className="gap-2">
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
