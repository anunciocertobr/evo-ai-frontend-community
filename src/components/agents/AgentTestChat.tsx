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
 * Painel LATERAL, não modal: renderiza como irmão do conteúdo do agente num flex
 * row, então a área de edição encolhe em vez de ser coberta — o formulário segue
 * visível e editável com o chat aberto. Um Dialog/Sheet bloquearia a interação
 * por trás do overlay, que é justamente o que não se quer aqui.
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
