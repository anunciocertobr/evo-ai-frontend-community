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

type FbStatusResponse = {
  status?: string;
  authResponse?: { accessToken?: string; userID?: string };
  error?: { message?: string };
};

type Step = 'loading' | 'ready' | 'processing' | 'success' | 'error';

/**
 * Popup de "Conceder Acessos" do Setup Marketing — rota PÚBLICA do SPA
 * (sem sessão, funciona em aba anônima): o cliente autoriza o próprio
 * Facebook por aqui.
 *
 * Duas origens:
 *  - grant na query (link copiável gerado pelo dashboard): o token vai
 *    direto pro endpoint público /public/api/v1/meta_client/grants;
 *  - sem grant (popup aberto pelo dashboard/logou): devolve o token pro
 *    opener via postMessage.
 *
 * IMPORTANTE: FB.login roda SOMENTE no clique do botão "Autorizar com
 * Facebook". Popup do Facebook que não nasce de um gesto do usuário é
 * bloqueado pelo navegador e o callback nunca chega — era isso que deixava
 * a tela presa em "Autorizando...". Depois de init, também checamos
 * getLoginStatus: se já houver sessão ativa no navegador, usamos o token
 * direto, sem abrir diálogo.
 */
export default function MetaClientLogin() {
  const [searchParams] = useSearchParams();
  const appId = searchParams.get('app_id');
  const scope = searchParams.get('scope');
  const grant = searchParams.get('grant');
  const isGrantMode = Boolean(grant);

  const startedRef = useRef(false);
  const ranLoginRef = useRef(false);
  const sdkReadyRef = useRef(false);
  const knownStatusRef = useRef<FbStatusResponse | null>(null);
  const [step, setStep] = useState<Step>('loading');
  const [message, setMessage] = useState('Preparando a autorização...');

  const notifyOpener = (payload: Record<string, unknown>) => {
    try {
      window.opener?.postMessage({ type: 'evo-meta-client-access', ...payload }, '*');
    } catch {
      // opener ausente ou bloqueado — o dashboard cobre com polling
    }
  };

  const grantModeReport = async (fbUserId: string, token: string) => {
    try {
      const base = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${base}/public/api/v1/meta_client/grants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant, fb_user_id: fbUserId, token }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setStep('success');
        setMessage('Acesso concedido com sucesso! Pode fechar esta janela.');
        setTimeout(() => window.close(), 2500);
      } else {
        setStep('error');
        setMessage(data?.error || 'Falha ao registrar o acesso. Tente novamente.');
      }
    } catch {
      setStep('error');
      setMessage('Falha ao comunicar com o servidor. Verifique sua conexão e tente de novo.');
    }
  };

  const afterLogin = (fbUserId: string, token: string) => {
    if (isGrantMode) {
      void grantModeReport(fbUserId, token);
      return;
    }
    setStep('success');
    setMessage('Login OK! Esta janela vai fechar sozinha — confira no dashboard.');
    notifyOpener({ status: 'ok', fb_user_id: fbUserId, token });
    setTimeout(() => window.close(), 2000);
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

  const initSdk = async () => {
    if (sdkReadyRef.current) return;
    await loadSdk();
    window.FB.init({ appId, version: 'v21.0', xfbml: true });
    sdkReadyRef.current = true;
  };

  const runLogin = async () => {
    if (ranLoginRef.current || !sdkReadyRef.current) return;
    ranLoginRef.current = true;
    setStep('processing');
    setMessage('Autorizando com o Facebook...');

    // Warn if the dialog doesn't appear quickly (usually a blocked popup).
    const pendente = window.setTimeout(() => {
      setMessage(
        'Aguardando o login do Facebook... Se nenhuma janela abriu, libere popups para este site e clique de novo em "Autorizar com Facebook".',
      );
    }, 15_000);

    const resetPendente = () => window.clearTimeout(pendente);

    const onStatus = (response: FbStatusResponse) => {
      resetPendente();
      if (response.status === 'connected') {
        const token = response.authResponse?.accessToken;
        const fbUserId = String(response.authResponse?.userID ?? '');
        if (!token) {
          setStep('error');
          setMessage('O Facebook não devolveu o token do acesso. Tente novamente.');
          return;
        }
        afterLogin(fbUserId, token);
        return;
      }
      if (response.status === 'not_authorized') {
        setStep('error');
        setMessage('Autorização não concedida para o app — nenhuma alteração foi feita.');
      } else {
        const erro = response.error?.message || 'Login cancelado — nenhuma alteração foi feita.';
        setStep('error');
        setMessage(erro);
      }
    };

    try {
      // Já autorizado neste navegador? Reaproveita o token (sem popup).
      // Senão chama FB.login DENTRO do gesto do clique — chamar depois de um
      // retorno assíncrono faz o navegador tratar como popup não solicitado
      // e bloquear (era isso que travava a tela em "Autorizando...").
      const known = knownStatusRef.current;
      if (known?.status === 'connected' && known.authResponse?.accessToken) {
        onStatus(known);
      } else {
        window.FB.login(onStatus, { scope });
      }
    } catch {
      setStep('error');
      setMessage('Erro ao conectar com o Facebook. Tente novamente.');
    }
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!appId || !scope) {
      setStep('error');
      setMessage('Link inválido — parâmetros de login ausentes. Peça um novo link no painel do CRM.');
      return;
    }

    const boot = async () => {
      try {
        await initSdk();
        // Pré-captura passiva do status (sem popup) — se já houver sessão,
        // o clique reaproveita o token; caso contrário o FB.login roda no gesto.
        try {
          window.FB.getLoginStatus((status: FbStatusResponse) => {
            knownStatusRef.current = status;
          }, { force: false });
        } catch {
          // status desconhecido é ok — o login do clique descobre
        }
        setStep('ready');
      } catch (e) {
        setStep('error');
        setMessage(e instanceof Error ? e.message : 'Erro ao carregar o conector do Facebook.');
      }
    };

    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, scope]);

  const processing = step === 'processing' || step === 'loading';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-col items-center text-center space-y-4">
          <AppLogo />
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-600/20">
            {step === 'success' ? (
              <CheckCircle className="w-7 h-7 text-emerald-400" />
            ) : step === 'error' ? (
              <AlertTriangle className="w-7 h-7 text-red-400" />
            ) : (
              <Facebook className="w-7 h-7 text-blue-400" />
            )}
          </div>

          <div className="space-y-1">
            <h1 className="text-lg font-semibold">
              {step === 'success'
                ? 'Tudo certo!'
                : step === 'error'
                  ? 'Algo deu errado'
                  : processing
                    ? 'Conectando com o Facebook'
                    : 'Autorizar o acesso do cliente'}
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              {step === 'ready'
                ? isGrantMode
                  ? 'Ao autorizar, o acesso do cliente fica registrado e o link deixa de valer. O token é guardado em segurança.'
                  : 'O dono da Business Manager confirma quem é e o acesso fica pronto para operar no painel do CRM.'
                : message}
            </p>
          </div>

          {step === 'ready' && (
            <button
              onClick={runLogin}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm px-4 py-3 rounded-lg transition flex items-center justify-center gap-2"
            >
              <Facebook className="w-4 h-4" />
              Autorizar com Facebook
            </button>
          )}

          {step === 'error' && (
            <button
              onClick={() => {
                ranLoginRef.current = false;
                setStep('ready');
              }}
              className="w-full border border-slate-600 hover:border-slate-400 text-slate-200 text-sm px-4 py-2 rounded-lg transition"
            >
              Tentar novamente
            </button>
          )}

          {processing && <Loader2 className="w-6 h-6 animate-spin text-blue-400" />}
        </div>
      </div>
    </div>
  );
}