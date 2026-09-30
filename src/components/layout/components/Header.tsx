import React, { useEffect, useMemo, useState } from 'react';
import { useUnansweredConversationsStore } from '@/store/unansweredConversationsStore';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import {
  Button,
  Sheet,
  SheetContent,
  SheetTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  ScrollArea,
} from '@evoapi/design-system';
import { useLanguage } from '../../../hooks/useLanguage';
import NotificationBell from '../NotificationBell';
import ProfileMenu from './ProfileMenu';
import { TourFab } from '@/components/TourFab';
import { AiAssistantButton } from '@/components/layout/AiAssistantButton';
import MenuItem from './MenuItem';
import { MenuItem as MenuItemType } from '../config/menuItems';
import { ThemeToggle } from '../../ThemeToggle';
import { AppLogo } from '../../AppLogo';
import { PluginSlot } from '@/plugin-host';

// Utility function for className merging
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

interface User {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar_url?: string;
}

interface HeaderProps {
  user: User;
  isCollapsed: boolean;
  isMobileMenuOpen: boolean;
  menuItems: MenuItemType[];
  activeMenu: string | null;
  pathname: string;
  toggleSidebar: () => void;
  setIsMobileMenuOpen: (open: boolean) => void;
  setLogoutDialogOpen: (open: boolean) => void;
  isMenuItemActive: (href: string) => boolean;
  isMenuWithSubItemsActive: (item: MenuItemType) => boolean;
  handleMenuClick: (item: MenuItemType, e: React.MouseEvent) => void;
}

