import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@evoapi/design-system';
import { Plus, FileText, Users, Building2, Crosshair, Copy, Power, PowerOff, Images, Link2, MapPin, Trash2, ListChecks } from 'lucide-react';
import { BaseHeader } from '@/components/base';
import { MetaScopedEntityPicker } from '@/components/marketing/MetaScopedEntityPicker';
import { clientGoalsService } from '@/services/marketing/clientGoalsService';
import { LeadFormCreateDialog } from '@/components/marketing/LeadFormCreateDialog';
import LeadFormLeadsDialog from '@/components/marketing/LeadFormLeadsDialog';
import { AudienceCreateDialog } from '@/components/marketing/AudienceCreateDialog';
import { AudienceContactsPickerDialog } from '@/components/marketing/AudienceContactsPickerDialog';
import { TargetingBuilder } from '@/components/marketing/TargetingBuilder';
import { MetaAdAccountScopeProvider } from '@/components/marketing/MetaAdAccountScopeContext';
import { LocationGroupsTab } from '@/components/marketing/LocationGroupsTab';
import { MediaLibraryBrowser } from '@/components/marketing/MediaLibraryBrowser';
import { CriativoRequestsTab } from '@/components/marketing/CriativoRequestsTab';
import { MetaCreationAiButton } from '@/components/marketing/MetaCreationAiButton';
import { resolveLocationDraftPlaces, type AiMetaDraft } from '@/utils/marketing/aiMetaDraft';
import {
  metaCreationService,
  type LeadForm,
  type LeadFormDetail,
  type CustomAudience,
} from '@/services/marketing/metaCreationService';

const SUBTYPE_LABEL: Record<string, string> = {
  WEBSITE: 'Site (Pixel)',
  VIDEO: 'Vídeo',
  ENGAGEMENT: 'Facebook Page',
  IG_ACCOUNT: 'Instagram',
  APP: 'App',
  APP_EVENT: 'App (evento)',
  CUSTOM: 'Lista de clientes',
  LOOKALIKE: 'Semelhante',
  SAVED_AUDIENCE: 'Público salvo',
  SMART_AUDIENCE: 'Público inteligente',
  MULTI_DATA: 'Público combinado',
};

function formatSize(a: CustomAudience): string {
  if (a.approximate_count_lower_bound == null) return 'Calculando...';
  const lo = a.approximate_count_lower_bound.toLocaleString('pt-BR');
  const hi = a.approximate_count_upper_bound?.toLocaleString('pt-BR');
  return hi && hi !== lo ? `${lo} - ${hi} pessoas` : `${lo} pessoas`;
}

interface DuplicateContext {
  sourcePageId: string;
  formId: string;
  detail: LeadFormDetail;
}

