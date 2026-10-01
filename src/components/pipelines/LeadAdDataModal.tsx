import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Badge } from '@evoapi/design-system';
import type { PipelineItem } from '@/types/analytics';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PipelineItem | null;
}

const PLATFORM_LABEL: Record<string, string> = {
  meta: 'Meta (Facebook/Instagram)',
  google: 'Google Ads',
};

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right break-all">{value}</span>
    </div>
  );
}

export default function LeadAdDataModal({ open, onOpenChange, item }: Props) {
  const attribution = item?.ad_attribution;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Dados do Lead</DialogTitle>
          <DialogDescription>Origem, campanha e UTMs capturados no clique que trouxe este contato.</DialogDescription>
        </DialogHeader>

        {!attribution ? (
          <p className="text-sm text-muted-foreground py-4">
            Esse contato não tem um clique de anúncio rastreado — provavelmente chegou de forma orgânica ou por um
            canal sem rastreamento (ex.: mensagem direta no WhatsApp).
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <Badge>{PLATFORM_LABEL[attribution.platform] || attribution.platform}</Badge>
            </div>

            {(attribution.headline || attribution.body) && (
              <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                {attribution.headline && <p className="text-sm font-semibold">{attribution.headline}</p>}
                {attribution.body && <p className="text-xs text-muted-foreground">{attribution.body}</p>}
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Campanha</h4>
              <Row label="Campanha" value={attribution.campaign_name || attribution.campaign_id} />
              <Row label="Conjunto de anúncios" value={attribution.adset_name || attribution.adset_id} />
              <Row label="Anúncio" value={attribution.ad_name || attribution.ad_id} />
            </div>

            {(attribution.utm_source || attribution.utm_medium || attribution.utm_campaign || attribution.utm_content || attribution.utm_term) && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">UTMs</h4>
                <Row label="utm_source" value={attribution.utm_source} />
                <Row label="utm_medium" value={attribution.utm_medium} />
                <Row label="utm_campaign" value={attribution.utm_campaign} />
                <Row label="utm_content" value={attribution.utm_content} />
                <Row label="utm_term" value={attribution.utm_term} />
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Identificadores</h4>
              <Row label="ctwa_clid" value={attribution.ctwaclid} />
              <Row label="gclid" value={attribution.gclid} />
              <Row label="source_url" value={attribution.source_url} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
