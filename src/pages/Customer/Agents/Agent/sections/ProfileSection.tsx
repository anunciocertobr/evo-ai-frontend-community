import { useState } from 'react';
import { Button, Input, Label, Textarea } from '@evoapi/design-system';
import { Sparkles, Wand2, Loader2 } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { usePermissions } from '@/contexts/PermissionsContext';
import { openaiService } from '@/services/integrations/openaiService';
import { useGlobalConfig } from '@/contexts/GlobalConfigContext';
import { toast } from 'sonner';
import PromptGeneratorModal from '@/components/agents/wizard/PromptGeneratorModal';
import TaskSection from './TaskSection';
import { TaskConfigData } from '@/components/ai_agents/Forms/TaskConfigForm';
import { isTaskAgent } from '@/utils/agents';
import AgentSummaryPanel from '../components/AgentSummaryPanel';
import type { Agent } from '@/types/agents';

interface ProfileSectionProps {
  formData: {
    name: string;
    description: string;
    role: string;
    goal: string;
    instruction: string;
  };
  onFormDataChange: (field: string, value: string) => void;
  agentType?: string;
  taskConfigData?: TaskConfigData | null;
  onTaskConfigChange?: (data: TaskConfigData) => void;
  editingAgentId?: string;
  /** Alimentam o Resumo do Agente da coluna direita. */
  agent?: Agent;
  model?: string;
  subAgentsCount?: number;
}

