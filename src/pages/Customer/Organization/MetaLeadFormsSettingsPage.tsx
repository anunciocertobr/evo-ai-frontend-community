import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, AlertTriangle, RefreshCw, Search } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@evoapi/design-system';
import { BaseHeader } from '@/components/base';
import { gestorPostsService } from '@/services/marketing/gestorPostsService';
import { metaCreationService, LeadForm } from '@/services/marketing/metaCreationService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { metaLeadFormsService, MetaLeadForm as MetaLeadFormMapping, MetaLeadSubmission } from '@/services/admin/metaLeadFormsService';
import type { FacebookAccessiblePage } from '@/types/marketing/gestorPosts';
import type { Pipeline, PipelineStage } from '@/types/analytics';

export default function MetaLeadFormsSettingsPage() {
  const [mappings, setMappings] = useState<MetaLeadFormMapping[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(true);
  const [mappingSearch, setMappingSearch] = useState('');

  const [submissions, setSubmissions] = useState<MetaLeadSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [submissionSearch, setSubmissionSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pages, setPages] = useState<FacebookAccessiblePage[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedBmId, setSelectedBmId] = useState('');
  const [selectedPageId, setSelectedPageId] = useState('');

  const [forms, setForms] = useState<LeadForm[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState('');

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState('');

  const loadMappings = useCallback(async () => {
    setLoadingMappings(true);
    try {
      setMappings(await metaLeadFormsService.list());
    } catch {
      toast.error('Falha ao carregar os formulários mapeados.');
    } finally {
      setLoadingMappings(false);
    }
  }, []);

  const loadSubmissions = useCallback(async () => {
    setLoadingSubmissions(true);
    try {
      setSubmissions(await metaLeadFormsService.listSubmissions());
    } catch {
      toast.error('Falha ao carregar os leads retidos.');
    } finally {
      setLoadingSubmissions(false);
    }
  }, []);

  useEffect(() => {
    loadMappings();
    loadSubmissions();
  }, [loadMappings, loadSubmissions]);

  const openModal = async () => {
    setModalOpen(true);
    setSelectedBmId('');
    setSelectedPageId('');
    setSelectedFormId('');
    setSelectedPipelineId('');
    setSelectedStageId('');
    setForms([]);
    setStages([]);

    setLoadingPages(true);
    try {
      const [accessiblePages, pipelineList] = await Promise.all([
        gestorPostsService.getAccessibleFacebookPages(),
        pipelinesService.getPipelines(),
      ]);
      setPages(accessiblePages);
      setPipelines(pipelineList.data || []);
    } catch {
      toast.error('Falha ao carregar Páginas/Pipelines.');
    } finally {
      setLoadingPages(false);
    }
  };

  // business{id,name} já vem de graça no mesmo /me/accounts que lista as
  // páginas (ver Facebook::AccessiblePagesService) — não precisa de chamada
  // extra por BM, só agrupar as páginas já carregadas. Página pessoal sem BM
  // (business_id null) fica de fora da lista de BMs, mas continua aparecendo
  // no select de página quando nenhuma BM está selecionada.
  const bms = useMemo(() => {
    const seen = new Map<string, string>();
    pages.forEach((p) => {
      if (p.business_id && !seen.has(p.business_id)) seen.set(p.business_id, p.business_name || p.business_id as string);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [pages]);

  const pagesForSelectedBm = useMemo(
    () => (selectedBmId ? pages.filter((p) => p.business_id === selectedBmId) : pages),
    [pages, selectedBmId],
  );

  const handleBmChange = (bmId: string) => {
    setSelectedBmId(bmId);
    setSelectedPageId('');
    setSelectedFormId('');
    setForms([]);
  };

  const handlePageChange = async (pageId: string) => {
    setSelectedPageId(pageId);
    setSelectedFormId('');
    setForms([]);
    setLoadingForms(true);
    try {
      setForms(await metaCreationService.listLeadForms(pageId));
    } catch {
      toast.error('Falha ao buscar os formulários dessa Página.');
    } finally {
      setLoadingForms(false);
    }
  };

  const handlePipelineChange = async (pipelineId: string) => {
    setSelectedPipelineId(pipelineId);
    setSelectedStageId('');
    setStages([]);
    setLoadingStages(true);
    try {
      const pipeline = await pipelinesService.getPipeline(pipelineId);
      setStages(pipeline.stages || []);
    } catch {
      toast.error('Falha ao buscar os estágios desse Pipeline.');
    } finally {
      setLoadingStages(false);
    }
  };

  const handleSave = async () => {
    if (!selectedPageId || !selectedFormId || !selectedPipelineId || !selectedStageId) return;

    const form = forms.find((f) => f.id === selectedFormId);
    setSaving(true);
    try {
      await metaLeadFormsService.create({
        page_id: selectedPageId,
        form_id: selectedFormId,
        form_name: form?.name,
        pipeline_id: selectedPipelineId,
        pipeline_stage_id: selectedStageId,
      });
      toast.success('Formulário mapeado! Leads retidos desse formulário já foram processados.');
      setModalOpen(false);
      loadMappings();
      loadSubmissions();
    } catch {
      toast.error('Falha ao salvar o mapeamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (mapping: MetaLeadFormMapping) => {
    try {
      await metaLeadFormsService.remove(mapping.id);
      setMappings((prev) => prev.filter((m) => m.id !== mapping.id));
      toast.success('Mapeamento removido.');
    } catch {
      toast.error('Falha ao remover o mapeamento.');
    }
  };

  const filteredMappings = useMemo(() => {
    const term = mappingSearch.trim().toLowerCase();
    if (!term) return mappings;
    return mappings.filter((m) =>
      [m.form_name, m.form_id, m.pipeline_name, m.pipeline_stage_name].some((v) => v?.toLowerCase().includes(term)),
    );
  }, [mappings, mappingSearch]);

  const filteredSubmissions = useMemo(() => {
    const term = submissionSearch.trim().toLowerCase();
    if (!term) return submissions;
    return submissions.filter((s) => {
      const campos = [s.form_id, s.error_message, ...(s.field_data?.flatMap((f) => f.values) || [])];
      return campos.some((v) => v?.toLowerCase().includes(term));
    });
  }, [submissions, submissionSearch]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <BaseHeader
        title="Lead Ads (Meta)"
        subtitle="Formulários instantâneos do Facebook/Instagram que entram automaticamente no Pipeline certo."
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Formulários mapeados</CardTitle>
          <Button onClick={openModal}>
            <Plus className="h-4 w-4 mr-2" /> Mapear formulário
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {mappings.length > 0 && (
            <div className="relative max-w-xs">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={mappingSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMappingSearch(e.target.value)}
                placeholder="Buscar formulário..."
                className="pl-8"
              />
            </div>
          )}
          {loadingMappings ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : mappings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum formulário mapeado ainda. Leads que chegarem antes de mapear o formulário ficam retidos (veja
              abaixo) até você mapear.
            </p>
          ) : filteredMappings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum formulário mapeado encontrado pra essa busca.</p>
          ) : (
            <div className="space-y-2">
              {filteredMappings.map((m) => (
                <div key={m.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.form_name || m.form_id}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      → {m.pipeline_name || m.pipeline_id} / {m.pipeline_stage_name || m.pipeline_stage_id}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(m)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Leads retidos
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={loadSubmissions}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {submissions.length > 0 && (
            <div className="relative max-w-xs">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={submissionSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubmissionSearch(e.target.value)}
                placeholder="Buscar lead retido..."
                className="pl-8"
              />
            </div>
          )}
          {loadingSubmissions ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lead retido — tudo processado.</p>
          ) : filteredSubmissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lead retido encontrado pra essa busca.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {filteredSubmissions.map((s) => (
                <div key={s.id} className="border rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Badge variant={s.status === 'error' ? 'destructive' : 'secondary'}>
                      {s.status === 'unmapped_form' ? 'Formulário não mapeado' : 'Erro'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{s.form_id}</span>
                  </div>
                  {s.error_message && <p className="text-xs text-destructive mb-1">{s.error_message}</p>}
                  <p className="text-xs text-muted-foreground">
                    {s.field_data.map((f) => `${f.name}: ${f.values?.[0]}`).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mapear formulário Meta</DialogTitle>
            <DialogDescription>
              Escolha a Página, o formulário instantâneo dela, e pra qual Pipeline/Estágio os leads devem entrar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {bms.length > 0 && (
              <div className="space-y-1.5">
                <Label>Business Manager</Label>
                <Select value={selectedBmId} onValueChange={handleBmChange} disabled={loadingPages}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas (opcional, só pra filtrar a lista de páginas)" />
                  </SelectTrigger>
                  <SelectContent>
                    {bms.map((bm) => (
                      <SelectItem key={bm.id} value={bm.id}>
                        {bm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Página do Facebook</Label>
              <Select value={selectedPageId} onValueChange={handlePageChange} disabled={loadingPages}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingPages ? 'Carregando...' : 'Selecione a página'} />
                </SelectTrigger>
                <SelectContent>
                  {pagesForSelectedBm.map((p) => (
                    <SelectItem key={p.page_id} value={p.page_id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Formulário</Label>
              <Select value={selectedFormId} onValueChange={setSelectedFormId} disabled={!selectedPageId || loadingForms}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingForms ? 'Carregando...' : 'Selecione o formulário'} />
                </SelectTrigger>
                <SelectContent>
                  {forms.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Pipeline</Label>
              <Select value={selectedPipelineId} onValueChange={handlePipelineChange} disabled={loadingPages}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Estágio</Label>
              <Select value={selectedStageId} onValueChange={setSelectedStageId} disabled={!selectedPipelineId || loadingStages}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingStages ? 'Carregando...' : 'Selecione o estágio'} />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !selectedPageId || !selectedFormId || !selectedPipelineId || !selectedStageId}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
