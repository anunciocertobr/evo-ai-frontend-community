import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, ExternalLink, AlertTriangle, Loader2, Puzzle } from 'lucide-react';
import { Button, Textarea, Badge } from '@evoapi/design-system';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { formatDateTime } from '@/utils/time';
import { metaBillingService, type MetaBillingSession } from '@/services/marketing/metaBillingService';

// Extensão usada pra exportar os cookies de uma sessão do Facebook já
// logada no navegador — nunca pedimos email/senha, só essa sessão já
// autenticada por um humano. Ver Meta::Billing::CookieImportService no
// backend.
const COOKIE_EDITOR_URL =
  'https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm';

const STATUS_LABEL: Record<MetaBillingSession['status'], string> = {
  idle: 'Nenhuma sessão importada ainda',
  active: 'Sessão ativa',
  error: 'Sessão com erro',
};

export function PaymentsTab() {
  const [session, setSession] = useState<MetaBillingSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [cookiesJson, setCookiesJson] = useState('');
  const [importing, setImporting] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const data = await metaBillingService.getSession();
      setSession(data);
    } catch (error) {
      toast.error(apiErrorMessage(error, true) || 'Não consegui carregar o status da sessão.');
    } finally {
      setLoadingSession(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleImport = useCallback(async () => {
    if (!cookiesJson.trim()) {
      toast.error('Cole o JSON exportado do Cookie-Editor antes de importar.');
      return;
    }
    setImporting(true);
    try {
      const data = await metaBillingService.importCookies(cookiesJson.trim());
      setSession(data);
      setCookiesJson('');
      toast.success('Sessão importada com sucesso.');
    } catch (error) {
      toast.error(apiErrorMessage(error, true) || 'Não consegui importar esses cookies.');
    } finally {
      setImporting(false);
    }
  }, [cookiesJson]);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Sessão do Facebook usada pela automação de cobrança</h3>
          {loadingSession ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : session?.status === 'active' ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {STATUS_LABEL.active}
            </Badge>
          ) : session?.status === 'error' ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {STATUS_LABEL.error}
            </Badge>
          ) : (
            <Badge variant="outline">{STATUS_LABEL.idle}</Badge>
          )}
        </div>
        {session?.cookiesImportedAt && (
          <p className="text-xs text-muted-foreground">
            Importada em {formatDateTime(session.cookiesImportedAt)}
            {session.lastVerifiedAt ? ` · verificada pela última vez em ${formatDateTime(session.lastVerifiedAt)}` : ''}
          </p>
        )}
        {session?.lastError && <p className="text-xs text-destructive">{session.lastError}</p>}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Como importar (uma vez, ou sempre que a sessão expirar)</h3>
        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>Instale a extensão Cookie-Editor no seu Chrome (abre numa aba nova).</li>
          <li>
            Acesse o <strong>facebook.com</strong> já logado na conta usada pra faturamento das contas de anúncio.
          </li>
          <li>Clique no ícone da extensão → Export → Export as JSON.</li>
          <li>Cole o conteúdo exportado no campo abaixo e clique em Importar.</li>
        </ol>
        <Button variant="outline" size="sm" asChild>
          <a href={COOKIE_EDITOR_URL} target="_blank" rel="noopener noreferrer">
            <Puzzle className="w-4 h-4 mr-1.5" />
            Instalar extensão Cookie-Editor
            <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
          </a>
        </Button>

        <Textarea
          value={cookiesJson}
          onChange={(e) => setCookiesJson(e.target.value)}
          placeholder='Cole aqui o JSON exportado pelo Cookie-Editor (ex: [{"name":"c_user","value":"...","domain":".facebook.com",...}, ...])'
          rows={8}
          className="font-mono text-xs"
        />
        <Button onClick={handleImport} disabled={importing || !cookiesJson.trim()}>
          {importing && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
          Importar sessão
        </Button>
      </div>
    </div>
  );
}
