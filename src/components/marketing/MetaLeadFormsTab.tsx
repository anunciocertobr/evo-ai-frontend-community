import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Badge, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@evoapi/design-system';
import { Plus, Building2, Copy, Power, PowerOff, Bell, Search, MoreVertical, Crosshair, ListChecks } from 'lucide-react';
import { MetaScopedEntityPicker } from '@/components/marketing/MetaScopedEntityPicker';
import { LeadFormCreateDialog } from '@/components/marketing/LeadFormCreateDialog';
import { LeadgenSubscriptionButton } from '@/components/marketing/LeadgenSubscriptionButton';
import LeadFormLeadsDialog from '@/components/marketing/LeadFormLeadsDialog';
import { LeadFormNotifySettingsDialog } from '@/components/marketing/LeadFormNotifySettingsDialog';
import { MetaLeadFormPipelineDialog } from '@/components/marketing/MetaLeadFormPipelineDialog';
import { MetaLeadsNotifyPageDialog } from '@/components/marketing/MetaLeadsNotifyPageDialog';
import { MetaLeadsPipelineDefaultDialog } from '@/components/marketing/MetaLeadsPipelineDefaultDialog';
import LeadSearchDialog from '@/components/marketing/LeadSearchDialog';
import { metaCreationService, type LeadForm, type LeadFormDetail } from '@/services/marketing/metaCreationService';
import { metaLeadNotificationSettingsService } from '@/services/admin/metaLeadNotificationSettingsService';
import { metaLeadPageSettingsService } from '@/services/admin/metaLeadPageSettingsService';
import { adminConfigService } from '@/services/admin/adminConfigService';

interface DuplicateContext {
  sourcePageId: string;
  formId: string;
  detail: LeadFormDetail;
}

