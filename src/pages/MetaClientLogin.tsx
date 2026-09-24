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

  const finish = (payload: Record<string, unknown>, willClose = true) => {
    notifyOpener(payload);
    if (willClose) {
      setTimeout(() => window.close(), 2000);
    }
  };

  const loadSdk = () =>
    new Promise<void>((resolve) => {
      if (window.FB) {
        resolve();
        return;
      }
      const timer = window.setInterval(() => {
        if (window.FB) {
          window.clearInterval(timer);
          resolve();
          return;
        }
      }, 100);
      const existing = document.querySelector(`script[src="${SDK_SRC}"]`);
      if (existing) return;
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.async = true;
      script.defer = true;
      script.src = SDK_SRC;
      document.head.appendChild(script);
    });

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!appId || !scope) {
      setStatus('error');
      setMessage('Parâmetros de login ausentes — abra esta janela pelo dashboard.');
      finish({ status: 'erro', error: 'Parâmetros ausentes' }, false);
      return;
    }

    const run = async () => {
      try {
        await loadSdk();
        window.FB.init({ appId, version: 'v21.0', xfbml: true });
        window.FB.login(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (response: any) => {
            if (response.status === 'connected') {
              const token = response.authResponse?.accessToken;
              const fbUserId = String(response.authResponse?.userID ?? '');
              if (!token) {
                setStatus('error');
                setMessage('Facebook não devolveu o token do acesso.');
                finish({ status: 'erro', error: 'Sem token' });
                return;
              }
              setStatus('success');
              setMessage('Login OK! Esta janela vai fechar sozinha — confira no dashboard.');
              finish({ status: 'ok', fb_user_id: fbUserId, token });
            } else if (response.status === 'not_authorized') {
              setStatus('error');
              setMessage('Autorização não concedida para o app — nenhuma alteração foi feita.');
              finish({ status: 'erro', error: 'Não autorizado' });
            } else {
              const erro = response.error?.message || 'Login cancelado — nenhuma alteração foi feita.';
              setStatus('error');
              setMessage(erro);
              finish({ status: 'erro', error: response.error?.message || 'Cancelado' });
            }
          },
          { scope },
        );
      } catch {
        setStatus('error');
        setMessage('Erro ao conectar com o Facebook.');
        finish({ status: 'erro', error: 'SDK falhou' }, false);
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