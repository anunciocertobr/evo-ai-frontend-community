import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from '@evoapi/design-system';
import { usePermissions } from '@/contexts/PermissionsContext';
import { pipelinesService } from '@/services/pipelines';
import {
  Pipeline,
  PipelinesState,
  PipelinesListParams,
  UpdatePipelineData,
} from '@/types/analytics';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';

import {
  PipelinesHeader,
  PipelinesTable,
  EditPipelineModal,
  DuplicatePipelineModal,
} from '@/components/pipelines/index';
import { PipelinesTour } from '@/tours';

const INITIAL_STATE: PipelinesState = {
  pipelines: [],
  selectedPipelineIds: [],
  meta: {
    pagination: {
      page: 1,
      page_size: DEFAULT_PAGE_SIZE,
      total: 0,
      total_pages: 0,
    },
  },
  loading: {
    list: false,
    create: false,
    update: false,
    delete: false,
    duplicate: false,
  },
  searchQuery: '',
  sortBy: 'name',
  sortOrder: 'asc',
};

export default function Pipelines() {
  const { t } = useLanguage('pipelines');
  const { can, isReady: permissionsReady } = usePermissions();
  const navigate = useNavigate();
  const [state, setState] = useState<PipelinesState>(INITIAL_STATE);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pipelineToDelete, setPipelineToDelete] = useState<Pipeline | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [pipelineToDuplicate, setPipelineToDuplicate] = useState<Pipeline | null>(null);

  const hasLoaded = useRef(false);

  // Load pipelines
  const loadPipelines = useCallback(
    async (params?: Partial<PipelinesListParams>) => {
      if (!can('pipelines', 'read')) {
        toast.error(t('messages.noPermissionRead'));
        return;
      }

      setState(prev => ({ ...prev, loading: { ...prev.loading, list: true } }));

      try {
        const requestParams: PipelinesListParams = {
          page: state.meta.pagination.page,
          per_page: state.meta.pagination.page_size,
          sort: 'name',
          order: 'asc',
          ...params,
        };

        const response = await pipelinesService.getPipelines(requestParams);

        setState(prev => ({
          ...prev,
          pipelines: response.data,
          meta: {
            pagination: {
              page: response.meta?.pagination?.page || 1,
              page_size: response.meta?.pagination?.page_size || DEFAULT_PAGE_SIZE,
              total: response.meta?.pagination?.total || 0,
              total_pages: response.meta?.pagination?.total_pages || 1,
              has_next_page: response.meta?.pagination?.has_next_page || false,
              has_previous_page: response.meta?.pagination?.has_previous_page || false,
            },
          },
          loading: { ...prev.loading, list: false },
        }));
      } catch (error) {
        console.error('Error loading pipelines:', error);
        toast.error(t('messages.loadError'));
        setState(prev => ({ ...prev, loading: { ...prev.loading, list: false } }));
      }
    },
    [state.meta.pagination.page, state.meta.pagination.page_size, can, t],
  );

  // Initial load
  useEffect(() => {
    if (!permissionsReady) {
      return;
    }

    if (!hasLoaded.current) {
      hasLoaded.current = true;
      loadPipelines();
    }
  }, [permissionsReady, loadPipelines]);

  // Handlers
  const handleSearchChange = (query: string) => {
    setState(prev => ({
      ...prev,
      searchQuery: query,
      meta: {
        pagination: {
          ...prev.meta.pagination,
          page: 1,
        },
      },
    }));

    // Reload with new search
    loadPipelines({ page: 1, q: query || undefined });
  };

  const handleCreatePipeline = () => {
    if (!can('pipelines', 'create')) {
      toast.error(t('messages.noPermissionCreate'));
      return;
    }
    navigate('/pipelines/new');
  };

  const handleEditPipeline = (pipeline: Pipeline) => {
    setEditingPipeline(pipeline);
    setEditModalOpen(true);
  };

  const handleDeletePipeline = (pipeline: Pipeline) => {
    setPipelineToDelete(pipeline);
    setDeleteDialogOpen(true);
  };

  const handleDuplicatePipeline = (pipeline: Pipeline) => {
    setPipelineToDuplicate(pipeline);
    setDuplicateModalOpen(true);
  };

  const handleToggleStatus = async (pipeline: Pipeline) => {
    try {
      await pipelinesService.togglePipelineStatus(pipeline.id, !pipeline.is_active);
      toast.success(
        pipeline.is_active ? t('messages.deactivateSuccess') : t('messages.activateSuccess'),
      );
      loadPipelines();
    } catch (error) {
      console.error('Error toggling pipeline status:', error);
      toast.error(t('messages.toggleError'));
    }
  };

  const handleSetAsDefault = async (pipeline: Pipeline) => {
    if (!can('pipelines', 'update')) {
      toast.error(t('messages.noPermissionUpdate'));
      return;
    }

    try {
      await pipelinesService.setAsDefault(pipeline.id);
      toast.success(t('messages.setAsDefaultSuccess'));
      loadPipelines();
    } catch (error) {
      console.error('Error setting pipeline as default:', error);
      toast.error(t('messages.setAsDefaultError'));
    }
  };

  const handleViewPipeline = (pipeline: Pipeline) => {
    navigate(`/pipelines/${pipeline.id}`);
  };

  // Update pipeline
  const handleUpdatePipelineSubmit = async (data: UpdatePipelineData) => {
    if (!editingPipeline) return;

    setState(prev => ({ ...prev, loading: { ...prev.loading, update: true } }));

    try {
      await pipelinesService.updatePipeline(editingPipeline.id, data);
      toast.success(t('messages.updateSuccess'));
      loadPipelines();
      setEditModalOpen(false);
      setEditingPipeline(null);
    } catch (error) {
      console.error('Error updating pipeline:', error);
      toast.error(t('messages.updateError'));
    } finally {
      setState(prev => ({ ...prev, loading: { ...prev.loading, update: false } }));
    }
  };

  // Delete pipeline
  const confirmDeletePipeline = async () => {
    if (!pipelineToDelete) return;

    setState(prev => ({ ...prev, loading: { ...prev.loading, delete: true } }));

    try {
      await pipelinesService.deletePipeline(pipelineToDelete.id);
      toast.success(t('messages.deleteSuccess'));
      loadPipelines();
      setDeleteDialogOpen(false);
      setPipelineToDelete(null);
    } catch (error) {
      console.error('Error deleting pipeline:', error);
      toast.error(t('messages.deleteError'));
    } finally {
      setState(prev => ({ ...prev, loading: { ...prev.loading, delete: false } }));
    }
  };

  // Duplicate pipeline
  const handleDuplicatePipelineSubmit = async (data: { name: string; description?: string }) => {
    if (!pipelineToDuplicate) return;

    setState(prev => ({ ...prev, loading: { ...prev.loading, duplicate: true } }));

    try {
      const response = await pipelinesService.duplicatePipeline(pipelineToDuplicate.id, data);
      toast.success(t('messages.duplicateSuccess'));

      // Navigate to the new pipeline
      if (response.id) {
        navigate(`/pipelines/${response.id}`);
      } else {
        loadPipelines();
      }

      setDuplicateModalOpen(false);
      setPipelineToDuplicate(null);
    } catch (error) {
      console.error('Error duplicating pipeline:', error);
      toast.error(t('messages.duplicateError'));
    } finally {
      setState(prev => ({ ...prev, loading: { ...prev.loading, duplicate: false } }));
    }
  };

  // Filter pipelines by search
  const filteredPipelines = state.searchQuery
    ? state.pipelines.filter(
        pipeline =>
          pipeline.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
          pipeline.description?.toLowerCase().includes(state.searchQuery.toLowerCase()),
      )
    : state.pipelines;

  return (
    <div className="h-full flex flex-col p-4">
      <PipelinesTour />
      <div data-tour="pipelines-header">
        <PipelinesHeader
          totalCount={state.meta.pagination.total}
          searchValue={state.searchQuery}
          onSearchChange={handleSearchChange}
          onNewPipeline={handleCreatePipeline}
          canCreate={permissionsReady && can('pipelines', 'create')}
        />
      </div>

      {/* Content — list only (the mockup has no card/grid mode). BaseTable renders
          its own loading + empty states, matching the Contacts screen. */}
      <div className="flex-1 overflow-auto mt-4" data-tour="pipelines-list">
        <PipelinesTable
          pipelines={filteredPipelines}
          loading={state.loading.list}
          onView={handleViewPipeline}
          onEdit={handleEditPipeline}
          onDelete={handleDeletePipeline}
          onDuplicate={handleDuplicatePipeline}
          onToggleStatus={handleToggleStatus}
          onSetAsDefault={handleSetAsDefault}
          onCreate={!state.searchQuery ? handleCreatePipeline : undefined}
          sortBy={state.sortBy}
          sortOrder={state.sortOrder}
          onSort={column => {
            const newOrder =
              state.sortBy === column && state.sortOrder === 'asc' ? 'desc' : 'asc';
            setState(prev => ({ ...prev, sortBy: column, sortOrder: newOrder }));
            loadPipelines({
              sort: column as 'name' | 'created_at' | 'conversations_count',
              order: newOrder,
            });
          }}
        />
      </div>

      {/* Delete Pipeline Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dialog.deletePipeline.title')}</DialogTitle>
            <DialogDescription>{t('dialog.deletePipeline.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={state.loading.delete}
            >
              {t('dialog.deletePipeline.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeletePipeline}
              disabled={state.loading.delete}
            >
              {state.loading.delete
                ? t('dialog.deletePipeline.deleting')
                : t('dialog.deletePipeline.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Pipeline Modal */}
      {editingPipeline && (
        <EditPipelineModal
          open={editModalOpen}
          onOpenChange={open => {
            if (!open) {
              setEditModalOpen(false);
              setEditingPipeline(null);
            }
          }}
          pipeline={editingPipeline}
          onSubmit={handleUpdatePipelineSubmit}
          loading={state.loading.update}
        />
      )}

      {/* Duplicate Pipeline Modal */}
      {pipelineToDuplicate && (
        <DuplicatePipelineModal
          open={duplicateModalOpen}
          onOpenChange={open => {
            if (!open) {
              setDuplicateModalOpen(false);
              setPipelineToDuplicate(null);
            }
          }}
          pipeline={pipelineToDuplicate}
          onSubmit={handleDuplicatePipelineSubmit}
          loading={state.loading.duplicate}
        />
      )}
    </div>
  );
}