const ProfileSection = ({
  formData,
  onFormDataChange,
  agentType,
  taskConfigData,
  onTaskConfigChange,
  editingAgentId,
  agent,
  model,
  subAgentsCount = 0,
}: ProfileSectionProps) => {
  const { t } = useLanguage('aiAgents');
  const { can, isReady } = usePermissions();
  const config = useGlobalConfig();
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  // Orchestrator types and external don't have role, goal, or instruction
  const isOrchestratorType = ['sequential', 'parallel', 'loop', 'task', 'external'].includes(agentType || '');

  // AI actions call the CRM integrations processor, so they demand both the
  // configured provider and the integrations.execute grant.
  const showAIActions = config.openaiConfigured === true && isReady && can('integrations', 'execute');

  const handleReview = async () => {
    if (!formData.instruction || !formData.instruction.trim()) {
      toast.error(t('wizard.promptGenerator.messages.fillPromptToReview'));
      return;
    }

    setIsReviewing(true);
    try {
      const reviewedPrompt = await openaiService.processEvent({
        type: 'review_prompt',
        content: formData.instruction,
      });

      if (reviewedPrompt) {
        onFormDataChange('instruction', reviewedPrompt);
        toast.success(t('wizard.promptGenerator.messages.reviewSuccess'));
      }
    } catch (error) {
      console.error('Error reviewing prompt:', error);
      const errorMessage =
        error instanceof Error ? error.message : t('wizard.promptGenerator.messages.reviewError');
      toast.error(errorMessage);
    } finally {
      setIsReviewing(false);
    }
  };

  // Classes da spec §4.3 — o input/textarea ocupa 100% da coluna (nunca largura fixa).
  const labelClass = 'mb-2 flex items-center gap-[5px] text-[13.5px] font-bold text-[#1A211E]';
  // `bg-white` explícito: a base do Input é `bg-transparent`, então sem isso o campo
  // deixa passar o fundo da página em vez de ficar branco como os cards do Resumo.
  const inputClass =
    'h-auto w-full rounded-[9px] border-[#E3E6EA] bg-white px-[13px] py-[11px] text-sm text-[#1A211E] placeholder:text-[#AEB6BC] focus-visible:border-[#359558] focus-visible:ring-[3px] focus-visible:ring-[#359558]/[.12]';
  const hintClass = 'mt-[7px] text-[12.5px] text-[#9AA3A0]';

  return (
    <>
      <div>
        <div>
          <h2 className="text-[22px] font-extrabold tracking-[-0.3px] text-[#131917]">
            {t('edit.profile.title') || 'Informações pessoais'}
          </h2>
          <p className="mb-[26px] mt-1 text-sm font-normal text-[#8A928F]">
            {t('edit.profile.subtitle') || 'Configure as informações básicas do seu agente'}
          </p>
        </div>

        {/* Duas colunas (spec §4.2): formulário à esquerda, Resumo do Agente à
            direita. Os campos ocupam 100% da coluna — nunca largura fixa em px. */}
        <div className="grid items-start gap-11 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-[22px]">
          {/* Nome do agente */}
          <div>
            <Label className={labelClass}>
              {t('edit.profile.name') || 'Nome do agente'} <span className="text-[#DC4B4B]">*</span>
            </Label>
            <Input
              value={formData.name}
              onChange={e => onFormDataChange('name', e.target.value)}
              placeholder={t('edit.profile.namePlaceholder') || 'Digite o nome do agente'}
              className={inputClass}
            />
          </div>

          {/* Papel - Only for non-orchestrator types */}
          {!isOrchestratorType && (
            <div>
              <Label className={labelClass}>{t('edit.profile.role') || 'Papel'}</Label>
              <Input
                value={formData.role}
                onChange={e => onFormDataChange('role', e.target.value)}
                placeholder={
                  t('edit.profile.rolePlaceholder') || 'Ex: Especialista em suporte técnico'
                }
                className={inputClass}
              />
              <p className={hintClass}>
                {t('edit.profile.roleHelp') || 'O papel que o agente desempenha na conversa'}
              </p>
            </div>
          )}

          {/* Objetivo - Only for non-orchestrator types */}
          {!isOrchestratorType && (
            <div>
              <Label className={labelClass}>{t('edit.profile.goal') || 'Objetivo'}</Label>
              <Input
                value={formData.goal}
                onChange={e => onFormDataChange('goal', e.target.value)}
                placeholder={
                  t('edit.profile.goalPlaceholder') || 'Ex: Ajudar usuários com dúvidas técnicas'
                }
                className={inputClass}
              />
              <p className={hintClass}>
                {t('edit.profile.goalHelp') || 'O objetivo principal do agente'}
              </p>
            </div>
          )}

          {/* Instruções - Only for non-orchestrator types */}
          {!isOrchestratorType && (
            <div>
              <div className="flex items-center justify-between">
                <Label className={labelClass}>
                  {t('edit.profile.instructions') || 'Comportamento'}
                </Label>
                {showAIActions && (
                  <div className="flex gap-2">
                    {formData.instruction && formData.instruction.trim() && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleReview}
                        disabled={isReviewing}
                        className="gap-2"
                      >
                        {isReviewing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t('wizard.promptGenerator.buttons.reviewing')}
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-4 w-4 text-blue-500" />
                            {t('wizard.promptGenerator.buttons.review')}
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPromptModal(true)}
                      className="gap-2"
                    >
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      {t('wizard.step5.generateWithAI')}
                    </Button>
                  </div>
                )}
              </div>
              <Textarea
                value={formData.instruction}
                onChange={e => onFormDataChange('instruction', e.target.value)}
                placeholder={
                  t('edit.profile.instructionsPlaceholder') ||
                  'Descreva como o agente deve se comportar durante a conversa...'
                }
                className={`${inputClass} min-h-[220px] resize-y leading-[1.6]`}
              />
              <div className={`flex justify-between gap-4 ${hintClass}`}>
                <span>
                  {t('edit.profile.instructionsHelp') ||
                    'Ex. Seja extrovertido, na primeira interação procure saber o nome do usuário.'}
                </span>
                <span className="flex-shrink-0">{formData.instruction.length}/3000</span>
              </div>
            </div>
          )}

            {/* Configuração de Tarefa — exclusiva de agentes do tipo `task` */}
            {isTaskAgent(agentType) && onTaskConfigChange && (
              <div className="mt-[22px] border-t border-[#F4F6F8] pt-[22px]">
                <TaskSection
                  data={taskConfigData || { tasks: [] }}
                  onChange={onTaskConfigChange}
                  editingAgentId={editingAgentId}
                  folderId={undefined}
                />
              </div>
            )}
          </div>

          {agent && (
            <AgentSummaryPanel
              agent={agent}
              model={model}
              subAgentsCount={subAgentsCount}
            />
          )}
        </div>
      </div>

      {/* Prompt Generator Modal */}
      <PromptGeneratorModal
        open={showPromptModal}
        onOpenChange={setShowPromptModal}
        onGenerated={prompt => {
          onFormDataChange('instruction', prompt);
        }}
        initialPrompt={formData.instruction}
      />
    </>
  );
};

export default ProfileSection;