// Extraído de MetaCreationPage.tsx (aba "Formulários" de Criação Meta) pra
// ser usado em dois lugares com o MESMO comportamento: a própria Criação
// Meta e a aba "Formulário" de Rastreamentos (pedido do usuário: "quero
// que abra exatamente de marketing criar meta... só estou centralizando
// em um lugar") — nenhuma lógica nova aqui, só movida pra um componente
// compartilhado. Autocontido: toda a seleção de Página/formulário e os
// diálogos vivem aqui dentro, nada depende do estado do resto da página
// de Criação Meta (Públicos/Direcionamento/etc. continuam lá).
export function MetaLeadFormsTab() {
  const [page, setPage] = useState<{ id: string; name: string } | null>(null);
  const [pageBm, setPageBm] = useState<{ id: string; name: string } | null>(null);
  const [pagePickerKey, setPagePickerKey] = useState(0);
  const [forms, setForms] = useState<LeadForm[] | null>(null);
  const [loadingForms, setLoadingForms] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [duplicateContext, setDuplicateContext] = useState<DuplicateContext | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [loadingFormAction, setLoadingFormAction] = useState<string | null>(null);
  const [leadsForm, setLeadsForm] = useState<LeadForm | null>(null);
  const [notifyForm, setNotifyForm] = useState<LeadForm | null>(null);
  const [pipelineForm, setPipelineForm] = useState<LeadForm | null>(null);
  const [notifyDefaultOpen, setNotifyDefaultOpen] = useState(false);
  const [searchLeadsOpen, setSearchLeadsOpen] = useState(false);
  const [enabledNotifyFormIds, setEnabledNotifyFormIds] = useState<Set<string>>(new Set());
  const [defaultNotifyEnabled, setDefaultNotifyEnabled] = useState(false);
  const [pipelineDefaultOpen, setPipelineDefaultOpen] = useState(false);
  const [pipelineDefaultEnabled, setPipelineDefaultEnabled] = useState(false);

  const loadForms = useCallback((pageId: string) => {
    setLoadingForms(true);
    metaCreationService
      .listLeadForms(pageId)
      .then(setForms)
      .catch(() => toast.error('Erro ao carregar formulários'))
      .finally(() => setLoadingForms(false));
  }, []);

  useEffect(() => {
    if (page) loadForms(page.id);
  }, [page, loadForms]);

  const loadDefaultNotifySetting = useCallback(() => {
    if (!page) return;
    metaLeadPageSettingsService
      .get(page.id)
      .then((settings) => setDefaultNotifyEnabled(settings.channels.length > 0))
      .catch(() => {});
  }, [page]);

  const loadDefaultPipelineSetting = useCallback(() => {
    adminConfigService
      .getConfig('meta_leads_pipeline_default')
      .then((config) => setPipelineDefaultEnabled(Boolean(config?.META_LEADS_PIPELINE_ID && config?.META_LEADS_STAGE_ID)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadDefaultNotifySetting();
  }, [loadDefaultNotifySetting]);

  useEffect(() => {
    loadDefaultPipelineSetting();
  }, [loadDefaultPipelineSetting]);

  const loadNotifySettingsForForms = useCallback((formIds: string[]) => {
    if (formIds.length === 0) {
      setEnabledNotifyFormIds(new Set());
      return;
    }
    metaLeadNotificationSettingsService
      .list(formIds)
      .then((settings) => setEnabledNotifyFormIds(new Set(settings.filter((s) => s.enabled).map((s) => s.form_id))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadNotifySettingsForForms((forms || []).map((f) => f.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forms]);

  const toggleFormStatus = async (form: LeadForm) => {
    if (!page) return;
    const nextStatus = form.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    setLoadingFormAction(form.id);
    try {
      await metaCreationService.updateLeadFormStatus(page.id, form.id, nextStatus);
      toast.success(nextStatus === 'ACTIVE' ? 'Formulário ativado' : 'Formulário pausado');
      loadForms(page.id);
    } catch {
      toast.error('Erro ao atualizar o status do formulário');
    } finally {
      setLoadingFormAction(null);
    }
  };

  const openDuplicate = async (form: LeadForm) => {
    if (!page) return;
    setLoadingFormAction(form.id);
    try {
      const detail = await metaCreationService.getLeadFormDetail(page.id, form.id);
      setDuplicateContext({ sourcePageId: page.id, formId: form.id, detail });
      setDuplicateDialogOpen(true);
    } catch {
      toast.error('Erro ao carregar os detalhes do formulário');
    } finally {
      setLoadingFormAction(null);
    }
  };

  return (
    <div className="space-y-4">
      {!page ? (
        <MetaScopedEntityPicker
          stepTwoLabel="Página"
          fetchStepTwo={(bmId) => metaCreationService.listPagesForBm(bmId)}
          onSelect={setPage}
          selectedBm={pageBm}
          onSelectBm={setPageBm}
          resetKey={pagePickerKey}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                <Building2 className="w-3.5 h-3.5" />
              </span>
              {pageBm && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setPage(null);
                      setPageBm(null);
                    }}
                    className="text-primary hover:underline break-words min-w-0"
                    title={pageBm.name}
                  >
                    {pageBm.name}
                  </button>
                  <span className="text-muted-foreground/60">/</span>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setPage(null);
                  setPagePickerKey((k) => k + 1);
                }}
                className="text-primary hover:underline break-words min-w-0"
                title={page.name}
              >
                {page.name}
              </button>
            </div>
            <div className="flex gap-1.5">
              <Button variant="outline" onClick={() => setSearchLeadsOpen(true)}>
                <Search className="w-4 h-4 mr-1.5" /> Buscar lead
              </Button>
              <Button
                variant="outline"
                onClick={() => setNotifyDefaultOpen(true)}
                className={defaultNotifyEnabled ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400' : ''}
                title="Vale só pros formulários desta Página"
              >
                <Bell className={`w-4 h-4 mr-1.5 ${defaultNotifyEnabled ? 'fill-emerald-500/30' : ''}`} /> Notificações desta Página
              </Button>
              <Button
                variant="outline"
                onClick={() => setPipelineDefaultOpen(true)}
                className={pipelineDefaultEnabled ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400' : ''}
              >
                <Crosshair className={`w-4 h-4 mr-1.5 ${pipelineDefaultEnabled ? 'fill-emerald-500/30' : ''}`} /> Pipeline padrão
              </Button>
              <LeadgenSubscriptionButton pageId={page.id} pageName={page.name} />
              <Button onClick={() => setFormDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> Novo formulário
              </Button>
            </div>
          </div>

          {loadingForms ? (
            <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
          ) : !forms || forms.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10 border border-dashed rounded-md">
              Nenhum formulário cadastrado ainda nesta Página.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {forms.map((form) => (
                <div key={form.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold truncate" title={form.name}>
                      {form.name}
                    </h4>
                    <Badge variant={form.status === 'ACTIVE' ? 'default' : 'secondary'}>{form.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">ID: {form.id}</p>
                  <p className="text-xs">
                    <span className="font-medium">{form.leads_count ?? 0}</span> leads recebidos
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 min-w-0" onClick={() => setLeadsForm(form)}>
                      <ListChecks className="w-3.5 h-3.5 mr-1 shrink-0" />
                      <span className="truncate">Ver leads</span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="shrink-0 px-2">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled={loadingFormAction === form.id} onClick={() => toggleFormStatus(form)}>
                          {form.status === 'ACTIVE' ? (
                            <>
                              <PowerOff className="w-3.5 h-3.5 mr-2" /> Pausar
                            </>
                          ) : (
                            <>
                              <Power className="w-3.5 h-3.5 mr-2" /> Ativar
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={loadingFormAction === form.id} onClick={() => openDuplicate(form)}>
                          <Copy className="w-3.5 h-3.5 mr-2" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setNotifyForm(form)}>
                          <Bell
                            className={`w-3.5 h-3.5 mr-2 ${enabledNotifyFormIds.has(form.id) ? 'fill-emerald-500/30 text-emerald-600 dark:text-emerald-400' : ''}`}
                          />
                          Notificar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPipelineForm(form)}>
                          <Crosshair className="w-3.5 h-3.5 mr-2" />
                          Kanban
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            A Meta não permite editar um formulário publicado — só ativar/pausar, ou duplicar pra ajustar e
            publicar de novo (inclusive numa Página diferente).
          </p>

          <LeadFormCreateDialog
            open={formDialogOpen}
            onOpenChange={setFormDialogOpen}
            onSaved={() => page && loadForms(page.id)}
            defaultPage={page}
          />

          <LeadFormCreateDialog
            open={duplicateDialogOpen}
            onOpenChange={(open) => {
              setDuplicateDialogOpen(open);
              if (!open) setDuplicateContext(null);
            }}
            onSaved={() => page && loadForms(page.id)}
            defaultPage={page}
            duplicateFrom={duplicateContext}
          />

          {leadsForm && (
            <LeadFormLeadsDialog
              open={Boolean(leadsForm)}
              onOpenChange={(open) => !open && setLeadsForm(null)}
              pageId={page.id}
              formId={leadsForm.id}
              formName={leadsForm.name}
            />
          )}

          {notifyForm && (
            <LeadFormNotifySettingsDialog
              open={Boolean(notifyForm)}
              onOpenChange={(open) => {
                if (!open) {
                  setNotifyForm(null);
                  loadNotifySettingsForForms((forms || []).map((f) => f.id));
                }
              }}
              pageId={page.id}
              formId={notifyForm.id}
              formName={notifyForm.name}
            />
          )}

          {pipelineForm && (
            <MetaLeadFormPipelineDialog
              open={Boolean(pipelineForm)}
              onOpenChange={(open) => !open && setPipelineForm(null)}
              pageId={page.id}
              formId={pipelineForm.id}
              formName={pipelineForm.name}
            />
          )}

          <MetaLeadsNotifyPageDialog
            open={notifyDefaultOpen}
            onOpenChange={(open) => {
              setNotifyDefaultOpen(open);
              if (!open) loadDefaultNotifySetting();
            }}
            pageId={page.id}
            pageName={page.name}
          />

          <MetaLeadsPipelineDefaultDialog
            open={pipelineDefaultOpen}
            onOpenChange={(open) => {
              setPipelineDefaultOpen(open);
              if (!open) loadDefaultPipelineSetting();
            }}
          />

          <LeadSearchDialog open={searchLeadsOpen} onOpenChange={setSearchLeadsOpen} pageId={page.id} pageName={page.name} />
        </>
      )}
    </div>
  );
}
