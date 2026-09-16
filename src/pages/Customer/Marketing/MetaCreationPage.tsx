import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@evoapi/design-system';
import { Plus, FileText, Users, Building2, Crosshair, Copy, Power, PowerOff, ArrowLeftRight } from 'lucide-react';
import { BaseHeader } from '@/components/base';
import { MetaScopedEntityPicker } from '@/components/marketing/MetaScopedEntityPicker';
import { clientGoalsService } from '@/services/marketing/clientGoalsService';
import { LeadFormCreateDialog } from '@/components/marketing/LeadFormCreateDialog';
import { AudienceCreateDialog } from '@/components/marketing/AudienceCreateDialog';
import { AudienceContactsPickerDialog } from '@/components/marketing/AudienceContactsPickerDialog';
import { TargetingBuilder } from '@/components/marketing/TargetingBuilder';
import {
  metaCreationService,
  type LeadForm,
  type LeadFormDetail,
  type CustomAudience,
} from '@/services/marketing/metaCreationService';

const SUBTYPE_LABEL: Record<string, string> = {
  WEBSITE: 'Site (Pixel)',
  LOOKALIKE: 'Semelhante',
  CUSTOM: 'Lista de clientes',
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
  const [forms, setForms] = useState<LeadForm[] | null>(null);
  const [loadingForms, setLoadingForms] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [duplicateContext, setDuplicateContext] = useState<DuplicateContext | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [loadingFormAction, setLoadingFormAction] = useState<string | null>(null);

  // Públicos
  const [account, setAccount] = useState<{ id: string; name: string } | null>(null);
  const [audiences, setAudiences] = useState<CustomAudience[] | null>(null);
  const [loadingAudiences, setLoadingAudiences] = useState(false);
  const [audienceDialogOpen, setAudienceDialogOpen] = useState(false);
  const [pendingCustomerList, setPendingCustomerList] = useState<CustomAudience | null>(null);

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

  return (
    <div className="space-y-4 pb-8">
      <BaseHeader title="Criação Meta" subtitle="Crie formulários de lead e públicos direto na Meta Ads." />

      <Tabs defaultValue="forms">
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
        </TabsList>

        {/* --- Formulários --- */}
        <TabsContent value="forms" className="space-y-4">
          {!page ? (
            <MetaScopedEntityPicker
              stepTwoLabel="Página"
              fetchStepTwo={(bmId) => metaCreationService.listPagesForBm(bmId)}
              onSelect={setPage}
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> {page.name}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setPage(null)}>
                    <ArrowLeftRight className="w-3.5 h-3.5 mr-1" /> Trocar
                  </Button>
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
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> {account.name}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setAccount(null)}>
                    <ArrowLeftRight className="w-3.5 h-3.5 mr-1" /> Trocar
                  </Button>
                </div>
                <Button onClick={() => setAudienceDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" /> Novo público
                </Button>
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
                        <h4 className="text-sm font-semibold truncate" title={a.name}>
                          {a.name}
                        </h4>
                        <Badge variant="outline">{SUBTYPE_LABEL[a.subtype] || a.subtype}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">ID: {a.id}</p>
                      <p className="text-xs font-medium">{formatSize(a)}</p>
                      {a.delivery_status?.description && (
                        <p className="text-[0.65rem] text-muted-foreground">{a.delivery_status.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <AudienceCreateDialog
                open={audienceDialogOpen}
                onOpenChange={setAudienceDialogOpen}
                adAccountId={account.id}
                existingAudiences={audiences || []}
                onCreated={() => loadAudiences(account.id)}
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
        <TabsContent value="targeting">
          <TargetingBuilder />
        </TabsContent>
      </Tabs>
    </div>
  );
}
