import { Badge, Button, Checkbox } from '@evoapi/design-system';
import {
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Bot,
  ExternalLink,
  GitBranch,
  MoreHorizontal,
  RefreshCw,
} from 'lucide-react';
import { Agent } from '@/types/agents';
import { cn } from '@/utils/cn';
import AgentActionsDropdown from './AgentActionsDropdown';
import { useLanguage } from '@/hooks/useLanguage';

interface AgentsTableProps {
  agents: Agent[];
  selectedAgents: Agent[];
  loading?: boolean;
  onSelectionChange: (agents: Agent[]) => void;
  onEditAgent: (agent: Agent) => void;
  onDeleteAgent: (agent: Agent) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (column: string) => void;
}

/**
 * Larguras do protótipo (planning-novo-agente-ia-crm.html). Não sai do `BaseTable`
 * por capricho: aquele é um `<table>` genérico de ~30 telas, sem como expressar
 * `flex:1.6` nem esconder-se quando a lista está vazia — e aqui o cabeçalho tem
 * que continuar visível com zero agentes.
 */
const COL = {
  checkbox: 'flex-[0_0_18px]',
  name: 'flex-1 min-w-0',
  description: 'flex-[1.6] min-w-0',
  type: 'flex-[0_0_110px]',
  model: 'flex-[0_0_170px]',
  createdAt: 'flex-[0_0_140px]',
  actions: 'flex-[0_0_70px]',
};

/** `#fafbfc` sobre linhas brancas: um véu do próprio texto, que responde aos 2 temas. */
const HEAD_ROW_CLASS =
  'flex items-center gap-4 border-b border-border bg-muted-foreground/[0.06] px-5 py-[14px] text-[12.5px] font-bold text-muted-foreground';

const ROW_CLASS =
  'flex items-center gap-4 border-b border-border/70 px-5 py-4 transition-colors duration-150 last:border-b-0 hover:bg-accent/40';

export default function AgentsTable({
  agents,
  selectedAgents,
  loading,
  onSelectionChange,
  onEditAgent,
  onDeleteAgent,
  sortBy,
  sortOrder,
  onSort,
}: AgentsTableProps) {
  const { t } = useLanguage('agents');

  const selectedIds = new Set(selectedAgents.map(agent => agent.id));
  const allSelected = agents.length > 0 && selectedIds.size === agents.length;

  const toggleAll = () => onSelectionChange(allSelected ? [] : agents);

  const toggleOne = (agent: Agent) =>
    onSelectionChange(
      selectedIds.has(agent.id)
        ? selectedAgents.filter(selected => selected.id !== agent.id)
        : [...selectedAgents, agent],
    );

  /** PADRAO-DE-DESIGN §3.4: chip = cor a 10% de fundo + a mesma cor no texto. */
  const CHIP_CLASS =
    'rounded-[7px] border-transparent px-2 py-0.5 text-[11.5px] font-bold leading-4';

  const getAgentTypeInfo = (type: string) => {
    const types: Record<string, { label: string; color: string }> = {
      llm: { label: 'Nativo', color: 'bg-primary/10 text-primary' },
      external: { label: 'Externo', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
      a2a: { label: 'A2A', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
      sequential: {
        label: 'Agente Sequencial',
        color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
      },
      parallel: {
        label: 'Agente Paralelo',
        color: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
      },
      loop: {
        label: 'Agente Loop',
        color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
      },
    };
    return types[type] || { label: type, color: 'bg-muted-foreground/10 text-muted-foreground' };
  };

  const getAgentTypeIcon = (type: string) => {
    switch (type) {
      case 'a2a':
        return <ExternalLink className="size-[18px]" />;
      case 'sequential':
        return <ArrowRight className="size-[18px]" />;
      case 'parallel':
        return <GitBranch className="size-[18px]" />;
      case 'loop':
        return <RefreshCw className="size-[18px]" />;
      default:
        return <Bot className="size-[18px]" />;
    }
  };

  const SortHeader = ({ column, label }: { column: string; label: string }) => {
    const active = sortBy === column;
    return (
      <button
        type="button"
        onClick={() => onSort?.(column)}
        className="flex items-center gap-1.5 font-bold hover:text-foreground"
      >
        {label}
        {active ? (
          <ArrowUp
            className={cn(
              'size-[13px] text-primary transition-transform',
              sortOrder === 'desc' && 'rotate-180',
            )}
          />
        ) : (
          <ArrowUpDown className="size-[13px] text-muted-foreground/60" />
        )}
      </button>
    );
  };

  return (
    <div className="overflow-visible rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,.04)]">
      <div className={HEAD_ROW_CLASS}>
        <div className={COL.checkbox}>
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            aria-label={t('fields.name')}
            className="data-[state=checked]:border-primary data-[state=checked]:bg-primary"
          />
        </div>
        <div className={COL.name}>
          <SortHeader column="name" label={t('fields.name')} />
        </div>
        <div className={COL.description}>{t('fields.description')}</div>
        <div className={COL.type}>
          <SortHeader column="type" label={t('fields.type')} />
        </div>
        <div className={COL.model}>{t('fields.model')}</div>
        <div className={COL.createdAt}>
          <SortHeader column="created_at" label={t('fields.createdAt')} />
        </div>
        <div className={cn(COL.actions, 'text-right')}>{t('table.actions')}</div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          {t('loading.agent')}
        </div>
      ) : (
        agents.map(agent => {
          const typeInfo = getAgentTypeInfo(agent.type);
          return (
            <div key={agent.id} className={ROW_CLASS}>
              <div className={COL.checkbox}>
                <Checkbox
                  checked={selectedIds.has(agent.id)}
                  onCheckedChange={() => toggleOne(agent)}
                  aria-label={agent.name}
                  className="data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                />
              </div>

              <button
                type="button"
                onClick={() => onEditAgent(agent)}
                className={cn(COL.name, 'flex items-center gap-[11px] text-left')}
              >
                <span className="flex size-[34px] flex-none items-center justify-center rounded-[9px] border border-primary/30 bg-primary/10 text-primary">
                  {getAgentTypeIcon(agent.type)}
                </span>
                <span className="truncate text-sm font-semibold text-foreground">
                  {agent.name}
                </span>
              </button>

              <div className={cn(COL.description, 'truncate text-[13.5px] text-muted-foreground')}>
                {agent.description || t('fields.noDescription')}
              </div>

              <div className={COL.type}>
                <Badge className={cn(CHIP_CLASS, typeInfo.color)}>{typeInfo.label}</Badge>
              </div>

              {/* Identificador técnico (`openai/gpt-4o`), não rótulo: monoespaçado, sem chip. */}
              <div className={cn(COL.model, 'truncate font-mono text-[13px] text-muted-foreground')}>
                {agent.model || t('fields.notAvailable')}
              </div>

              <div className={cn(COL.createdAt, 'text-[13px] text-muted-foreground')}>
                {agent.created_at && new Date(agent.created_at).toLocaleDateString('pt-BR')}
              </div>

              <div className={cn(COL.actions, 'flex justify-end')}>
                <AgentActionsDropdown
                  agent={agent}
                  trigger={
                    <Button variant="ghost" size="sm" className="size-8 p-0">
                      <MoreHorizontal className="size-[18px]" />
                    </Button>
                  }
                  onEdit={onEditAgent}
                  onDelete={onDeleteAgent}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