export default function MetaCreationPage() {
  // Formulários — pertencem a uma Página (não à conta de anúncio), por isso
  // o seletor aqui é BM > Página, diferente das outras abas (BM > Conta).
  const [page, setPage] = useState<{ id: string; name: string } | null>(null);
  // BM selecionada + contador de reset: o breadcrumb (BM / Página-Conta)
  // precisa devolver o picker pro passo certo sem perder a BM escolhida.
  const [pageBm, setPageBm] = useState<{ id: string; name: string } | null>(null);
  const [pagePickerKey, setPagePickerKey] = useState(0);
  const [forms, setForms] = useState<LeadForm[] | null>(null);
  const [loadingForms, setLoadingForms] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [duplicateContext, setDuplicateContext] = useState<DuplicateContext | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [loadingFormAction, setLoadingFormAction] = useState<string | null>(null);
  const [leadsForm, setLeadsForm] = useState<LeadForm | null>(null);

  // Públicos
  const [account, setAccount] = useState<{ id: string; name: string } | null>(null);
  const [accountBm, setAccountBm] = useState<{ id: string; name: string } | null>(null);
  const [accountPickerKey, setAccountPickerKey] = useState(0);
  const [audiences, setAudiences] = useState<CustomAudience[] | null>(null);
  const [loadingAudiences, setLoadingAudiences] = useState(false);
  const [audienceDialogOpen, setAudienceDialogOpen] = useState(false);
  const [pendingCustomerList, setPendingCustomerList] = useState<CustomAudience | null>(null);
  const [duplicateAudienceFrom, setDuplicateAudienceFrom] = useState<CustomAudience | null>(null);
  // Aba controlada: o público salvo (direcionamento completo) é criado em outra
  // aba, então o diálogo de público personalizado pode mandar o usuário pra lá.
  const [activeTab, setActiveTab] = useState('forms');

  // Rascunhos do Assistente de IA (botão de robô, ver MetaCreationAiButton.tsx):
  // cada um só preenche o formulário correspondente, nunca cria nada sozinho.
  const [audienceAiDraft, setAudienceAiDraft] = useState<NonNullable<
    ComponentProps<typeof AudienceCreateDialog>['initialDraft']
  > | null>(null);
  const [targetingAiDraft, setTargetingAiDraft] = useState<NonNullable<
    NonNullable<ComponentProps<typeof TargetingBuilder>>['initialDraft']
  > | null>(null);
  const [locationAiDraft, setLocationAiDraft] = useState<NonNullable<
    NonNullable<ComponentProps<typeof LocationGroupsTab>>['initialDraft']
  > | null>(null);

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

  const loadAudiences = useCallback((accountId: string) => {
    setLoadingAudiences(true);
    metaCreationService
      .listAudiences(accountId)
      .then(setAudiences)
      .catch(() => toast.error('Erro ao carregar públicos'))
      .finally(() => setLoadingAudiences(false));
  }, []);

  useEffect(() => {
    if (account) loadAudiences(account.id);
  }, [account, loadAudiences]);

  // Exclusão do público: definitiva e sem volta na Graph API (o público some
  // da conta e os conjuntos que apontam pra ele perdem a fonte), então o nome
  // vai no confirm() antes de chamar. Público semelhante não pode ser
  // excluído pela API — o backend recusa, e a mensagem vai pro toast.
  const [deletingAudienceId, setDeletingAudienceId] = useState<string | null>(null);

  const handleDeleteAudience = async (audience: CustomAudience) => {
    if (deletingAudienceId) return;
    const confirmed = window.confirm(
      `Excluir o público "${audience.name}"?\n\nIsso é definitivo: o público é apagado da conta na Meta e não pode ser recuperado.`,
    );
    if (!confirmed) return;

    setDeletingAudienceId(audience.id);
    try {
      await metaCreationService.deleteAudience(audience.id);
      toast.success(`Público "${audience.name}" excluído.`);
      if (account) loadAudiences(account.id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível excluir o público. A Meta pode ter recusado.',
      );
    } finally {
      setDeletingAudienceId(null);
    }
  };

  // Rascunho do Assistente de IA (ver MetaCreationAiButton.tsx / aiMetaDraft.ts):
  // só troca de aba e preenche o formulário certo — nada aqui chama a Graph
  // API, quem cria de verdade é sempre o usuário, nos mesmos diálogos de
  // sempre. Localização precisa geocodificar os nomes de lugar antes (a IA
  // só devolve texto, nunca lat/lng), por isso é assíncrono.
  const handleAiDraft = async (draft: AiMetaDraft) => {
    if (!account) {
      toast.error('Selecione uma conta de anúncio antes de usar o assistente de IA.');
      return;
    }
    if (draft.kind === 'audience') {
      setAudienceAiDraft(draft.data);
      setActiveTab('audiences');
      setAudienceDialogOpen(true);
      return;
    }
    if (draft.kind === 'targeting_list') {
      setTargetingAiDraft(draft.data);
      setActiveTab('targeting');
      return;
    }
    if (draft.kind === 'location_group') {
      const places = draft.data.places || [];
      const locations = await resolveLocationDraftPlaces(places);
      if (!locations.length) {
        toast.error('Não consegui encontrar nenhum dos lugares que a IA sugeriu.');
        return;
      }
      if (locations.length < places.length) {
        toast.warning(`${places.length - locations.length} lugar(es) sugerido(s) não foi(ram) encontrado(s).`);
      }
      setLocationAiDraft({ name: draft.data.name, locations });
      setActiveTab('location-groups');
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-start justify-between gap-2">
        <BaseHeader title="Criação Meta" subtitle="Crie formulários de lead e públicos direto na Meta Ads." />
        <MetaCreationAiButton onDraft={handleAiDraft} />
      </div>

      <MetaAdAccountScopeProvider
        value={{
          account,
          setAccount,
          bm: accountBm,
          setBm: setAccountBm,
          pickerKey: accountPickerKey,
          resetPicker: () => setAccountPickerKey((k) => k + 1),
        }}
      >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="forms">
            <FileText className="w-4 h-4 mr-1.5" /> Formulários
          </TabsTrigger>
          <TabsTrigger value="audiences">
            <Users className="w-4 h-4 mr-1.5" /> Públicos
          </TabsTrigger>
          <TabsTrigger value="targeting">
            <Crosshair className="w-4 h-4 mr-1.5" /> Direcionamento
          </TabsTrigger>
          <TabsTrigger value="location-groups">
            <MapPin className="w-4 h-4 mr-1.5" /> Grupos de Localização
          </TabsTrigger>
          <TabsTrigger value="media">
            <Images className="w-4 h-4 mr-1.5" /> Biblioteca de mídias
          </TabsTrigger>
          <TabsTrigger value="solicitar-criativo">
            <Link2 className="w-4 h-4 mr-1.5" /> Solicitar Criativo
          </TabsTrigger>
        </TabsList>

        {/* --- Formulários --- */}
        <TabsContent value="forms" className="space-y-4">
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
                <Button onClick={() => setFormDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" /> Novo formulário
                </Button>
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
                      <div className="flex gap-1.5 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loadingFormAction === form.id}
                          onClick={() => toggleFormStatus(form)}
                        >
                          {form.status === 'ACTIVE' ? (
                            <>
                              <PowerOff className="w-3.5 h-3.5 mr-1" /> Pausar
                            </>
                          ) : (
                            <>
                              <Power className="w-3.5 h-3.5 mr-1" /> Ativar
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loadingFormAction === form.id}
                          onClick={() => openDuplicate(form)}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" /> Duplicar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setLeadsForm(form)}>
                          <ListChecks className="w-3.5 h-3.5 mr-1" /> Ver leads
                        </Button>
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
            </>
          )}
        </TabsContent>

        {/* --- Públicos --- */}
        <TabsContent value="audiences" className="space-y-4">
          {!account ? (
            <MetaScopedEntityPicker
              stepTwoLabel="Conta de anúncio"
              fetchStepTwo={(bmId) => clientGoalsService.listAdAccountsForBm(bmId)}
              onSelect={setAccount}
              selectedBm={accountBm}
              onSelectBm={setAccountBm}
              resetKey={accountPickerKey}
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                    <Building2 className="w-3.5 h-3.5" />
                  </span>
                  {accountBm && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setAccount(null);
                          setAccountBm(null);
                        }}
                        className="text-primary hover:underline break-words min-w-0"
                        title={accountBm.name}
                      >
                        {accountBm.name}
                      </button>
                      <span className="text-muted-foreground/60">/</span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAccount(null);
                      setAccountPickerKey((k) => k + 1);
                    }}
                    className="text-primary hover:underline break-words min-w-0"
                    title={account.name}
                  >
                    {account.name}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setActiveTab('targeting')}>
                    <Crosshair className="w-4 h-4 mr-1.5" /> Novo público salvo
                  </Button>
                  <Button onClick={() => setAudienceDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-1.5" /> Novo público
                  </Button>
                </div>
              </div>

              {loadingAudiences ? (
                <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
              ) : !audiences || audiences.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-10 border border-dashed rounded-md">
                  Nenhum público criado ainda nesta conta.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {audiences.map((a) => (
                    <div key={a.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold break-words min-w-0" title={a.name}>
                          {a.name}
                        </h4>
                        <Badge variant="outline" className="shrink-0">
                          {SUBTYPE_LABEL[a.subtype] || a.subtype}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">ID: {a.id}</p>
                      <p className="text-xs font-medium">{formatSize(a)}</p>
                      {a.delivery_status?.description && (
                        <p className="text-[0.65rem] text-muted-foreground">{a.delivery_status.description}</p>
                      )}
                      <div className="pt-1 flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setDuplicateAudienceFrom(a)}>
                          <Copy className="w-3.5 h-3.5 mr-1" /> Duplicar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteAudience(a)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <AudienceCreateDialog
                open={audienceDialogOpen}
                onOpenChange={(open) => {
                  setAudienceDialogOpen(open);
                  if (!open) setAudienceAiDraft(null);
                }}
                adAccountId={account.id}
                businessId={accountBm?.id ?? null}
                existingAudiences={audiences || []}
                onCreated={() => loadAudiences(account.id)}
                onGoToSavedAudience={() => setActiveTab('targeting')}
                onCustomerListCreated={(audience) => {
                  setPendingCustomerList(audience);
                  loadAudiences(account.id);
                }}
                initialDraft={audienceAiDraft}
              />

              <AudienceCreateDialog
                open={Boolean(duplicateAudienceFrom)}
                onOpenChange={(open) => !open && setDuplicateAudienceFrom(null)}
                adAccountId={account.id}
                currentAccountName={account.name}
                businessId={accountBm?.id ?? null}
                existingAudiences={audiences || []}
                duplicateFrom={duplicateAudienceFrom}
                onCreated={() => loadAudiences(account.id)}
                onGoToSavedAudience={() => setActiveTab('targeting')}
                onCustomerListCreated={(audience) => {
                  setPendingCustomerList(audience);
                  loadAudiences(account.id);
                }}
              />

              <AudienceContactsPickerDialog
                audienceId={pendingCustomerList?.id ?? null}
                audienceName={pendingCustomerList?.name ?? ''}
                onOpenChange={(open) => !open && setPendingCustomerList(null)}
                onDone={() => setPendingCustomerList(null)}
              />
            </>
          )}
        </TabsContent>

        {/* --- Direcionamento Detalhado --- */}
        <TabsContent value="media" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Guarde imagens e vídeos no seu Google Drive ou Dropbox e use direto nos anúncios (Painel Tráfego &gt; Criar Campanha / Editar
            Anúncio). Crie pastas para organizar por cliente ou campanha.
          </p>
          <MediaLibraryBrowser mode="manage" />
        </TabsContent>

        <TabsContent value="targeting">
          <TargetingBuilder initialDraft={targetingAiDraft} />
        </TabsContent>

        <TabsContent value="location-groups">
          <LocationGroupsTab initialDraft={locationAiDraft} />
        </TabsContent>

        {/* --- Solicitar Criativo --- */}
        <TabsContent value="solicitar-criativo">
          <CriativoRequestsTab />
        </TabsContent>
      </Tabs>
      </MetaAdAccountScopeProvider>
    </div>
  );
}
