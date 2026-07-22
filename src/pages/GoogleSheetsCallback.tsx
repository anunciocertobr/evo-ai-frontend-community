import GoogleSheetsService from '@/services/integrations/googleSheetsService';
import { createCallbackPage } from '@/utils/createCallbackPage';

const GoogleSheetsCallback = createCallbackPage({
  integrationName: 'Google Sheets',
  service: GoogleSheetsService,
  integrationId: 'google-sheets',
  // Land back on the agent's Integrations tab (not the MCP-servers default) so
  // the freshly-connected state is visible.
  redirectPath: (agentId: string) => `/agents/${agentId}/edit?tab=integrations`,
  onSuccess: async (response, agentId) => {
    await GoogleSheetsService.saveConfiguration(agentId, {
      provider: 'google_sheets',
      email: response.email,
      connected: true,
      spreadsheets: response.spreadsheets || [],
    });
  },
});

export default GoogleSheetsCallback;