export default function Header({
  user,
  isCollapsed,
  isMobileMenuOpen,
  menuItems,
  activeMenu,
  pathname,
  toggleSidebar,
  setIsMobileMenuOpen,
  setLogoutDialogOpen,
  isMenuWithSubItemsActive,
  handleMenuClick,
}: HeaderProps) {
  const { t } = useLanguage('layout');
  // Item pai (com subItems) que a pessoa abriu no celular — troca a tela
  // inteira do menu pelos subitens dele (com um "voltar"), em vez de
  // expandir inline dentro da mesma lista (pedido explícito: nada de
  // acordeão empurrando o resto da lista pra baixo).
  const [mobileSubmenuView, setMobileSubmenuView] = useState<MenuItemType | null>(null);
  const totalUnanswered = useUnansweredConversationsStore((state) => state.totalUnanswered);

  // Volta pra lista principal sempre que o menu fecha (X, link, ou clique
  // fora), pra não abrir de novo já dentro de um submenu na próxima vez.
  useEffect(() => {
    if (!isMobileMenuOpen) setMobileSubmenuView(null);
  }, [isMobileMenuOpen]);

  const enrichedMenuItems = useMemo(
    () =>
      menuItems.map((item) =>
        item.href === '/conversations' && totalUnanswered > 0
          ? { ...item, badge: totalUnanswered, badgeHref: '/conversations?segment=unanswered' }
          : item,
      ),
    [menuItems, totalUnanswered],
  );

  return (
    <div className="flex-shrink-0 bg-sidebar border-b border-sidebar-border px-0 py-3 flex items-center shadow-sm">
      {/* Mobile Layout */}
      <div className="md:hidden flex items-center w-full px-4">
        {/* Left: Menu Button */}
        <div className="flex-1 flex justify-start">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground cursor-pointer">
                <Menu className="h-5 w-5" />
                <span className="sr-only">{t('sidebar.openMenu')}</span>
              </Button>
            </SheetTrigger>

            {/* w-full + sm:max-w-full: o SheetContent do design system já vem
                com "sm:max-w-sm" embutido (384px) — sem cancelar isso aqui,
                um celular grande/tablet entre 640 e 767px (ainda dentro do
                md:hidden) ficaria com o menu num painel estreito em vez de
                tela cheia, que é o pedido. */}
            {/* Sem SheetHeader/título e sem os blocos grandes de tema e perfil
                (ficavam ocupando boa parte da tela cheia no celular — o
                perfil/tema já têm ícone compacto na barra do topo, só fica
                inacessível ENQUANTO o menu está aberto, o que é aceitável:
                fecha o menu, usa o ícone). pt-14 no lugar do header: dá
                espaço pro X de fechar (top-4 right-4, embutido no
                SheetContent) não ficar em cima do primeiro item do menu. */}
            <SheetContent side="left" className="w-full sm:max-w-full h-full p-0 !bg-sidebar text-sidebar-foreground">
              {mobileSubmenuView ? (
                // Tela do submenu: substitui a lista principal inteira (não
                // expande inline) — "voltar" leva de volta pra lista.
                <ScrollArea className="flex-1 min-h-0 overflow-hidden p-4 pt-14">
                  <button
                    type="button"
                    onClick={() => setMobileSubmenuView(null)}
                    className="flex items-center gap-2 mb-3 px-1 py-1 text-sidebar-foreground font-medium cursor-pointer"
                  >
                    <ChevronLeft className="h-5 w-5" />
                    <mobileSubmenuView.icon className="h-5 w-5" />
                    <span>{mobileSubmenuView.name}</span>
                  </button>
                  <nav className="space-y-1">
                    {mobileSubmenuView.subItems!.map(subItem => {
                      const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + '/');
                      return (
                        <Link
                          key={subItem.href}
                          to={subItem.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm',
                            isSubActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                          )}
                        >
                          <subItem.icon className={cn('flex-shrink-0 h-4 w-4', isSubActive && 'text-primary-foreground')} />
                          <span className="font-medium">{subItem.name}</span>
                        </Link>
                      );
                    })}
                  </nav>
                </ScrollArea>
              ) : (
                <ScrollArea className="flex-1 min-h-0 overflow-hidden p-4 pt-14">
                  <nav className="space-y-1">
                    {enrichedMenuItems.map(item => {
                      const hasSubItems = item.subItems && item.subItems.length > 0;
                      const menuKey = item.id || item.href;

                      if (!hasSubItems) {
                        return (
                          <MenuItem
                            key={menuKey}
                            item={item}
                            mobile
                            isActive={isMenuWithSubItemsActive(item)}
                            activeMenu={activeMenu}
                            onClick={e => handleMenuClick(item, e)}
                          />
                        );
                      }

                      const isParentActive = item.subItems!.some(
                        sub => pathname === sub.href || pathname.startsWith(sub.href + '/')
                      );

                      return (
                        <button
                          key={menuKey}
                          type="button"
                          onClick={() => setMobileSubmenuView(item)}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-md transition-all w-full text-left cursor-pointer',
                            isParentActive
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                          )}
                        >
                          <item.icon className={cn('flex-shrink-0 h-5 w-5', isParentActive && 'text-primary')} />
                          <span className="font-medium flex-1">{item.name}</span>
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      );
                    })}
                    <PluginSlot id="sidebar.afterMain" />
                  </nav>
                </ScrollArea>
              )}
            </SheetContent>
          </Sheet>
        </div>

        {/* Center: Logo */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-2">
            <AppLogo className="h-10 max-w-44 object-contain" />
          </div>
        </div>

        {/* Right: Theme, Notifications and User Menu — ThemeToggle aqui é só o
            ícone compacto (o pedido foi tirar a barra grande de dentro do
            menu e deixar "só o ícone no topo"). */}
        <div className="flex-1 flex justify-end items-center gap-2">
          <PluginSlot id="header.right" />
          <TourFab />
          <AiAssistantButton />
          <ThemeToggle />
          <NotificationBell />
          <ProfileMenu
            user={user}
            setLogoutDialogOpen={setLogoutDialogOpen}
          />
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex items-center w-full">
        {/* Left side - aligned with sidebar */}
        <div
          className={cn(
            'flex items-center justify-between transition-all duration-300 ease-in-out px-4 relative',
            isCollapsed ? 'w-16' : 'w-56',
          )}
        >
          {/* App Logo - only show when not collapsed */}
          {!isCollapsed && (
            <div className="flex-shrink-0 flex items-center gap-2">
              <AppLogo className="h-10 max-w-44 object-contain" />
            </div>
          )}

          {/* Desktop sidebar toggle - always at the right edge of sidebar area */}
          <div className={cn('flex items-center', isCollapsed ? 'w-full justify-center' : 'ml-auto')}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  className="h-8 w-8 text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent flex-shrink-0 cursor-pointer"
                >
                  {isCollapsed ? (
                    <PanelRightClose className="h-4 w-4" />
                  ) : (
                    <PanelRightOpen className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side */}
        <div className="flex items-center gap-2 px-4">
          <PluginSlot id="header.left" />
          <PluginSlot id="header.right" />
          <TourFab />
          <AiAssistantButton />
          {/* Theme Toggle */}
          <ThemeToggle />
          {/* Notifications */}
          <NotificationBell />
          {/* User Menu */}
          <ProfileMenu
            user={user}
            setLogoutDialogOpen={setLogoutDialogOpen}
          />
        </div>
      </div>
    </div>
  );
}
