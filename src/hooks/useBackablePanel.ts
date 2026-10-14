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
      // Painel fechou por outro motivo (clique num item, clique fora, etc) —
      // "consome" a entrada que empurramos sem deixar o usuário perceber,
      // senão ela fica órfã no histórico e o próximo "voltar" não faz nada
      // visível (ou volta pra uma URL/estado inesperado).
      pushedRef.current = false;
      ignoreNextPopRef.current = true;
      window.history.back();
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
