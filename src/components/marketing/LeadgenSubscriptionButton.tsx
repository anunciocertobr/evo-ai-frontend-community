import { useCallback, useEffect, useState } from 'react';
import { Button } from '@evoapi/design-system';
import { Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  metaCreationService,
  type LeadgenSubscription,
} from '@/services/marketing/metaCreationService';

interface LeadgenSubscriptionButtonProps {
  pageId: string;
  pageName?: string;
}

export function LeadgenSubscriptionButton({ pageId, pageName }: LeadgenSubscriptionButtonProps) {
  const [status, setStatus] = useState<LeadgenSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const result = await metaCreationService.getLeadgenSubscription(pageId);
      setStatus(result || { success: false, subscribed: false });
    } catch {
      setStatus({
        success: false,
        subscribed: false,
        error: 'Não foi possível verificar a assinatura de Lead Ads.',
      });
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const subscribe = async () => {
    setSubscribing(true);
    try {
      const result = await metaCreationService.subscribeLeadgen(pageId);
      setStatus(result || { success: false, subscribed: false });
      if (result?.subscribed) {
        toast.success(`Lead Ads assinado${pageName ? ` para ${pageName}` : ''}.`);
      } else {
        toast.warning(result?.error || 'A Meta não confirmou a assinatura do Lead Ads.');
      }
    } catch {
      toast.error('Não foi possível assinar o Lead Ads desta Página.');
    } finally {
      setSubscribing(false);
    }
  };

  const subscribed = status?.subscribed === true;
  const hasError = status?.success === false || Boolean(status?.error);
  const busy = loading || subscribing;

  return (
    <Button
      variant="outline"
      onClick={subscribe}
      disabled={busy}
      className={
        subscribed
          ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
          : hasError
            ? 'border-amber-500/50 text-amber-600 dark:text-amber-400'
            : ''
      }
      title={
        subscribed
          ? 'Webhook de Lead Ads assinado. Clique para verificar novamente.'
          : status?.error || 'Assinar o webhook de Lead Ads desta Página no CRM.'
      }
    >
      {busy ? (
        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
      ) : subscribed ? (
        <ShieldCheck className="w-4 h-4 mr-1.5" />
      ) : (
        <ShieldAlert className="w-4 h-4 mr-1.5" />
      )}
      {busy ? 'Lead Ads...' : subscribed ? 'Lead Ads assinado' : 'Assinar Lead Ads'}
    </Button>
  );
}
