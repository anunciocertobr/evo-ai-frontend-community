import evoaiApi from '@/services/core/apiEvoAI';
import { extractData, buildPaginationParams } from '@/utils/apiHelpers';
import type {
  IntegrationCredential,
  IntegrationCredentialCreate,
  IntegrationCredentialDeleteResponse,
  IntegrationCredentialUpdate,
} from '@/types/agents';

// EVO-2250 story 2.1: the integration-credential vault. The registry lives in
// evo-ai-core-service (`evo_core_integration_credentials`); routes mirror the
// sibling top-level resources (`/custom-tools`, `/custom-mcp-servers`).
// The API returns `value_hint` only — the value itself never leaves the server.

export const listIntegrationCredentials = async (
  page = 1,
  pageSize = 100,
): Promise<IntegrationCredential[]> => {
  const response = await evoaiApi.get('/integration-credentials', {
    params: buildPaginationParams(page, pageSize),
  });
  return extractData<IntegrationCredential[]>(response);
};

export const createIntegrationCredential = async (
  data: IntegrationCredentialCreate,
): Promise<IntegrationCredential> => {
  const response = await evoaiApi.post('/integration-credentials', data);
  return extractData<IntegrationCredential>(response);
};

export const updateIntegrationCredential = async (
  credentialId: string,
  data: IntegrationCredentialUpdate,
): Promise<IntegrationCredential> => {
  const response = await evoaiApi.put(`/integration-credentials/${credentialId}`, data);
  return extractData<IntegrationCredential>(response);
};

export const deleteIntegrationCredential = async (
  credentialId: string,
): Promise<IntegrationCredentialDeleteResponse> => {
  const response = await evoaiApi.delete(`/integration-credentials/${credentialId}`);
  return extractData<IntegrationCredentialDeleteResponse>(response);
};
