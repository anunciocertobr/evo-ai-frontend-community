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
import { Plus, FileText, Users, Building2, Crosshair } from 'lucide-react';
import { BaseHeader } from '@/components/base';
import { MetaAdAccountPicker } from '@/components/marketing/MetaAdAccountPicker';
import { LeadFormCreateDialog } from '@/components/marketing/LeadFormCreateDialog';
import { AudienceCreateDialog } from '@/components/marketing/AudienceCreateDialog';
import { AudienceContactsPickerDialog } from '@/components/marketing/AudienceContactsPickerDialog';
import { TargetingBuilder } from '@/components/marketing/TargetingBuilder';
import { metaCreationService, type LeadForm, type CustomAudience } from '@/services/marketing/metaCreationService';

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

export default function MetaCreationPage() {
  // Formulários
  const [forms, setForms] = useState<LeadForm[] | null>(null);
  const [loadingForms, setLoadingForms] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);

  // Públicos
  const [account, setAccount] = useState<{ id: string; name: string } | null>(null);
  const [audiences, setAudiences] = useState<CustomAudience[] | null>(null);
  const [loadingAudiences, setLoadingAudiences] = useState(false);
  const [audienceDialogOpen, setAudienceDialogOpen] = useState(false);
  const [pendingCustomerList, setPendingCustomerList] = useState<CustomAudience | null>(null);

  const loadForms = useCallback(() => {
    setLoadingForms(true);
    metaCreationService
      .listLeadForms()
      .then(setForms)
      .catch(() => toast.error('Erro ao carregar formulários'))
      .finally(() => setLoadingForms(false));
  }, []);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

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
          <div className="flex justify-end">
            <Button onClick={() => setFormDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Novo formulário
            </Button>
          </div>

          {loadingForms ? (
            <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
          ) : !forms || forms.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10 border border-dashed rounded-md">
              Nenhum formulário cadastrado ainda.
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
                </div>
              ))}
            </div>
          )}

          <LeadFormCreateDialog open={formDialogOpen} onOpenChange={setFormDialogOpen} onCreated={loadForms} />
        </TabsContent>

        {/* --- Públicos --- */}
        <TabsContent value="audiences" className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <MetaAdAccountPicker onSelect={setAccount} />
            {account && (
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> {account.name}
              </span>
            )}
            {account && (
              <Button onClick={() => setAudienceDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> Novo público
              </Button>
            )}
          </div>

          {!account ? (
            <div className="text-center text-sm text-muted-foreground py-10 border border-dashed rounded-md">
              Selecione uma conta de anúncio pra ver e criar públicos.
            </div>
          ) : loadingAudiences ? (
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

          {account && (
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
          )}

          <AudienceContactsPickerDialog
            audienceId={pendingCustomerList?.id ?? null}
            audienceName={pendingCustomerList?.name ?? ''}
            onOpenChange={(open) => !open && setPendingCustomerList(null)}
            onDone={() => setPendingCustomerList(null)}
          />
        </TabsContent>

        {/* --- Direcionamento Detalhado --- */}
        <TabsContent value="targeting">
          <TargetingBuilder />
        </TabsContent>
      </Tabs>
    </div>
  );
}
