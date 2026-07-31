import { Agent } from '@/types/agents';
import { AgentChatProvider } from '@/contexts/agents/AgentChatContext';
import { AgentChatArea } from '@/pages/Customer/Agents/Agent/chat';
import { AgentChatPanelHeader } from './chat/AgentChatPanelHeader';

interface AgentTestChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent;
}

/**
 * Painel lateral, não modal: é irmão do conteúdo num flex row, então a área de edição
 * encolhe em vez de ser coberta e o formulário segue editável com o chat aberto.
 */
export default function AgentTestChat({ open, onOpenChange, agent }: AgentTestChatProps) {
  if (!open) return null;

  return (
    <aside className="flex w-[460px] min-w-[360px] flex-shrink-0 flex-col overflow-hidden border-l border-[#ECEEF2] bg-background">
      <AgentChatProvider agentId={agent.id}>
        <AgentChatPanelHeader agent={agent} onClose={() => onOpenChange(false)} />
        <AgentChatArea agent={agent} />
      </AgentChatProvider>
    </aside>
  );
}
