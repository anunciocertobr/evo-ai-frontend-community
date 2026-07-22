import type { StandardResponse, ResponseMeta } from '@/types/core';

/**
 * Tipos para o sistema de permissões
 * Baseado no ResourceActionsConfig do evo-auth-service
 */

// Detalhes de uma permissão específica
export interface PermissionDetail {
  key: string;
  resource: string;
  action: string;
  display_name: string;
  resource_name: string;
  action_name: string;
  description: string;
}

// Configuração de um recurso
export interface ResourceActionConfig {
  name: string;
  description: string;
  // Non-manageable permissions: `basic` is held by every authenticated user;
  // `implied_by` names the grant that carries it operationally. Either locks
  // the checkbox in the role editor (granting/revoking on a role is a no-op).
  basic?: boolean;
  implied_by?: string | null;
  // Catalog metadata that hides the action from the role editor entirely (never
  // rendered as a checkbox, never persisted). Orthogonal to `basic`/`implied_by`
  // (which render a locked-but-visible checkbox). Defaults to false/absent.
  system?: boolean;
}

export interface ResourceConfig {
  name: string;
  description: string;
  actions: Record<string, ResourceActionConfig>;
}

export interface ResourceActionsData {
  resources: Record<string, ResourceConfig>;
  all_permissions: PermissionDetail[];
}

// Resposta do endpoint /api/v1/resource_actions (seguindo padrão StandardResponse)
export interface ResourceActionsResponse extends StandardResponse<ResourceActionsData> {
  meta: ResponseMeta & {
    total_resources: number;
    total_permissions: number;
    last_updated: string;
  };
}

// Resposta de validação de permissão
export interface ValidatePermissionResponse {
  permission_key: string;
  valid: boolean;
  display_name?: string;
  resource?: string;
  action?: string;
  resource_name?: string;
  action_name?: string;
  description?: string;
}
