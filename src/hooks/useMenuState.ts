import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { MenuItem } from '@/components/layout/config/menuItems';
import { useBackablePanel } from './useBackablePanel';

interface MenuState {
  activeSubmenu: MenuItem | null;
  activeMenu: string | null;
}

interface UseMenuStateReturn extends MenuState {
  setActiveSubmenu: (item: MenuItem | null) => void;
  setActiveMenu: (name: string | null) => void;
  isMenuItemActive: (href: string) => boolean;
  isMenuWithSubItemsActive: (item: MenuItem) => boolean;
  handleMenuClick: (item: MenuItem, e: React.MouseEvent) => void;
  resetManualFlag: () => void;
}

export function useMenuState(
  menuItems: MenuItem[],
  setIsMobileMenuOpen?: (open: boolean) => void
): UseMenuStateReturn {
  const { pathname } = useLocation();

  const [state, setState] = useState<MenuState>({
    activeSubmenu: null,
    activeMenu: null,
  });

  // Use ref to track manual submenu state without causing re-renders
  const isManualSubmenuOpenRef = useRef(false);
  const lastPathnameRef = useRef(pathname);
  // Nome do item clicado por último (handleMenuClick) — usado só pra
  // diferenciar "cheguei aqui CLICANDO no menu" de "cheguei aqui de outro
  // jeito" (deep-link, refresh, Link de dentro da página) no useEffect
  // abaixo. Sem isso, clicar num item cujo próprio href é a rota exata
  // (ex. "Dashboard", que tem subitens reais e href: '/dashboard') nunca
  // abria o submenu no clique vindo de outra página — só um segundo clique,
  // já em /dashboard, "destravava" (bug real reportado pelo usuário).
  const lastClickedItemNameRef = useRef<string | null>(null);

  // Check if a menu item is active based on current route
  const isMenuItemActive = useCallback((href: string): boolean => {
    if (href === '/') {
      return pathname === '/';
    }

    if (href === '#') {
      return false;
    }

    // Exact match
    if (pathname === href) {
      return true;
    }

    // For regular routes - only match if pathname starts with href followed by '/'
    // This prevents /agents from matching when we're on /agents/knowledge
    return pathname.startsWith(href + '/');
  }, [pathname]);

  // Check if a menu with subitems should be active
  const isMenuWithSubItemsActive = useCallback((item: MenuItem): boolean => {
    // If item has subitems, never highlight the parent - only highlight subitems
    if (item.subItems && item.subItems.length > 0) {
      return false; // Never highlight parent when it has subitems
    }

    // For items without subitems, use the normal matching logic
    if (item.href !== '#') {
      return isMenuItemActive(item.href);
    }

    return false;
  }, [isMenuItemActive]);

  // Auto-detect active menu based on current route
  useEffect(() => {
    // Check manual flag FIRST - if manually closed, don't auto-open even if pathname matches
    if (isManualSubmenuOpenRef.current) {
      // Only reset manual flag if pathname changed AND we're navigating away from submenu routes
      if (lastPathnameRef.current !== pathname) {
        const isOnSubmenuRoute = menuItems.some(item => 
          item.subItems?.some(subItem => 
            pathname === subItem.href || pathname.startsWith(subItem.href + '/')
          )
        );
        // Reset flag only if navigating away from submenu routes
        if (!isOnSubmenuRoute) {
          isManualSubmenuOpenRef.current = false;
        }
      } else {
        // Pathname didn't change and manual flag is set - respect manual close
        return;
      }
    }
    
    // Only run when pathname actually changes
    if (lastPathnameRef.current === pathname) {
      return;
    }
    lastPathnameRef.current = pathname;

    // Calculate the complete new state before applying changes
    let newActiveSubmenu: MenuItem | null = null;
    let newActiveMenu: string | null = null;

    // If pathname contains an /edit segment (e.g. /agents/:id/edit), always close submenu.
    // Regex com segmento exato: /editor/menu e /editor/content/:id NÃO são rotas de edição.
    const isEditRoute = /\/edit(?:\/|$)/.test(pathname);

    // First pass: Check for subitem matches (highest priority)
    for (const item of menuItems) {
      if (item.subItems && item.subItems.length > 0) {
        const matchingSubItem = item.subItems.find(
          subItem => isMenuItemActive(subItem.href)
        );

        if (matchingSubItem) {
          newActiveSubmenu = isEditRoute ? null : item; // Close submenu if edit route
          newActiveMenu = item.name;
          break; // Found a subitem match, this takes priority
        }
      }
    }

    // Second pass: If no subitem match, check for main item matches
    if (!newActiveSubmenu && !newActiveMenu) {
      for (const item of menuItems) {
        if (!item.subItems || item.subItems.length === 0) {
          // Item without subitems - check if pathname matches
          if (isMenuItemActive(item.href)) {
            newActiveMenu = item.name;
            newActiveSubmenu = null;
            break;
          }
          continue;
        }

        // For items with subitems, check more carefully
        const isExactMatch = pathname === item.href;
        const pathnameStartsWithItemHref = item.href !== '#' && item.href !== '/' && pathname.startsWith(item.href + '/');

        // Check if this is a subitem route (like /agents/knowledge, /agents/custom-tools)
        const isSubitemRoute = item.subItems.some(subItem => {
          // Exact match or pathname starts with subitem href
          return pathname === subItem.href || pathname.startsWith(subItem.href + '/');
        });

        if (isExactMatch) {
          // Exactly on the main route (e.g., /agents)
          newActiveMenu = item.name;
          // Normalmente não abre o submenu só por estar na rota principal
          // (ex. "Marketing" — a própria página já mostra tudo). Exceção: o
          // usuário acabou de CLICAR nesse item específico pra chegar aqui
          // (não um refresh/deep-link) — nesse caso ele quer ver o submenu,
          // não só a página (bug real: "Dashboard" tem subitens de verdade,
          // href é uma rota exata, e clicar nele vindo de outra página
          // nunca abria o flyout no primeiro clique).
          newActiveSubmenu = lastClickedItemNameRef.current === item.name ? item : null;
          break;
        } else if (pathnameStartsWithItemHref) {
          // Route starts with item href (e.g., /agents/:id/edit, /agents/knowledge)
          newActiveMenu = item.name;
          // If it's an edit route, always close submenu
          if (isEditRoute) {
            newActiveSubmenu = null;
          } else if (isSubitemRoute) {
            // It's a subitem route, open submenu
            newActiveSubmenu = item;
          } else {
            // It's NOT a subitem route, close submenu
            newActiveSubmenu = null;
          }
          break;
        }
      }
    }

    // Third pass: If still no match and we're on root, clear everything
    if (!newActiveMenu && pathname === '/') {
      newActiveSubmenu = null;
      newActiveMenu = null;
    }

    // Consumido — não deixar "grudado" abrindo o submenu de novo em
    // navegações futuras incidentais pra essa mesma rota (ex. clicar num
    // Link interno que leva de volta pra /dashboard sem ser pelo menu).
    lastClickedItemNameRef.current = null;

    // Apply the complete new state in one atomic update
    setState(prev => {
      // If manual flag is set and we're trying to auto-open a submenu, respect manual close
      if (isManualSubmenuOpenRef.current && newActiveSubmenu !== null && prev.activeSubmenu === null) {
        return prev; // Don't auto-open if manually closed
      }
      
      // Only update if there's actually a change to avoid unnecessary re-renders
      if (prev.activeSubmenu?.name === newActiveSubmenu?.name &&
          prev.activeMenu === newActiveMenu) {
        return prev;
      }

      return {
        activeSubmenu: newActiveSubmenu,
        activeMenu: newActiveMenu,
      };
    });
  }, [pathname, menuItems, isMenuItemActive]);

  // Handle menu click
  const handleMenuClick = useCallback((item: MenuItem, e: React.MouseEvent) => {

    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isMobile = window.innerWidth < 768;

    if (hasSubItems) {
      // If href is '#', just toggle submenu without navigation
      if (item.href === '#') {
        e.preventDefault();

        // Calculate new state atomically
        setState(prev => {
          const isCurrentlyActive = prev.activeSubmenu?.name === item.name;
          const willBeActive = !isCurrentlyActive;

          // Update manual flag
          isManualSubmenuOpenRef.current = willBeActive;

          return {
            activeSubmenu: willBeActive ? item : null,
            activeMenu: willBeActive ? item.name : null,
          };
        });
      } else {
        // If href is not '#', navigate to the page (submenu will open automatically if route matches)
        // Marca que foi ESTE item que o usuário clicou — o useEffect de
        // auto-detect usa isso pra abrir o submenu mesmo quando o pathname
        // bate exatamente com item.href (ver comentário lá).
        lastClickedItemNameRef.current = item.name;
        // Always close any open submenu when navigating to a different menu item
        setState(prev => {
          // If navigating to a different menu item, close the current submenu
          if (prev.activeSubmenu && prev.activeSubmenu.name !== item.name) {
            return {
              activeSubmenu: null,
              activeMenu: item.name,
            };
          }
          // Otherwise, keep current state but update activeMenu
          return {
            activeSubmenu: prev.activeSubmenu,
            activeMenu: item.name,
          };
        });

        // Reset manual flag so auto-detection can work after navigation
        isManualSubmenuOpenRef.current = false;

        // Close mobile menu if needed
        if (isMobile && setIsMobileMenuOpen) {
          setIsMobileMenuOpen(false);
        }
        // Let the Link component handle navigation naturally
      }
    } else {
      // For items without subitems - atomic update
      setState({
        activeMenu: item.name,
        activeSubmenu: null,
      });

      // Reset manual flag
      isManualSubmenuOpenRef.current = false;

      if (isMobile && setIsMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    }
  }, [setIsMobileMenuOpen]);

  // Helper functions
  const setActiveSubmenu = useCallback((item: MenuItem | null) => {
    // If manually closing (setting to null), mark as manual to prevent auto-reopening
    if (item === null) {
      isManualSubmenuOpenRef.current = true;
    }
    setState(prev => ({ ...prev, activeSubmenu: item }));
  }, []);

  const setActiveMenu = useCallback((name: string | null) => {
    setState(prev => ({ ...prev, activeMenu: name }));
  }, []);

  const resetManualFlag = useCallback(() => {
    isManualSubmenuOpenRef.current = false;
  }, []);

  // Botão físico "voltar" do Android (PWA standalone) fecha o submenu em vez
  // de minimizar o app — ver useBackablePanel.ts.
  useBackablePanel(state.activeSubmenu !== null, () => setActiveSubmenu(null));

  return {
    ...state,
    setActiveSubmenu,
    setActiveMenu,
    isMenuItemActive,
    isMenuWithSubItemsActive,
    handleMenuClick,
    resetManualFlag,
  };
}
