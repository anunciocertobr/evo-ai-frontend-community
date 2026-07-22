import agentProcessorApi from '@/services/core/agentProcessorApi';
import type {
  GoogleCalendarConfig,
  GoogleCalendarItem,
  GoogleCalendarOAuthResponse,
  GoogleCalendarConnectionResponse
} from '@/types/integrations';

const GoogleCalendarService = {
  /**
   * Generate Google Calendar OAuth authorization URL
   */
  async generateAuthorization(agentId: string, email?: string): Promise<GoogleCalendarOAuthResponse> {
    try {
      const { data } = await agentProcessorApi.post(
        `/agents/${agentId}/integrations/google-calendar/authorization`,
        { email }
      );
      // Processor wraps the payload as { success, data: { url }, message }.
      return data?.data ?? data;
    } catch (error) {
      console.error('GoogleCalendarService.generateAuthorization error:', error);
      throw error;
    }
  },

  /**
   * Complete Google Calendar OAuth flow and get calendars
   */
  async completeAuthorization(
    agentId: string,
    code: string,
    state: string
  ): Promise<GoogleCalendarConnectionResponse> {
    try {
      const { data } = await agentProcessorApi.post(
        `/agents/${agentId}/integrations/google-calendar/callback`,
        {
          code,
          state,
        }
      );
      // The callback may arrive wrapped ({ success, data: {...} }) or already
      // flattened ({ email, calendars }). Normalize so callers always read
      // `.success` (CallbackPage) and `.email`/`.calendars` (onSuccess).
      return { success: data?.success ?? true, ...(data?.data ?? data ?? {}) };
    } catch (error) {
      console.error('GoogleCalendarService.completeAuthorization error:', error);
      throw error;
    }
  },

  /**
   * Get list of available calendars
   */
  async getCalendars(agentId: string): Promise<GoogleCalendarItem[]> {
    try {
      const { data } = await agentProcessorApi.get(
        `/agents/${agentId}/integrations/google-calendar/calendars`
      );
      // Processor wraps the payload as { success, data, message } where `data`
      // is the calendars array directly (older shapes nested it under
      // `data.calendars`); handle both.
      const payload = data?.data ?? data;
      return Array.isArray(payload) ? payload : (payload?.calendars ?? []);
    } catch (error) {
      console.error('GoogleCalendarService.getCalendars error:', error);
      throw error;
    }
  },

  /**
   * Save Google Calendar configuration
   */
  async saveConfiguration(
    agentId: string,
    config: Partial<GoogleCalendarConfig>
  ): Promise<{ success: boolean }> {
    try {
      const { data } = await agentProcessorApi.put(
        `/agents/${agentId}/integrations/google-calendar`,
        config
      );
      return data;
    } catch (error) {
      console.error('GoogleCalendarService.saveConfiguration error:', error);
      throw error;
    }
  },

  /**
   * Disconnect Google Calendar
   */
  async disconnect(agentId: string): Promise<{ success: boolean }> {
    try {
      const { data } = await agentProcessorApi.delete(
        `/agents/${agentId}/integrations/google-calendar`
      );
      return data;
    } catch (error) {
      console.error('GoogleCalendarService.disconnect error:', error);
      throw error;
    }
  },

  /**
   * Check availability for a specific date/time
   */
  async checkAvailability(
    agentId: string,
    params: {
      calendarId: string;
      start: string; // ISO date
      end: string; // ISO date
    }
  ): Promise<{ available: boolean; slots?: Array<{ start: string; end: string }> }> {
    try {
      const { data } = await agentProcessorApi.post(
        `/agents/${agentId}/integrations/google-calendar/availability`,
        params
      );
      return data;
    } catch (error) {
      console.error('GoogleCalendarService.checkAvailability error:', error);
      throw error;
    }
  },

  /**
   * Create a calendar event
   */
  async createEvent(
    agentId: string,
    event: {
      calendarId: string;
      summary: string;
      description?: string;
      start: string; // ISO date
      end: string; // ISO date
      attendees?: Array<{ email: string; name?: string }>;
      meetLink?: boolean;
    }
  ): Promise<{ success: boolean; eventId?: string; meetLink?: string }> {
    try {
      const { data } = await agentProcessorApi.post(
        `/agents/${agentId}/integrations/google-calendar/events`,
        event
      );
      return data;
    } catch (error) {
      console.error('GoogleCalendarService.createEvent error:', error);
      throw error;
    }
  },

  /**
   * Get OAuth callback URL for the current domain
   */
  getOAuthCallbackUrl(): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/google-calendar/callback`;
  },
};

export default GoogleCalendarService;
