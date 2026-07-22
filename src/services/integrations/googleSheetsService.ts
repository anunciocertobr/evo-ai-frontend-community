import agentProcessorApi from '@/services/core/agentProcessorApi';
import type {
  GoogleSheetsConfig,
  GoogleSheetsItem,
  GoogleSheetsOAuthResponse,
  GoogleSheetsConnectionResponse,
} from '@/types/integrations/googleSheets';

const GoogleSheetsService = {
  /**
   * Generate Google Sheets OAuth authorization URL
   */
  async generateAuthorization(agentId: string, email?: string): Promise<GoogleSheetsOAuthResponse> {
    try {
      const { data } = await agentProcessorApi.post(
        `/agents/${agentId}/integrations/google-sheets/authorization`,
        { email }
      );
      // Processor wraps the payload as { success, data: { url }, message }.
      return data?.data ?? data;
    } catch (error) {
      console.error('GoogleSheetsService.generateAuthorization error:', error);
      throw error;
    }
  },

  /**
   * Complete Google Sheets OAuth flow and get spreadsheets
   */
  async completeAuthorization(
    agentId: string,
    code: string,
    state: string
  ): Promise<GoogleSheetsConnectionResponse> {
    try {
      const { data } = await agentProcessorApi.post(
        `/agents/${agentId}/integrations/google-sheets/callback`,
        {
          code,
          state,
        }
      );
      // The callback may arrive wrapped ({ success, data: {...} }) or already
      // flattened ({ email, spreadsheets }). Normalize so callers always read
      // `.success` (CallbackPage) and `.email`/`.spreadsheets` (onSuccess).
      return { success: data?.success ?? true, ...(data?.data ?? data ?? {}) };
    } catch (error) {
      console.error('GoogleSheetsService.completeAuthorization error:', error);
      throw error;
    }
  },

  /**
   * Get list of available spreadsheets
   */
  async getSpreadsheets(agentId: string): Promise<GoogleSheetsItem[]> {
    try {
      const { data } = await agentProcessorApi.get(
        `/agents/${agentId}/integrations/google-sheets/spreadsheets`
      );
      // Processor wraps the payload as { success, data, message } where `data`
      // is the spreadsheets array directly (older shapes nested it under
      // `data.spreadsheets`); handle both.
      const payload = data?.data ?? data;
      return Array.isArray(payload) ? payload : (payload?.spreadsheets ?? []);
    } catch (error) {
      console.error('GoogleSheetsService.getSpreadsheets error:', error);
      throw error;
    }
  },

  /**
   * Save Google Sheets configuration
   */
  async saveConfiguration(
    agentId: string,
    config: Partial<GoogleSheetsConfig>
  ): Promise<{ success: boolean }> {
    try {
      const { data } = await agentProcessorApi.put(
        `/agents/${agentId}/integrations/google-sheets`,
        config
      );
      return data;
    } catch (error) {
      console.error('GoogleSheetsService.saveConfiguration error:', error);
      throw error;
    }
  },

  /**
   * Disconnect Google Sheets
   */
  async disconnect(agentId: string): Promise<{ success: boolean }> {
    try {
      const { data } = await agentProcessorApi.delete(
        `/agents/${agentId}/integrations/google-sheets`
      );
      return data;
    } catch (error) {
      console.error('GoogleSheetsService.disconnect error:', error);
      throw error;
    }
  },

  /**
   * Get OAuth callback URL for the current domain
   */
  getOAuthCallbackUrl(): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/google-sheets/callback`;
  },
};

export default GoogleSheetsService;
