import { useEffect, useRef } from 'react';

// PWA standalone (manifest.json "display": "standalone" — sem barra do
// Chrome): o botão/gesto físico "voltar" do Android dispara `popstate` no
// WebView. Painéis como o menu mobile e os submenus (Sidebar/useMenuState)
// são só `useState` local, sem mexer na URL — então não empurram nada no
// `window.history`, e o Android, sem história própria do app pra consumir,
// entende que deve fechar/minimizar o app em vez de voltar um nível dentro
// dele. Esse hook empurra uma entrada de history enquanto o painel está
// aberto, e um `popstate` (botão voltar) fecha o painel em vez de deixar o
// evento "vazar" pro sistema.
//
// Vários painéis abertos ao mesmo tempo (ex.: menu mobile + submenu dentro
// dele) funcionam em camadas sem nenhuma pilha manual: cada abertura empurra
// sua própria entrada, e o histórico do próprio browser já é LIFO — o
// primeiro "voltar" consome a entrada mais recente (fecha o painel mais
// interno primeiro), exatamente o comportamento esperado.
export function useBackablePanel(isOpen: boolean, onClose: () => void) {
  const pushedRef = useRef(false);
  const ignoreNextPopRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isOpen && !pushedRef.current) {
      window.history.pushState({ backablePanel: true }, '');
      pushedRef.current = true;
    } else if (!isOpen && pushedRef.current) {
      pushedRef.current = false;
      // Só é seguro "consumir" a entrada fantasma com history.back() se ela
      // ainda for o topo da pilha. Bug real reproduzido repetidas vezes
      // (navegador e celular): fechar o painel por causa de uma navegação
      // de verdade (ex. clicar num item do submenu que chama navigate())
      // empurra a página de destino ANTES deste efeito rodar — o topo da
      // pilha já não é mais a entrada fantasma, é a navegação real. Chamar
      // history.back() incondicionalmente descartava essa navegação real
      // (voltava pra página de trás, ex. Conversas) em vez da fantasma.
      // Se outra coisa já empurrou por cima, deixa a fantasma órfã no
      // histórico (só custa um "voltar" a mais depois) em vez de cancelar
      // a navegação.
      if (window.history.state?.backablePanel) {
        ignoreNextPopRef.current = true;
        window.history.back();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handlePopState = () => {
      if (ignoreNextPopRef.current) {
        ignoreNextPopRef.current = false;
        return;
      }
      if (pushedRef.current) {
        pushedRef.current = false;
        onCloseRef.current();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
}
