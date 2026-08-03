import { ReactNode, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@evoapi/design-system';
import { Bot, ShieldOff } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { usePermissions } from '@/contexts/PermissionsContext';
import EmptyState from '@/components/base/EmptyState';
import {
  AGENTS_INDEX_ROUTE,
  AGENTS_TAB_ICON_CLASS,
  AGENTS_TAB_LIST_CLASS,
  AGENTS_TAB_TRIGGER_CLASS,
  AgentsTabKey,
  getAllowedAgentsTabs,
} from './agentsTabs';

interface AgentsTabsLayoutProps {
  tab: AgentsTabKey;
  children: ReactNode;
}

const AgentsTabsLayout = ({ tab, children }: AgentsTabsLayoutProps) => {
  const { t } = useLanguage('agents');
  const { can, isReady } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const allowedTabs = getAllowedAgentsTabs(can, isReady);
  const firstAllowedTab = allowedTabs[0] ?? null;
  const isCurrentTabAllowed = allowedTabs.some(allowed => allowed.key === tab);
  const isIndexRoute = location.pathname === AGENTS_INDEX_ROUTE;

  // No destination means no navigation: with zero allowed tabs a redirect would
  // bounce forever, so the layout stops at the terminal state below instead.
  const redirectTo =
    firstAllowedTab && (!isCurrentTabAllowed || isIndexRoute) ? firstAllowedTab.route : null;

  useEffect(() => {
    if (redirectTo) {
      navigate(redirectTo, { replace: true });
    }
  }, [redirectTo, navigate]);

  if (!isReady) {
    return (
      <div className="flex h-full items-center justify-center">
        <Bot className="size-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  if (!firstAllowedTab) {
    return (
      <EmptyState
        icon={ShieldOff}
        title={t('container.noAccess.title')}
        description={t('container.noAccess.description')}
        className="h-full"
      />
    );
  }

  if (redirectTo) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-shrink-0 border-b border-border px-6 pt-6">
        <h1 className="text-xl font-bold leading-7 tracking-tight text-foreground sm:text-2xl sm:leading-8">
          {t('container.title')}
        </h1>
        <p className="mt-1 hidden text-sm leading-5 text-muted-foreground sm:block">
          {t('container.subtitle')}
        </p>

        <Tabs
          value={tab}
          onValueChange={next => {
            const target = allowedTabs.find(allowed => allowed.key === next);
            if (target) {
              navigate(target.route);
            }
          }}
          className="mt-4"
        >
          <TabsList className={`${AGENTS_TAB_LIST_CLASS} pb-[14px]`}>
            {allowedTabs.map(allowed => {
              const Icon = allowed.icon;
              return (
                <TabsTrigger
                  key={allowed.key}
                  value={allowed.key}
                  className={AGENTS_TAB_TRIGGER_CLASS}
                >
                  <Icon className={AGENTS_TAB_ICON_CLASS} />
                  {t(allowed.labelKey)}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
};

export default AgentsTabsLayout;
