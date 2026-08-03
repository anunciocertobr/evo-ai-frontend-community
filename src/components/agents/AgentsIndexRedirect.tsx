import { Navigate } from 'react-router-dom';
import { Bot, ShieldOff } from 'lucide-react';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useLanguage } from '@/hooks/useLanguage';
import EmptyState from '@/components/base/EmptyState';
import { resolveFirstAllowedTab } from './agentsTabs';

/**
 * `/agents` has no screen of its own. It resolves to the first tab the user may
 * read — never to a fixed `/agents/list`, which 403s whoever only has Ferramentas
 * or MCPs. With no readable tab it stops on a terminal state instead of looping.
 */
const AgentsIndexRedirect = () => {
  const { t } = useLanguage('agents');
  const { can, isReady } = usePermissions();
  const target = resolveFirstAllowedTab(can, isReady);

  if (!isReady) {
    return (
      <div className="flex h-full items-center justify-center">
        <Bot className="size-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  if (!target) {
    return (
      <EmptyState
        icon={ShieldOff}
        title={t('container.noAccess.title')}
        description={t('container.noAccess.description')}
        className="h-full"
      />
    );
  }

  return <Navigate to={target.route} replace />;
};

export default AgentsIndexRedirect;
