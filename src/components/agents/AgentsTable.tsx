import { Badge, Button } from '@evoapi/design-system';
import { Bot, ExternalLink, ArrowRight, GitBranch, RefreshCw, MoreHorizontal } from 'lucide-react';
import { Agent } from '@/types/agents';
import { BaseTable, TableColumn } from '@/components/base';
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

  /** PADRAO-DE-DESIGN §3.4: chip = cor a 10% de fundo + a mesma cor no texto, 11.5/700,
   *  radius 7, sem borda. Alpha sobre a superfície funciona nos dois temas. */
  const CHIP_CLASS =
    'rounded-[7px] border-transparent px-2 py-0.5 text-[11.5px] font-bold leading-4';

  const getAgentTypeInfo = (type: string) => {
    const types: Record<string, { label: string; color: string }> = {
      llm: {
        label: 'Nativo',
        color: 'bg-primary/10 text-primary',
      },
      external: {
        label: 'Externo',
        color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
      },
      a2a: {
        label: 'A2A',
        color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
      },
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

    const typeInfo = types[type] || {
      label: type,
      color: 'bg-muted-foreground/10 text-muted-foreground',
    };

    return {
      label: typeInfo.label,
      color: typeInfo.color,
    };
  };

  const getAgentTypeIcon = (type: string) => {
    switch (type) {
      case 'llm':
        return <Bot className="h-4 w-4" />;
      case 'a2a':
        return <ExternalLink className="h-4 w-4" />;
      case 'sequential':
        return <ArrowRight className="h-4 w-4" />;
      case 'parallel':
        return <GitBranch className="h-4 w-4" />;
      case 'loop':
        return <RefreshCw className="h-4 w-4" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  const columns: TableColumn<Agent>[] = [
    {
      key: 'name',
      label: t('fields.name'),
      sortable: true,
      render: agent => (
        <div
          className="flex cursor-pointer items-center gap-3 py-2 hover:opacity-80"
          onClick={() => onEditAgent(agent)}
        >
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {getAgentTypeIcon(agent.type)}
          </div>
          <span className="font-semibold text-foreground">{agent.name}</span>
        </div>
      ),
    },
    {
      key: 'description',
      label: t('fields.description'),
      render: agent => (
        <div className="max-w-[200px] truncate">
          {agent.description || t('fields.noDescription')}
        </div>
      ),
    },
    {
      key: 'type',
      label: t('fields.type'),
      sortable: true,
      render: agent => {
        const typeInfo = getAgentTypeInfo(agent.type);
        return <Badge className={cn(CHIP_CLASS, typeInfo.color)}>{typeInfo.label}</Badge>;
      },
    },
    {
      key: 'model',
      label: t('fields.model'),
      // Monoespaçado e sem chip: é um identificador técnico (`openai/GPT-4.1`), não um rótulo.
      render: agent =>
        agent.model ? (
          <span className="font-mono text-xs text-muted-foreground">{agent.model}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{t('fields.notAvailable')}</span>
        ),
    },
    {
      key: 'created_at',
      label: t('fields.createdAt'),
      sortable: true,
      render: agent => (
        <span className="text-muted-foreground">
          {agent.created_at && new Date(agent.created_at).toLocaleDateString('pt-BR')}
        </span>
      ),
    },
    {
      key: 'actions',
      label: t('table.actions'),
      render: agent => (
        <AgentActionsDropdown
          agent={agent}
          trigger={
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          }
          onEdit={onEditAgent}
          onExportAsJSON={() => {
            // TODO: Implement export as JSON functionality
          }}
          onShare={() => {
            // TODO: Implement share agent functionality
          }}
          onDelete={onDeleteAgent}
        />
      ),
    },
  ];

  return (
    <BaseTable<Agent>
      data={agents}
      columns={columns}
      selectable={true}
      selectedItems={selectedAgents}
      onSelectionChange={onSelectionChange}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={onSort}
      loading={loading}
      emptyMessage={t('table.emptyMessage')}
      getRowKey={agent => agent.id}
      className="border rounded-lg"
    />
  );
}
