import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@evoapi/design-system';
import { Users, Wrench, Plug, Server } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import SubAgentsForm, { SubAgentsData } from '@/components/ai_agents/Forms/SubAgentsForm';
import ToolsSection from '../sections/ToolsSection';
import IntegrationsSection from '../sections/IntegrationsSection';
import MCPServersSection from '../sections/MCPServersSection';
import { CustomTool, MCPServerConfig } from '@/types/ai';
import { Agent } from '@/types';
import { supportsSubAgents, supportsToolBlocks } from './agentTabs';

interface AgentToolsAccordionProps {
  agentId: string;
  agentType?: string;

  subAgentsData: SubAgentsData;
  onSubAgentsChange: (data: SubAgentsData) => void;

  agentTools: string[];
  agentToolsData: Agent[];
  customTools: { http_tools: CustomTool[] };
  onAgentToolsChange: (agentTools: string[], agentToolsData?: Agent[]) => void;
  onCustomToolsChange: (customTools: { http_tools: CustomTool[] }) => void;

  integrations: Record<string, unknown>;
  onIntegrationsChange: (integrations: Record<string, unknown>) => void;

  mcpServers: MCPServerConfig[];
  customMCPServerIds: string[];
  onMCPServersChange: (mcpServers: MCPServerConfig[]) => void;
  onCustomMCPServersChange: (serverIds: string[]) => void;
}

const AgentToolsAccordion = ({
  agentId,
  agentType,
  subAgentsData,
  onSubAgentsChange,
  agentTools,
  agentToolsData,
  customTools,
  onAgentToolsChange,
  onCustomToolsChange,
  integrations,
  onIntegrationsChange,
  mcpServers,
  customMCPServerIds,
  onMCPServersChange,
  onCustomMCPServersChange,
}: AgentToolsAccordionProps) => {
  const { t } = useLanguage('aiAgents');

  const showSubAgents = supportsSubAgents(agentType);
  const showToolBlocks = supportsToolBlocks(agentType);

  const itemClass =
    'rounded-[14px] border border-[#ECEEF2] bg-white shadow-[0_1px_3px_rgba(20,30,45,0.05)]';
  const triggerClass = 'px-5 py-4 text-[15px] font-bold text-[#1A211E] hover:no-underline';
  const iconClass = 'mr-3 h-5 w-5 text-[#359558]';

  return (
    <Accordion
      type="multiple"
      defaultValue={showSubAgents ? ['subAgents'] : ['tools']}
      className="space-y-4"
    >
      {showSubAgents && (
        <AccordionItem value="subAgents" className={itemClass}>
          <AccordionTrigger className={triggerClass}>
            <span className="flex flex-1 items-center">
              <Users className={iconClass} />
              {t('edit.menu.subAgents') || 'Sub Agentes'}
            </span>
          </AccordionTrigger>
          <AccordionContent className="border-t border-[#ECEEF2] p-5">
            <SubAgentsForm
              mode="edit"
              data={subAgentsData}
              onChange={onSubAgentsChange}
              onValidationChange={() => {}}
              editingAgentId={agentId}
              folderId={undefined}
            />
          </AccordionContent>
        </AccordionItem>
      )}

      {showToolBlocks && (
        <>
          <AccordionItem value="tools" className={itemClass}>
            <AccordionTrigger className={triggerClass}>
              <span className="flex flex-1 items-center">
                <Wrench className={iconClass} />
                {t('edit.menu.tools') || 'Ferramentas'}
              </span>
            </AccordionTrigger>
            <AccordionContent className="border-t border-[#ECEEF2] p-5">
              <ToolsSection
                agentTools={agentTools}
                agentToolsData={agentToolsData}
                customTools={customTools}
                onAgentToolsChange={onAgentToolsChange}
                onCustomToolsChange={onCustomToolsChange}
                editingAgentId={agentId}
                folderId={undefined}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="integrations" className={itemClass}>
            <AccordionTrigger className={triggerClass}>
              <span className="flex flex-1 items-center">
                <Plug className={iconClass} />
                {t('edit.menu.integrations') || 'Integrações'}
              </span>
            </AccordionTrigger>
            <AccordionContent className="border-t border-[#ECEEF2] p-5">
              <IntegrationsSection
                integrations={integrations}
                agentId={agentId}
                onIntegrationsChange={onIntegrationsChange}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="mcpServers" className={itemClass}>
            <AccordionTrigger className={triggerClass}>
              <span className="flex flex-1 items-center">
                <Server className={iconClass} />
                {t('edit.menu.mcpServers') || 'Servidores MCP'}
              </span>
            </AccordionTrigger>
            <AccordionContent className="border-t border-[#ECEEF2] p-5">
              <MCPServersSection
                mcpServers={mcpServers}
                customMCPServerIds={customMCPServerIds}
                onMCPServersChange={onMCPServersChange}
                onCustomMCPServersChange={onCustomMCPServersChange}
                agentId={agentId}
              />
            </AccordionContent>
          </AccordionItem>
        </>
      )}
    </Accordion>
  );
};

export default AgentToolsAccordion;
