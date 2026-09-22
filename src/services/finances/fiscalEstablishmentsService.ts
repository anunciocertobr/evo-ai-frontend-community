import api from '@/services/core/api';
import { extractData, extractResponse } from '@/utils/apiHelpers';
import { appendField } from '@/utils/products/formData';
import { FiscalEstablishment, FiscalEstablishmentFormData } from '@/types/fiscalInvoices';

class FiscalEstablishmentsService {
  private readonly baseUrl = '/finances/fiscal_establishments';

  async list(): Promise<FiscalEstablishment[]> {
    const response = await api.get(this.baseUrl);
    return (extractResponse<FiscalEstablishment>(response).data as FiscalEstablishment[]) ?? [];
  }

  async create(
    payload: FiscalEstablishmentFormData,
    certificateFile?: File,
    certificatePassword?: string,
  ): Promise<FiscalEstablishment> {
    const formData = this.buildFormData(payload, certificateFile, certificatePassword);
    const response = await api.post(this.baseUrl, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return extractData<FiscalEstablishment>(response);
  }

  async update(
    id: string,
    payload: Partial<FiscalEstablishmentFormData>,
    certificateFile?: File,
    certificatePassword?: string,
  ): Promise<FiscalEstablishment> {
    const formData = this.buildFormData(payload, certificateFile, certificatePassword);
    const response = await api.patch(`${this.baseUrl}/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return extractData<FiscalEstablishment>(response);
  }

  async remove(id: string): Promise<{ id: string }> {
    const response = await api.delete(`${this.baseUrl}/${id}`);
    return extractData<{ id: string }>(response);
  }

  private buildFormData(
    payload: Partial<FiscalEstablishmentFormData>,
    certificateFile?: File,
    certificatePassword?: string,
  ): FormData {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) =>
      appendField(formData, `fiscal_establishment[${key}]`, value),
    );

    if (certificateFile) {
      formData.append('fiscal_establishment[certificate_file]', certificateFile, certificateFile.name);
    }
    if (certificatePassword) {
      formData.append('fiscal_establishment[certificate_password]', certificatePassword);
    }

    return formData;
  }
}

export const fiscalEstablishmentsService = new FiscalEstablishmentsService();
