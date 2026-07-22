import GoogleCalendarService from '@/services/integrations/googleCalendarService';
import { createCallbackPage } from '@/utils/createCallbackPage';

const GoogleCalendarCallback = createCallbackPage({
  integrationName: 'Google Calendar',
  service: GoogleCalendarService,
  integrationId: 'google-calendar',
  // Land back on the agent's Integrations tab (not the MCP-servers default) so
  // the freshly-connected state is visible.
  redirectPath: (agentId: string) => `/agents/${agentId}/edit?tab=integrations`,
  onSuccess: async (response, agentId) => {
    await GoogleCalendarService.saveConfiguration(agentId, {
      provider: 'google_calendar',
      email: response.email,
      connected: true,
      calendars: response.calendars || [],
    });
  },
});

export default GoogleCalendarCallback;
