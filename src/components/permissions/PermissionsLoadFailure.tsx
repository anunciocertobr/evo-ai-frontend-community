import { ShieldAlert } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/utils/cn';

interface PermissionsLoadFailureProps {
  className?: string;
}

/**
 * Shown when the permission fetch blew up and left no list to answer `can()`
 * with. Without it every screen below renders as if nothing were granted — the
 * load failure reaching the user as a denial (CRM-164).
 *
 * Two hosts render it, which is why it lives here instead of inside either one:
 * RouterGuard, for the standalone app, because it is the piece that knows which
 * paths are public; and PermissionsProvider, because the embedded shell mounts
 * the vendor providers and pages but never the vendor router.
 */
const PermissionsLoadFailure: React.FC<PermissionsLoadFailureProps> = ({ className }) => {
  const { t } = useLanguage('common');
  const { logout } = useAuth();
  const { loading, refreshPermissions } = usePermissions();

  return (
    <div
      data-testid="permissions-load-failure"
      className={cn('flex flex-col items-center justify-center h-full', className)}
    >
      <EmptyState
        icon={ShieldAlert}
        title={t('permissions.loadFailed.title')}
        description={t('permissions.loadFailed.description')}
        action={{
          label: loading ? t('permissions.loadFailed.retrying') : t('permissions.loadFailed.retry'),
          onClick: () => {
            void refreshPermissions();
          },
          disabled: loading,
        }}
      />
      {/* A deterministic failure (403 from the membership gate, auth-service
          down) retries into the same error forever, and this panel replaces
          every protected screen. Without a way out the user cannot even sign
          out to try another account. */}
      <button
        type="button"
        data-testid="permissions-load-failure-signout"
        className="mt-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        onClick={() => {
          void logout();
        }}
      >
        {t('permissions.loadFailed.signOut')}
      </button>
    </div>
  );
};

export default PermissionsLoadFailure;
