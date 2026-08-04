import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@evoapi/design-system';
import { AgentsTable, AgentsHeader, AgentsPagination, AgentWizardModal, AgentsFilterPanel, AgentsTabsLayout } from '@/components/agents';
import {
  EMPTY_AGENT_FACETS,
  AgentFacetSelection,
  applyAgentFacets,
  buildModelOptions,
  countSelectedFacets,
} from '@/components/agents/agentsFilterFacets';
import { toast } from 'sonner';
import { usePermissions } from '@/contexts/PermissionsContext';
import { getAccessibleAgents, deleteAgent } from '@/services/agents';
import { Agent } from '@/types/agents';
import { useLanguage } from '@/hooks/useLanguage';
import { ApiKeysModal } from '@/components/ApiKeysModal';
import { AgentsTour } from '@/tours';
import { useDarkMode } from '@/hooks/useDarkMode';
import type { PaginationMeta } from '@/types/core';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';

interface AgentsState {
  agents: Agent[];
  selectedAgents: Agent[];
  meta: {
    pagination: PaginationMeta;
  };
  loading: boolean;
}

const INITIAL_STATE: AgentsState = {
  agents: [],
  selectedAgents: [],
  meta: {
    pagination: {
      page: 1,
      page_size: DEFAULT_PAGE_SIZE,
      total: 0,
      total_pages: 0,
    },
  },
  loading: false,
};

