import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useAuthStore } from '@/store/authStore';
import { permissionsService } from '@/services/permissions';
import type { ResourceActionsResponse } from '@/types/auth';

interface PermissionsContextValue {
  // Permissões
  userPermissions: string[];
  accountPermissions: string[];

  // Métodos de verificação
  can: (resource: string, action: string, type?: 'account' | 'user') => boolean;
  canAny: (permissions: string[], type?: 'account' | 'user') => boolean;
  canAll: (permissions: string[], type?: 'account' | 'user') => boolean;

  // Estado
  loading: boolean;
  isReady: boolean;
  loadFailed: boolean;
  error: string | null;

  // Métodos utilitários
  refreshPermissions: () => Promise<void>;
  createPermission: (resource: string, action: string) => string;
  isValidPermission: (permission: string) => boolean;
  getPermissionDisplayName: (permission: string) => string;
}

type FetchStatus = 'pending' | 'loaded' | 'failed';

export const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

interface PermissionsProviderProps {
  children: React.ReactNode;
}

export const PermissionsProvider: React.FC<PermissionsProviderProps> = ({ children }) => {
  const { user } = useAuth();

  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [accountPermissions, setAccountPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Outcome of each permission fetch for the current user. `pending` keeps
  // `isReady` false during the render between user appearing and the fetch
  // effect running — that window used to flash the Unauthorized page after a
  // fresh login. `failed` keeps it false too: a fetch that blew up leaves an
  // empty list that is indistinguishable from a real denial (CRM-164), so the
  // app must not act on it. Only `loaded` means the list can be trusted —
  // including a legitimately empty one.
  const [userPermsStatus, setUserPermsStatus] = useState<FetchStatus>('pending');
  const [accountPermsStatus, setAccountPermsStatus] = useState<FetchStatus>('pending');

  // Config state
  const [resourceActions, setResourceActions] = useState<ResourceActionsResponse | null>(null);
  const [configLoading, setConfigLoading] = useState(false);

  // Reset the fetch status whenever the logged-in user changes so the next
  // user's permissions go through the fetch cycle before `isReady` flips back
  // to true.
  useEffect(() => {
    setUserPermsStatus('pending');
    setAccountPermsStatus('pending');
  }, [user?.id]);

  // Load permissions config (metadata)
  useEffect(() => {

    const loadConfig = async () => {
      const isAuthenticated = useAuthStore.getState().isLoggedIn;
      if (!isAuthenticated) return;

      try {
        setConfigLoading(true);
        const config = await permissionsService.getResourceActions();
        setResourceActions(config);
      } catch (err) {
        console.error('Error loading permissions config:', err);
      } finally {
        setConfigLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Load user permissions
  useEffect(() => {
    if (!user?.id) {
      setUserPermissions([]);
      setUserPermsStatus('loaded');
      return;
    }

    // Nothing cancels an in-flight request, and the fetch can outlive the effect
    // (user changes, or a retry supersedes it). Without this flag an orphaned
    // rejection landing after a newer success would stamp `failed` over a
    // perfectly loaded context and bounce the user to the failure screen.
    let cancelled = false;

    const loadUserPermissions = async () => {
      try {
        const isAuthenticated = useAuthStore.getState().isLoggedIn;
        if (!isAuthenticated) {
          if (cancelled) return;
          setUserPermissions([]);
          setUserPermsStatus('loaded');
          return;
        }

        setLoading(true);
        setError(null);
        const permissions = await permissionsService.getUserPermissions();
        if (cancelled) return;
        setUserPermissions(permissions);
        setUserPermsStatus('loaded');
      } catch (error) {
        if (cancelled) return;
        console.error('Erro ao carregar permissões do usuário:', error);
        setError('Erro ao carregar permissões do usuário');
        setUserPermissions([]);
        setUserPermsStatus('failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadUserPermissions();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Load account permissions (específicas do account baseadas no AccountUser role)
  useEffect(() => {
    // Verificar autenticação primeiro - precisa ter user também
    const isAuthenticated = useAuthStore.getState().isLoggedIn;
    if (!isAuthenticated || !user) {
      setAccountPermissions([]);
      setAccountPermsStatus('loaded');
      return;
    }

    // ⚡ Proteção: não carregar se já tem permissões (evita recarregar desnecessariamente)
    if (accountPermissions.length > 0) {
      setAccountPermsStatus('loaded');
      return;
    }

    // See the user-permissions effect: an orphaned rejection must not overwrite
    // a newer result.
    let cancelled = false;

    const loadAccountPermissions = async () => {
      try {
        const isAuthenticated = useAuthStore.getState().isLoggedIn;

        if (!isAuthenticated) {
          if (cancelled) return;
          setAccountPermissions([]);
          setAccountPermsStatus('loaded');
          return;
        }

        setLoading(true);
        setError(null);
        const permissions = await permissionsService.getAccountPermissions();

        if (cancelled) return;
        setAccountPermissions(permissions);
        setAccountPermsStatus('loaded');
      } catch (error) {
        if (cancelled) return;
        console.error('Erro ao carregar permissões do account:', error);
        setError('Erro ao carregar permissões do account');
        setAccountPermissions([]);
        setAccountPermsStatus('failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAccountPermissions();

    return () => {
      cancelled = true;
    };
  }, [user, accountPermissions.length]);

  const createPermission = useCallback((resource: string, action: string): string => {
    return `${resource}.${action}`;
  }, []);

  const isValidPermission = useCallback(
    (permission: string): boolean => {
      if (!resourceActions) return true; // Se não tiver config, aceita
      return resourceActions.data?.all_permissions?.some(p => p.key === permission) || false;
    },
    [resourceActions],
  );

  const getPermissionDisplayName = useCallback(
    (permission: string): string => {
      if (!resourceActions) return permission;
      const perm = resourceActions.data?.all_permissions?.find(p => p.key === permission);
      return perm?.display_name || permission;
    },
    [resourceActions],
  );

  // Data-driven by design: the answer comes only from the granted permission
  // list. Do NOT add a role short-circuit (e.g. "super_admin sees everything") —
  // the backend has no such bypass either (its resource gate and /permissions
  // are row-based), so a UI shortcut would render controls the API then 403s.
  // Guarded by PermissionsContext.spec.tsx.
  const can = useCallback(
    (resource: string, action: string, type: 'account' | 'user' = 'account'): boolean => {
      const permission = createPermission(resource, action);
      const permissionsArray = type === 'user' ? userPermissions : accountPermissions;

      // Se ainda está carregando e não há permissões, aguardar
      if (loading && permissionsArray.length === 0) {
        return false;
      }

      // Se não está carregando mas não há permissões, retornar false
      if (permissionsArray.length === 0) {
        return false;
      }

      if (error && permissionsArray.length > 0) {
        const hasPermission = permissionsArray.includes(permission);
        return hasPermission;
      }

      if (!error && !isValidPermission(permission)) {
        return false;
      }

      const hasPermission = permissionsArray.includes(permission);
      return hasPermission;
    },
    [
      createPermission,
      userPermissions,
      accountPermissions,
      error,
      isValidPermission,
      loading,
    ],
  );

  const canAny = useCallback(
    (permissions: string[], type: 'account' | 'user' = 'account'): boolean => {
      const permissionsArray = type === 'user' ? userPermissions : accountPermissions;
      return permissions.some(permission => permissionsArray.includes(permission));
    },
    [userPermissions, accountPermissions],
  );

  const canAll = useCallback(
    (permissions: string[], type: 'account' | 'user' = 'account'): boolean => {
      const permissionsArray = type === 'user' ? userPermissions : accountPermissions;
      return permissions.every(permission => permissionsArray.includes(permission));
    },
    [userPermissions, accountPermissions],
  );

  const refreshPermissions = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    // The two fetches are independent, and each drives its own status. Awaiting
    // them in sequence meant a rejected user fetch skipped the account fetch
    // entirely, so the retry offered on a failure could never refresh a stale
    // account list. A failed leg keeps its last known list rather than blanking
    // it — `isReady` is false either way, so nothing acts on it.
    const [userResult, accountResult] = await Promise.allSettled([
      permissionsService.getUserPermissions(true),
      permissionsService.getAccountPermissions(true),
    ]);

    if (userResult.status === 'fulfilled') {
      setUserPermissions(userResult.value);
      setUserPermsStatus('loaded');
    } else {
      console.error('Erro ao recarregar permissões do usuário:', userResult.reason);
      setUserPermsStatus('failed');
    }

    if (accountResult.status === 'fulfilled') {
      setAccountPermissions(accountResult.value);
      setAccountPermsStatus('loaded');
    } else {
      console.error('Erro ao recarregar permissões do account:', accountResult.reason);
      setAccountPermsStatus('failed');
    }

    if (userResult.status === 'rejected' || accountResult.status === 'rejected') {
      setError('Erro ao recarregar permissões');
    }

    setLoading(false);
  }, [user?.id]);

  // isReady: true when user is loaded, config finished, and both permission
  // fetches SUCCEEDED at least once for the current user. Tracking the outcome
  // (rather than just `!loading`) prevents consumers from evaluating `can()`
  // against empty arrays — during the render window between user appearing and
  // the fetch effect firing (flashed Unauthorized after a fresh login), and
  // after a failed fetch (served the failure as a denial, CRM-164).
  const isReady = useMemo(() => {
    if (!user) return false;
    if (configLoading) return false;
    if (loading) return false;
    return userPermsStatus === 'loaded' && accountPermsStatus === 'loaded';
  }, [configLoading, loading, user, userPermsStatus, accountPermsStatus]);

  // Only report a failure once BOTH fetches have settled. `loading` cannot serve
  // as the gate here: it is one shared flag, so whichever fetch finishes first
  // clears it while the other is still in flight. Reporting on the first
  // rejection alone flashed the failure screen mid-boot — the same "transient
  // wrong state shown to the user" this fix exists to remove.
  const permissionsSettled = userPermsStatus !== 'pending' && accountPermsStatus !== 'pending';
  const loadFailed =
    permissionsSettled && (userPermsStatus === 'failed' || accountPermsStatus === 'failed');

  const value: PermissionsContextValue = {
    userPermissions,
    accountPermissions,
    can,
    canAny,
    canAll,
    loading: loading || configLoading,
    isReady,
    loadFailed,
    error,
    refreshPermissions,
    createPermission,
    isValidPermission,
    getPermissionDisplayName,
  };

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
};

export const usePermissions = (): PermissionsContextValue => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};
