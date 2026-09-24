import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, AlertTriangle, Facebook } from 'lucide-react';
import { AppLogo } from '@/components/AppLogo';

const SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FB: any;
  }
}

/**
 * Popup de "Conceder Acessos" do Setup Marketing — aberto a partir do
 * dashboard (iframe sandbox sem cookies), roda numa rota própria do SPA
 * (domínio já autorizado no app da Meta), então o FB.login por SDK
 * funciona SEM cadastrar URL de redirect no painel da Meta.
 *
 * Fluxo: FB.login -> token curto -> postMessage pro dashboard (opener),
 * que salva via /api/v1/reports/meta_infrastructure (client_salvar_token)
 * e o backend troca por token long-lived. O dashboard também faz polling,
 * então funciona mesmo se o postMessage for bloqueado.
 */
export default function MetaClientLogin() {
  const [searchParams] = useSearchParams();
  const appId = searchParams.get('app_id');
  const scope = searchParams.get('scope');
  const grant = searchParams.get('grant');
  // grant presente = cliente abriu o link copiável SEM sessão: o token tem
  // que ir direto pro endpoint público. Sem grant = popup aberto pelo
  // dashboard: devolve pro opener (iframe) via postMessage.
  const isGrantMode = Boolean(grant);
  const startedRef = useRef(false);
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Conectando com o Facebook...');

  const notifyOpener = (payload: Record<string, unknown>) => {
    try {
      window.opener?.postMessage({ type: 'evo-meta-client-access', ...payload }, '*');
    } catch {
      // opener ausente ou bloqueado — o dashboard cobre com polling
    }
  };

  const closeAfter = (payload: Record<string, unknown>) => {
    notifyOpener(payload);
    setTimeout(() => window.close(), 2000);
  };

  const afterLogin = async (fbUserId: string, token: string) => {
    if (isGrantMode) {
      try {
        const base = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${base}/public/api/v1/meta_client/grants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grant, fb_user_id: fbUserId, token }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
          setStatus('success');
          setMessage('Acesso concedido com sucesso! Esta janela vai fechar sozinha.');
          setTimeout(() => window.close(), 2000);
        } else {
          setStatus('error');
          setMessage(data?.error || 'Falha ao registrar o acesso. Tente novamente.');
          setTimeout(() => window.close(), 3000);
        }
      } catch {
        setStatus('error');
        setMessage('Falha ao comunicar com o servidor. Verifique sua conexão e tente de novo.');
        setTimeout(() => window.close(), 3000);
      }
      return;
    }
    setStatus('success');
    setMessage('Login OK! Esta janela vai fechar sozinha — confira no dashboard.');
    closeAfter({ status: 'ok', fb_user_id: fbUserId, token });
  };

  const loadSdk = () =>
    new Promise<void>((resolve, reject) => {
      if (window.FB) {
        resolve();
        return;
      }
      const started = Date.now();
      const timer = window.setInterval(() => {
        if (window.FB) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (Date.now() - started > 15_000) {
          window.clearInterval(timer);
          reject(new Error('Tempo esgotado ao carregar o SDK do Facebook.'));
        }
      }, 100);
      const existing = document.querySelector(`script[src="${SDK_SRC}"]`);
      if (existing) return;
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.async = true;
      script.defer = true;
      script.src = SDK_SRC;
      script.onerror = () => {
        window.clearInterval(timer);
        reject(new Error('Não foi possível carregar o SDK do Facebook.'));
      };
      document.head.appendChild(script);
    });

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!appId || !scope) {
      setStatus('error');
      setMessage('Parâmetros de login ausentes — abra esta janela pelo dashboard ou pelo link enviado.');
      setTimeout(() => window.close(), 3000);
      return;
    }

    const run = async () => {
      try {
        await loadSdk();
        window.FB.init({ appId, version: 'v21.0', xfbml: true });

        // Se nada responder, deixa claro o que pode ter acontecido em vez de
        // travar em "Autorizando..." (ex.: popup de login bloqueado).
        const pendente = window.setTimeout(() => {
          setMessage(
            'Aguardando o login do Facebook... Se você não viu a tela de login, verifique se o bloqueador de popups não impediu.',
          );
        }, 12_000);
        const resetPendente = () => window.clearTimeout(pendente);

        window.FB.login(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (response: any) => {
            resetPendente();
            if (response.status === 'connected') {
              const token = response.authResponse?.accessToken;
              const fbUserId = String(response.authResponse?.userID ?? '');
              if (!token) {
                setStatus('error');
                setMessage('Facebook não devolveu o token do acesso.');
                window.setTimeout(() => window.close(), 3000);
                return;
              }
              void afterLogin(fbUserId, token);
            } else if (response.status === 'not_authorized') {
              setStatus('error');
              setMessage('Autorização não concedida para o app — nenhuma alteração foi feita.');
              closeAfter({ status: 'erro', error: 'Não autorizado' });
            } else {
              const erro = response.error?.message || 'Login cancelado — nenhuma alteração foi feita.';
              setStatus('error');
              setMessage(erro);
              closeAfter({ status: 'erro', error: response.error?.message || 'Cancelado' });
            }
          },
          { scope },
        );
      } catch (e) {
        setStatus('error');
        setMessage(e instanceof Error ? e.message : 'Erro ao conectar com o Facebook.');
        notifyOpener({ status: 'erro', error: 'SDK falhou' });
        window.setTimeout(() => window.close(), 3000);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader2 className="h-12 w-12 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-12 w-12 text-green-500" />;
      case 'error':
        return <AlertTriangle className="h-12 w-12 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'text-blue-600 dark:text-blue-400';
      case 'success':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-t from-primary/20 via-background/95 to-background relative">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <AppLogo className="h-10 mx-auto" />
        </div>

        <div className="bg-background/80 backdrop-blur-sm border rounded-lg p-6 shadow-lg">
          <div className="text-center pb-6 border-b">
            <div className="flex items-center justify-center gap-3">
              <div className="p-3 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500">
                <Facebook className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold">Facebook</h1>
            </div>
          </div>

          <div className="text-center space-y-6 py-8">
            <div className="flex flex-col items-center gap-4">
              {getStatusIcon()}
              <div className="space-y-2">
                <p className={`text-lg font-semibold ${getStatusColor()}`}>
                  {status === 'processing' && 'Autorizando...'}
                  {status === 'success' && 'Sucesso!'}
                  {status === 'error' && 'Erro'}
                </p>
                <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
              </div>
            </div>

            {status === 'processing' && (
              <div className="text-xs text-muted-foreground animate-pulse">
                Conectando com a sua conta do Facebook...
              </div>
            )}

            {status === 'error' && (
              <div className="text-xs text-muted-foreground pt-4 border-t">
                <p>Você pode fechar esta janela.</p>
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          <p>Conceder acessos — Setup Marketing</p>
        </div>
      </div>
    </div>
  );
}