const Agentes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage('agents');
  const { can, isReady: permissionsReady, loading: permissionsLoading } = usePermissions();
  useDarkMode();

  const [state, setState] = useState<AgentsState>(INITIAL_STATE);
  const [isApiKeysModalOpen, setIsApiKeysModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  // Facetas Tipo/Modelo do protótipo §2.3. Filtram a PÁGINA carregada — igual ao
  // protótipo e à busca desta tela; não há endpoint de facetas.
  const [facets, setFacets] = useState<AgentFacetSelection>(EMPTY_AGENT_FACETS);

  const loadingRef = useRef(false);
  const loadAgentsRef = useRef<((params?: { page?: number; per_page?: number }) => Promise<void>) | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isWizardOpen = location.pathname === '/agents/new';

  const loadAgents = useCallback(
    async (params?: { page?: number; per_page?: number }) => {
      if (loadingRef.current || permissionsLoading || !permissionsReady) {
        return;
      }

      // Sem toast: quem não tem `read` está sendo redirecionado pelo AgentsTabsLayout
      // neste mesmo tick (AC 4). Um erro vermelho numa tela que o usuário está deixando
      // é ruído — o container é quem comunica a falta de acesso.
      if (!can('ai_agents', 'read')) {
        return;
      }

      loadingRef.current = true;
      setState(prev => ({ ...prev, loading: true }));

      try {
        const currentPage = params?.page ?? 1;
        const currentPageSize = params?.per_page ?? 24;

        const response = await getAccessibleAgents(currentPage, currentPageSize);

        const total = response.meta?.pagination?.total || 0;
        const pageSize = response.meta?.pagination?.page_size || DEFAULT_PAGE_SIZE;

        const agentsData: Agent[] = Array.isArray(response.data)
          ? (response.data.length > 0 && Array.isArray(response.data[0])
              ? (response.data as unknown as Agent[][]).flat()
              : (response.data as unknown as Agent[]))
          : [];

        setState(prev => ({
          ...prev,
          agents: agentsData,
          meta: {
            pagination: {
              page: response.meta?.pagination?.page || currentPage,
              page_size: pageSize,
              total,
              total_pages: response.meta?.pagination?.total_pages || Math.ceil(total / pageSize),
              has_next_page: response.meta?.pagination?.has_next_page,
              has_previous_page: response.meta?.pagination?.has_previous_page,
            },
          },
          loading: false,
        }));
      } catch (error) {
        console.error('Erro ao carregar agentes:', error);
        toast.error(t('loadError'));
        setState(prev => ({ ...prev, loading: false }));
      } finally {
        loadingRef.current = false;
      }
    },
    [permissionsReady, permissionsLoading, can, t],
  );

  useEffect(() => {
    loadAgentsRef.current = loadAgents;
  }, [loadAgents]);

  useEffect(() => {
    if (!permissionsReady) {
      return;
    }

    if (loadAgentsRef.current) {
      loadAgentsRef.current();
    }
  }, [permissionsReady, permissionsLoading]);

  const handleCreateAgent = () => {
    if (!can('ai_agents', 'create')) {
      toast.error(t('permissions.createDenied'));
      return;
    }
    navigate('/agents/new');
  };

  const handleEditAgent = (agentId: string) => {
    if (!can('ai_agents', 'update')) {
      toast.error(t('permissions.editDenied'));
      return;
    }
    navigate(`/agents/${agentId}/edit`);
  };

  const handleDeleteAgent = (agent: Agent) => {
    if (!can('ai_agents', 'delete')) {
      toast.error(t('permissions.deleteDenied'));
      return;
    }
    setAgentToDelete(agent);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteAgent = async () => {
    if (!agentToDelete) return;

    try {
      setIsDeleting(true);
      await deleteAgent(agentToDelete.id);

      setState(prev => ({
        ...prev,
        agents: prev.agents.filter(a => a.id !== agentToDelete.id),
        meta: {
          ...prev.meta,
          pagination: {
            ...prev.meta.pagination,
            total: Math.max(0, prev.meta.pagination.total - 1),
            total_pages: Math.ceil(Math.max(0, prev.meta.pagination.total - 1) / prev.meta.pagination.page_size),
          },
        },
      }));

      toast.success(t('deleteDialog.success', { name: agentToDelete.name }));
      setDeleteDialogOpen(false);
      setAgentToDelete(null);
    } catch (error) {
      console.error('Erro ao deletar agente:', error);
      toast.error(t('loadError'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSort = (column: string) => {
    const newOrder = sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(column);
    setSortOrder(newOrder);
  };

  const handlePageChange = (page: number) => {
    setState(prev => ({
      ...prev,
      meta: {
        ...prev.meta,
        pagination: { ...prev.meta.pagination, page },
      },
      selectedAgents: [],
    }));

    loadAgents({ page });
  };

  const handlePerPageChange = (perPage: number) => {
    setState(prev => ({
      ...prev,
      meta: {
        ...prev.meta,
        pagination: { ...prev.meta.pagination, page_size: perPage, page: 1 },
      },
      selectedAgents: [],
    }));

    loadAgents({ page: 1, per_page: perPage });
  };

  const handleBulkDelete = () => {
    toast.info(t('bulkDelete'));
  };

  const searchedAgents = state.agents.filter(
    agent =>
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const filteredAgents = applyAgentFacets(searchedAgents, facets);
  const modelOptions = buildModelOptions(state.agents);

  return (
    <div className="flex flex-col h-full">
      {isWizardOpen ? (
        <div className="flex-1 min-h-0 animate-slideInFromRight">
          <AgentWizardModal
            embedded
            open={isWizardOpen}
            onOpenChange={(open) => {
              if (!open) {
                navigate('/agents/list');
              }
            }}
            onAgentCreated={() => {
              loadAgents();
            }}
          />
        </div>
      ) : (
        <AgentsTabsLayout tab="agents">
        <div className="animate-fadeIn h-full flex flex-col">
          <AgentsTour />
          <div className="flex-1 px-[34px] pb-5">
            <div className="mt-6" data-tour="agents-header">
            <AgentsHeader
              hideTitle
              totalCount={state.meta.pagination.total}
              selectedCount={state.selectedAgents.length}
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              onNewAgent={handleCreateAgent}
              onManageApiKeys={() => setIsApiKeysModalOpen(true)}
              onBulkDelete={handleBulkDelete}
              onClearSelection={() => setState(prev => ({ ...prev, selectedAgents: [] }))}
              onFilter={() => setFilterPanelOpen(open => !open)}
              filterCount={countSelectedFacets(facets)}
              showFilters={true}
              filterPanel={
                <AgentsFilterPanel
                  open={filterPanelOpen}
                  onClose={() => setFilterPanelOpen(false)}
                  selection={facets}
                  onSelectionChange={setFacets}
                  onClear={() => setFacets(EMPTY_AGENT_FACETS)}
                  modelOptions={modelOptions}
                />
              }
            />
            </div>

            <div className="mt-5" data-tour="agents-list">
            <AgentsTable
              agents={filteredAgents}
              selectedAgents={state.selectedAgents}
              loading={state.loading}
              onSelectionChange={agents => setState(prev => ({ ...prev, selectedAgents: agents }))}
              onEditAgent={agent => handleEditAgent(agent.id)}
              onDeleteAgent={handleDeleteAgent}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
            />
            </div>
          </div>

          <div className="px-[34px] pb-5">
            <AgentsPagination
              currentPage={state.meta.pagination.page}
              totalPages={state.meta.pagination.total_pages}
              totalCount={state.meta.pagination.total}
              perPage={state.meta.pagination.page_size}
              onPageChange={handlePageChange}
              onPerPageChange={handlePerPageChange}
              loading={state.loading}
            />
          </div>
        </div>
        </AgentsTabsLayout>
      )}

      <ApiKeysModal open={isApiKeysModalOpen} onOpenChange={setIsApiKeysModalOpen} />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('deleteDialog.description', { name: agentToDelete?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              {t('deleteDialog.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDeleteAgent} disabled={isDeleting}>
              {isDeleting ? t('deleteDialog.deleting') : t('deleteDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Agentes;
