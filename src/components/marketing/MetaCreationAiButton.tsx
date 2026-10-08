import { useEffect, useRef, useState } from 'react';
import { Bot } from 'lucide-react';
import { Button, Sheet, SheetContent, Tooltip, TooltipContent, TooltipTrigger } from '@evoapi/design-system';
import { AgentChatProvider, useAgentChat } from '@/contexts/agents/AgentChatContext';
import { AgentChatArea } from '@/pages/Customer/Agents/Agent/chat';
import { AgentChatPanelHeader } from '@/components/agents/chat/AgentChatPanelHeader';
import { getAgent } from '@/services/agents/agentService';
import type { Agent } from '@/types/agents';
import { extractMetaDraft, type AiMetaDraft } from '@/utils/marketing/aiMetaDraft';

// UUID do "Assistente de Criação Meta" — agente dedicado (criado em
// 2026-10-07, sem nenhuma ferramenta de CRIAÇÃO de verdade, só
// "buscar_direcionamento" pra resolver interesse/comportamento em texto
// livre) que ajuda a montar públicos, direcionamento detalhado e grupos de
// localização por conversa. A resposta final inclui um bloco cercado
// ```evo-meta-draft (ver aiMetaDraft.ts) que o DraftWatcher abaixo detecta
// e repassa pro onDraft — quem abre a tela certa já preenchida é sempre o
// próprio CRM, e quem aperta "Criar"/"Salvar" de verdade é sempre o
// usuário. Igual ORCHESTRATOR_AGENT_ID em AiAssistantButton.tsx: fixo por
// enquanto, mover pra config de conta se precisar trocar sem deploy.
const META_CREATION_AGENT_ID = 'ef76cfca-f231-4db5-aeff-cf7f9bf1d4bf';

interface MetaCreationAiButtonProps {
  onDraft: (draft: AiMetaDraft) => void;
}

// Fica DENTRO do AgentChatProvider pra ter acesso às mensagens via
// useAgentChat() — só observa a última resposta do agente e, se achar um
// bloco de rascunho ainda não tratado, chama onDraft uma única vez (guarda
// o id da última mensagem já tratada pra não disparar de novo em re-render).
function DraftWatcher({ onDraft }: { onDraft: (draft: AiMetaDraft) => void }) {
  const { messages } = useAgentChat();
  const lastHandledId = useRef<string | null>(null);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    const isAssistant = last.author !== 'user' && last.content?.role !== 'user';
    if (!isAssistant) return;
    if (lastHandledId.current === last.id) return;
    const text = (last.content?.parts || []).map((p) => p.text || '').join('\n');
    const draft = extractMetaDraft(text);
    if (draft) {
      lastHandledId.current = last.id;
      onDraft(draft);
    }
  }, [messages, onDraft]);

  return null;
}

export function MetaCreationAiButton({ onDraft }: MetaCreationAiButtonProps) {
  const [open, setOpen] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);

  useEffect(() => {
    if (!open || agent) return;
    let cancelled = false;
    getAgent(META_CREATION_AGENT_ID)
      .then((result) => {
        if (!cancelled) setAgent(result);
      })
      .catch(() => {
        // Silencioso: o painel mostra "Carregando..." indefinidamente se o
        // agente não puder ser buscado (ex: removido, sem permissão) — mesmo
        // comportamento do AiAssistantButton.tsx geral.
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
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setOpen(true)}
            aria-label="Assistente de IA da Criação Meta"
          >
            <Bot className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Pedir pra IA montar um público, direcionamento ou grupo de localização</p>
        </TooltipContent>
      </Tooltip>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col">
          {agent ? (
            <AgentChatProvider agentId={agent.id}>
              <AgentChatPanelHeader agent={agent} onClose={() => setOpen(false)} />
              <DraftWatcher
                onDraft={(draft) => {
                  onDraft(draft);
                  setOpen(false);
                }}
              />
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
