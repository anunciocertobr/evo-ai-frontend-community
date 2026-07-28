import { useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { LLMConfigData } from '@/components/ai_agents/Forms/LLMConfigForm';
import { A2AConfigData } from '@/components/ai_agents/Forms/A2AConfigForm';
import { Agent, ApiKey } from '@/types/agents';
import { Key, MessageSquare, Clock, Timer } from 'lucide-react';
import { InactivityAction } from '../InactivityActions';
import { TransferRule } from '../TransferRules';
import { PipelineRule } from '../PipelineRules';
import { ContactEditConfig } from '../ContactEditRules';
import {
  BehaviorPanel,
  InactivityActionsTab,
  MessageHandlingPanel,
  ModelApiPanel,
  TransferRulesModal,
  PipelineRulesModal,
  hasMessageHandlingContent,
} from '@/components/agents/configuration';
import ContactEditModal from '@/components/agents/configuration/ContactEditModal';
import { BehaviorSettings, ExternalConfigData } from '@/components/agents/configuration/types';
import CollapsibleCard from '@/components/ai_agents/CollapsibleCard';
import {
  isA2AAgent,
  isExternalAgent,
  supportsBehaviorSettings,
  supportsInactivityActions,
  supportsModelConfig,
} from '@/utils/agents';

interface ConfigurationSectionProps {
  agent: Agent;
  llmConfigData: LLMConfigData | null;
  a2aConfigData: A2AConfigData | null;
  externalConfigData?: ExternalConfigData | null;
  apiKeys: ApiKey[];
  behaviorSettings: BehaviorSettings;
  inactivityActions: InactivityAction[];
  transferRules: TransferRule[];
  pipelineRules: PipelineRule[];
  contactEditConfig: ContactEditConfig;
  availablePipelines?: Array<{
    id: string;
    name: string;
    stages: Array<{ id: string; name: string }>;
  }>;
  availableUsers?: Array<{ id: string; name: string }>;
  availableTeams?: Array<{ id: string; name: string }>;
  onLLMConfigChange: (data: LLMConfigData) => void;
  onA2AConfigChange: (data: A2AConfigData) => void;
  onExternalConfigChange?: (data: ExternalConfigData) => void;
  onBehaviorSettingsChange: (settings: BehaviorSettings) => void;
  onInactivityActionsChange: (actions: InactivityAction[]) => void;
  onTransferRulesChange: (rules: TransferRule[]) => void;
  onPipelineRulesChange: (rules: PipelineRule[]) => void;
  onContactEditConfigChange: (config: ContactEditConfig) => void;
  onInstructionSync?: (instruction: string) => void;
  onApiKeysReload: () => void;
}

const ConfigurationSection = ({
  agent,
  llmConfigData,
  a2aConfigData,
  externalConfigData,
  apiKeys,
  behaviorSettings,
  inactivityActions,
  transferRules,
  pipelineRules,
  contactEditConfig,
  availablePipelines = [],
  availableUsers = [],
  availableTeams = [],
  onLLMConfigChange,
  onA2AConfigChange,
  onExternalConfigChange,
  onBehaviorSettingsChange,
  onInactivityActionsChange,
  onTransferRulesChange,
  onPipelineRulesChange,
  onContactEditConfigChange,
  onInstructionSync,
  onApiKeysReload,
}: ConfigurationSectionProps) => {
  const { t } = useLanguage('aiAgents');

  const [showTransferRulesModal, setShowTransferRulesModal] = useState(false);
  const [showPipelineRulesModal, setShowPipelineRulesModal] = useState(false);
  const [showContactEditModal, setShowContactEditModal] = useState(false);

  // Card "Modelo e API" cobre a config de modelo/provider de cada tipo: chave+modelo
  // (llm), agent card (a2a) e provider externo (external).
  const showModelCard =
    (supportsModelConfig(agent.type) && Boolean(llmConfigData)) ||
    (isA2AAgent(agent.type) && Boolean(a2aConfigData)) ||
    (isExternalAgent(agent.type) && Boolean(externalConfigData) && Boolean(onExternalConfigChange));
  const showBehaviorCard = supportsBehaviorSettings(agent.type);
  const showMessageCard = hasMessageHandlingContent(agent, llmConfigData, externalConfigData);

  return (
    <>
      <div className="space-y-4">
        {showModelCard && (
          <CollapsibleCard
            title={t('edit.configuration.sections.modelAndApi.title') || 'Modelo e API'}
            subtitle={
              t('edit.configuration.sections.modelAndApi.subtitle') ||
              'Configure o modelo de linguagem e a chave de API'
            }
            icon={<Key className="h-5 w-5" />}
          >
            <ModelApiPanel
              agent={agent}
              llmConfigData={llmConfigData}
              a2aConfigData={a2aConfigData}
              externalConfigData={externalConfigData}
              apiKeys={apiKeys}
              onLLMConfigChange={onLLMConfigChange}
              onA2AConfigChange={onA2AConfigChange}
              onExternalConfigChange={onExternalConfigChange}
              onInstructionSync={onInstructionSync}
              onApiKeysReload={onApiKeysReload}
            />
          </CollapsibleCard>
        )}

        {showBehaviorCard && (
          <CollapsibleCard
            title={t('edit.configuration.sections.behavior.title') || 'Comportamento na Conversa'}
            subtitle={
              t('edit.configuration.sections.behavior.subtitle') ||
              'Configure como o agente interage com os usuários'
            }
            icon={<MessageSquare className="h-5 w-5" />}
          >
            <div className="space-y-8">
              <BehaviorPanel
                behaviorSettings={behaviorSettings}
                onBehaviorSettingsChange={onBehaviorSettingsChange}
                onShowTransferRulesModal={() => setShowTransferRulesModal(true)}
                onShowPipelineRulesModal={() => setShowPipelineRulesModal(true)}
                onShowContactEditModal={() => setShowContactEditModal(true)}
              />

              {supportsInactivityActions(agent.type) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b pb-2">
                    <div className="rounded-lg bg-amber-500/10 p-2">
                      <Timer className="h-5 w-5 text-amber-500" />
                    </div>
                    <h3 className="text-base font-semibold">
                      {t('edit.configuration.tabs.inactivityActions') || 'Ações de inatividade'}
                    </h3>
                  </div>
                  <InactivityActionsTab
                    actions={inactivityActions}
                    onChange={onInactivityActionsChange}
                  />
                </div>
              )}
            </div>
          </CollapsibleCard>
        )}

        {showMessageCard && (
          <CollapsibleCard
            title={
              t('edit.configuration.sections.messageHandling.title') || 'Tratamento de Mensagens'
            }
            subtitle={
              t('edit.configuration.sections.messageHandling.subtitle') ||
              'Configure como as mensagens são processadas e enviadas'
            }
            icon={<Clock className="h-5 w-5" />}
          >
            <MessageHandlingPanel
              agent={agent}
              llmConfigData={llmConfigData}
              externalConfigData={externalConfigData}
              behaviorSettings={behaviorSettings}
              onLLMConfigChange={onLLMConfigChange}
              onExternalConfigChange={onExternalConfigChange}
              onBehaviorSettingsChange={onBehaviorSettingsChange}
            />
          </CollapsibleCard>
        )}
      </div>

      {/* Modal de Regras de Transferência */}
      <TransferRulesModal
        open={showTransferRulesModal}
        onOpenChange={setShowTransferRulesModal}
        rules={transferRules}
        onChange={onTransferRulesChange}
        availableUsers={availableUsers}
        availableTeams={availableTeams}
      />

      {/* Modal de Regras de Pipeline */}
      <PipelineRulesModal
        open={showPipelineRulesModal}
        onOpenChange={setShowPipelineRulesModal}
        rules={pipelineRules}
        onChange={onPipelineRulesChange}
        availablePipelines={availablePipelines}
      />

      {/* Modal de Edição de Contatos */}
      <ContactEditModal
        open={showContactEditModal}
        onOpenChange={setShowContactEditModal}
        config={contactEditConfig}
        onChange={onContactEditConfigChange}
      />
    </>
  );
};

export default ConfigurationSection;
