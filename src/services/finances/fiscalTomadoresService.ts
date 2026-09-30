import api from '@/services/core/api';
import { extractData, extractResponse } from '@/utils/apiHelpers';
import { FiscalTomador, FiscalTomadorFormData } from '@/types/fiscalInvoices';

class FiscalTomadoresService {
  private readonly baseUrl = '/finances/fiscal_tomadores';

  async list(): Promise<FiscalTomador[]> {
    const response = await api.get(this.baseUrl);
    return (extractResponse<FiscalTomador>(response).data as FiscalTomador[]) ?? [];
  }

  async create(payload: FiscalTomadorFormData): Promise<FiscalTomador> {
    const response = await api.post(this.baseUrl, { fiscal_tomador: payload });
    return extractData<FiscalTomador>(response);
  }

  async update(id: string, payload: Partial<FiscalTomadorFormData>): Promise<FiscalTomador> {
    const response = await api.patch(`${this.baseUrl}/${id}`, { fiscal_tomador: payload });
    return extractData<FiscalTomador>(response);
  }

  async remove(id: string): Promise<{ id: string }> {
    const response = await api.delete(`${this.baseUrl}/${id}`);
    return extractData<{ id: string }>(response);
  }
}

export const fiscalTomadoresService = new FiscalTomadoresService();
