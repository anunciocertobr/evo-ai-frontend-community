import { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import {
  Button,
  Sheet,
  SheetContent,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@evoapi/design-system';
import { AgentChatProvider } from '@/contexts/agents/AgentChatContext';
import { AgentChatArea } from '@/pages/Customer/Agents/Agent/chat';
import { AgentChatPanelHeader } from '@/components/agents/chat/AgentChatPanelHeader';
import { getAgent } from '@/services/agents/agentService';
import type { Agent } from '@/types/agents';

// UUID do agente orquestrador "Assistente Anuncio Certo" — delega a conversa
// para os sub-agentes especializados (pipeline/leads, financeiro, tráfego/
// campanhas, conteúdo) configurados em /agents/{id}/edit > Ferramentas >
// Sub Agentes. Fixo por enquanto; se precisar trocar sem deploy, mover para
// uma config de conta (padrão já usado em RealEstateSettingsPage).
const ORCHESTRATOR_AGENT_ID = 'c8fe09a5-2500-41f3-8469-90c4e44ddf88';

export function AiAssistantButton() {
  const [open, setOpen] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);

  useEffect(() => {
    if (!open || agent) return;
    let cancelled = false;
    getAgent(ORCHESTRATOR_AGENT_ID)
      .then((result) => {
        if (!cancelled) setAgent(result);
      })
      .catch(() => {
        // Silencioso: o painel mostra o estado de carregamento indefinidamente
        // se o agente não puder ser buscado (ex: removido, sem permissão).
      });
    return () => {
      cancelled = true;
    };
  }, [open, agent]);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            aria-label="Assistente de IA"
            className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer"
          >
            <Bot className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Assistente de IA</p>
        </TooltipContent>
      </Tooltip>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg p-0">
          {agent ? (
            <AgentChatProvider agentId={agent.id}>
              <AgentChatPanelHeader agent={agent} onClose={() => setOpen(false)} />
              <AgentChatArea agent={agent} />
            </AgentChatProvider>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Carregando assistente...
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
