import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useGlobalConfig } from '@/contexts/GlobalConfigContext';
import { useLanguage } from '@/hooks/useLanguage';
import EmptyState from '@/components/base/EmptyState';
import { ShieldAlert } from 'lucide-react';
import { markBootstrapPhaseEnd, markBootstrapPhaseStart } from '@/utils/requestMonitor';

interface RouterGuardProps {
  children: React.ReactNode;
}

const SPECIAL_ROUTES = {
  // Anonymous public pages: auth, widget, setup and the lead-capture form
  // (/f/:slug) + public chat page (/chat/:slug). The latter two must be
  // reachable by logged-out visitors — they bypass the protected-route auth
  // check below.
  PUBLIC_ROUTES: ['/auth', '/login', '/register', '/widget', '/setup', '/f/', '/chat/'],
  // Routes that bypass the "redirect authenticated users to /conversations" rule.
  // /f/ and /chat/ are public-facing pages an authenticated user may legitimately
  // open (e.g. to preview their own form/chat page) without being bounced away.
  AUTH_EXEMPT_ROUTES: ['/setup/onboarding', '/f/', '/chat/'],
};

const RouterGuard: React.FC<RouterGuardProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading } = useAuthStore();
  const { user, isAuthenticated, logout } = useAuth();
  const {
    isReady: permissionsReady,
    loadFailed: permissionsLoadFailed,
    loading: permissionsLoading,
    refreshPermissions,
  } = usePermissions();
  const { setupRequired, setupLoading } = useGlobalConfig();
  const { t } = useLanguage('common');

  useEffect(() => {
    const handleSetupRequired = async () => {
      if (isAuthenticated) {
        await logout();
      }
      navigate('/login', { replace: true });
    };

    window.addEventListener('setup:required', handleSetupRequired);
    return () => window.removeEventListener('setup:required', handleSetupRequired);
  }, [isAuthenticated, logout, navigate]);

  useEffect(() => {
    // Wait for setup status to be resolved before making routing decisions
    if (setupLoading) return;

    markBootstrapPhaseStart('router-guard');

    const checkAuth = async () => {
      // If setup is required, redirect to /setup (unless already there)
      if (setupRequired && location.pathname !== '/setup') {
        navigate('/setup', { replace: true });
        return;
      }

      // If setup is NOT required but user is on /setup, redirect appropriately
      if (!setupRequired && location.pathname === '/setup') {
        navigate(isAuthenticated ? '/conversations' : '/login', { replace: true });
        return;
      }

      // Skip auth check for public routes
      const isPublicRoute = SPECIAL_ROUTES.PUBLIC_ROUTES.some(route =>
        location.pathname.startsWith(route)
      );

      if (isPublicRoute) {
        // If user is already authenticated and trying to access auth pages, redirect
        // EXCEPT when there are OAuth parameters (oauth_url or return_to) or accessing widget
        // IMPORTANT: Only redirect if user is fully loaded to avoid loops
        const isAuthExemptRoute = SPECIAL_ROUTES.AUTH_EXEMPT_ROUTES.some(route =>
          location.pathname.startsWith(route)
        );

        if (isAuthenticated && user && location.pathname !== '/widget' && !isLoading && !isAuthExemptRoute) {
          const urlParams = new URLSearchParams(location.search);
          const hasOAuthParams = urlParams.has('oauth_url') || urlParams.has('return_to');

          const isAuthConfirmationRoute = location.pathname.startsWith('/auth/confirmation');

          if (!hasOAuthParams && !isAuthConfirmationRoute) {
            const defaultRoute = '/conversations';
            if (location.pathname !== defaultRoute) {
              navigate(defaultRoute, { replace: true });
            }
          }
        }
        return;
      }

      // For protected routes, validate authentication
      if (!isLoading) {
        if (!isAuthenticated || !user) {
          navigate('/login', {
            state: { from: location },
            replace: true,
          });
          return;
        }

        if (!permissionsReady) {
          markBootstrapPhaseEnd('router-guard', { stage: 'waiting_permissions', path: location.pathname });
          return;
        }

      }
    };

    checkAuth();
    if (!isLoading && (!isAuthenticated || permissionsReady)) {
      markBootstrapPhaseEnd('router-guard', {
        stage: 'ready',
        path: location.pathname,
        authenticated: isAuthenticated,
      });
    }
  }, [location, isAuthenticated, user, isLoading, permissionsReady, navigate, setupRequired, setupLoading]);

  // Show loading spinner while setup status is being checked
  if (setupLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show loading spinner while checking auth or loading permissions
  const isCurrentPathPublic = SPECIAL_ROUTES.PUBLIC_ROUTES.some(route =>
    location.pathname.startsWith(route)
  );

  // A permission fetch that blew up leaves `permissionsReady` false forever, so
  // the spinner below would never end. Say what actually happened instead — the
  // whole point of CRM-164 is that a failure to load is not a denial, and the
  // user has to be able to tell the two apart and retry.
  if (!isLoading && !isCurrentPathPublic && isAuthenticated && permissionsLoadFailed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <EmptyState
          icon={ShieldAlert}
          title={t('permissions.loadFailed.title')}
          description={t('permissions.loadFailed.description')}
          action={{
            label: t('permissions.loadFailed.retry'),
            onClick: () => {
              void refreshPermissions();
            },
            disabled: permissionsLoading,
          }}
        />
        {/* A deterministic failure (403 from the membership gate, auth-service
            down) retries into the same error forever, and this screen replaces
            every protected route. Without a way out the user cannot even sign
            out to try another account. */}
        <button
          type="button"
          className="mt-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          onClick={() => {
            void logout();
          }}
        >
          {t('permissions.loadFailed.signOut')}
        </button>
      </div>
    );
  }

  if (isLoading || (!isCurrentPathPublic && isAuthenticated && !permissionsReady)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RouterGuard;
