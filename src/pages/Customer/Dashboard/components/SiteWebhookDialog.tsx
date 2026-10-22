import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
} from '@evoapi/design-system';
import { Copy, RefreshCw } from 'lucide-react';
import { sitesService, type Site, type SiteWebhookInfo } from '@/services/sites/sitesService';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: Site | null;
}

const GTM_SNIPPET = `fetch('SEU_WEBHOOK_URL', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'generate_lead', // ou 'purchase' pra e-commerce
    name: '{{Nome}}',
    email: '{{Email}}',
    phone: '{{Telefone}}',
    utm_source: '{{utm_source}}',
    ecommerce: { value: '{{value}}', currency: 'BRL', items: [{ item_id: '{{item_id}}' }] }
  })
});`;

// Mostra a URL do webhook (token único por site) + instrução de como criar
// uma tag "HTML Personalizado" no GTM que dispara essa chamada — texto de
// ajuda, não gerador de código: o usuário monta a tag com as variáveis do
// próprio dataLayer dele.
export function SiteWebhookDialog({ open, onOpenChange, site }: Props) {
  const [info, setInfo] = useState<SiteWebhookInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!open || !site) return;
    setLoading(true);
    sitesService
      .getWebhookInfo(site.id)
      .then(setInfo)
      .catch(() => toast.error('Erro ao carregar o webhook deste site.'))
      .finally(() => setLoading(false));
  }, [open, site]);

  const handleCopy = () => {
    if (!info) return;
    navigator.clipboard.writeText(info.webhook_url);
    toast.success('URL copiada!');
  };

  const handleRegenerate = async () => {
    if (!site) return;
    if (!window.confirm('Isso invalida a URL atual — qualquer tag do GTM configurada com ela para de funcionar. Continuar?')) return;

    setRegenerating(true);
    try {
      const updated = await sitesService.regenerateWebhookToken(site.id);
      setInfo(updated);
      toast.success('Token regenerado! Atualize a tag no GTM com a nova URL.');
    } catch {
      toast.error('Erro ao regenerar o token.');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Webhook — {site?.name || site?.url}</DialogTitle>
          <DialogDescription>
            Cole essa URL numa tag "HTML Personalizado" no Google Tag Manager do site, disparada quando
            alguém envia um formulário ou finaliza uma compra.
          </DialogDescription>
        </DialogHeader>

        {loading || !info ? (
          <div className="text-center text-sm text-muted-foreground py-6">Carregando...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-xs">URL do webhook</Label>
              <div className="flex gap-2">
                <Input value={info.webhook_url} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Como configurar no GTM</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Crie uma tag do tipo "HTML Personalizado" com um gatilho de envio de formulário ou
                compra, e dentro dela um <code className="text-[11px]">fetch</code> igual este (troque
                as variáveis pelas do seu dataLayer):
              </p>
              <pre className="text-[11px] bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                {GTM_SNIPPET.replace('SEU_WEBHOOK_URL', info.webhook_url)}
              </pre>
            </div>

            <p className="text-xs text-muted-foreground">{info.leads_count} eventos recebidos até agora.</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleRegenerate} disabled={loading || regenerating} className="sm:mr-auto">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> {regenerating ? 'Regenerando...' : 'Regenerar token'}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
