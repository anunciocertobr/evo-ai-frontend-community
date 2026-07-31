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
 *
 * Abaixo de 768px os 360px mínimos não sobram: ali ele sai do fluxo e cobre a tela,
 * senão empurraria o conteúdo e estouraria a página na horizontal.
 */
export default function AgentTestChat({ open, onOpenChange, agent }: AgentTestChatProps) {
  if (!open) return null;

  return (
    <aside className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background md:static md:z-auto md:w-[460px] md:min-w-[360px] md:flex-shrink-0 md:border-l md:border-[#ECEEF2]">
      <AgentChatProvider agentId={agent.id}>
        <AgentChatPanelHeader agent={agent} onClose={() => onOpenChange(false)} />
        <AgentChatArea agent={agent} />
      </AgentChatProvider>
    </aside>
  );
}
