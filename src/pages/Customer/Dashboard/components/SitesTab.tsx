import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@evoapi/design-system';
import { Plus, Globe } from 'lucide-react';
import { sitesService, type Site } from '@/services/sites/sitesService';
import { SiteCard } from './SiteCard';
import { SiteCreateDialog } from './SiteCreateDialog';
import { SiteWebhookDialog } from './SiteWebhookDialog';
import { SiteLeadsDialog } from './SiteLeadsDialog';

// Aba "Sites" do Dashboard — grid de cards, um por site cadastrado por URL
// (ver SiteCard). Independente de loading/error/data da aba "Visão Geral"
// (carrega os próprios dados).
export function SitesTab() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [webhookSite, setWebhookSite] = useState<Site | null>(null);
  const [leadsSite, setLeadsSite] = useState<Site | null>(null);

  const loadSites = useCallback(() => {
    setLoading(true);
    sitesService
      .list()
      .then(setSites)
      .catch(() => toast.error('Erro ao carregar os sites.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const handleDelete = async (site: Site) => {
    if (!window.confirm(`Excluir o site "${site.name || site.url}"? Os leads já recebidos continuam salvos, só sem vínculo com um site.`)) return;

    try {
      await sitesService.destroy(site.id);
      toast.success('Site excluído.');
      loadSites();
    } catch {
      toast.error('Erro ao excluir o site.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Cadastre um site por URL e configure um webhook pra receber leads de formulário e eventos de
          e-commerce enviados pelo Google Tag Manager do cliente.
        </p>
        <Button onClick={() => { setEditingSite(null); setCreateOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Novo site
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
      ) : sites.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-10 border border-dashed rounded-md flex flex-col items-center gap-2">
          <Globe className="w-8 h-8 text-muted-foreground/50" />
          Nenhum site cadastrado ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sites.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              onViewLeads={setLeadsSite}
              onConfigureWebhook={setWebhookSite}
              onEdit={(s) => { setEditingSite(s); setCreateOpen(true); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <SiteCreateDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={loadSites} site={editingSite} />
      <SiteWebhookDialog open={Boolean(webhookSite)} onOpenChange={(o) => !o && setWebhookSite(null)} site={webhookSite} />
      <SiteLeadsDialog open={Boolean(leadsSite)} onOpenChange={(o) => !o && setLeadsSite(null)} site={leadsSite} />
    </div>
  );
}
