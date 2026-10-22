import api from '@/services/core/api';
import { extractData, extractResponse } from '@/utils/apiHelpers';
import { appendField } from '@/utils/products/formData';
import { GoodsFiscalProfile, GoodsFiscalProfileFormData } from '@/types/goodsInvoices';

// Independente de fiscalEstablishmentsService (NFS-e/Guarulhos) por pedido
// explícito do usuário — NF-e/NFC-e é âmbito estadual (SEFAZ), outro
// cadastro, outro endpoint.
class GoodsFiscalProfilesService {
  private readonly baseUrl = '/finances/goods_fiscal_profiles';

  async list(): Promise<GoodsFiscalProfile[]> {
    const response = await api.get(this.baseUrl);
    return (extractResponse<GoodsFiscalProfile>(response).data as GoodsFiscalProfile[]) ?? [];
  }

  async create(
    payload: GoodsFiscalProfileFormData,
    certificateFile?: File,
    certificatePassword?: string,
    cscId?: string,
    cscToken?: string,
  ): Promise<GoodsFiscalProfile> {
    const formData = this.buildFormData(payload, certificateFile, certificatePassword, cscId, cscToken);
    const response = await api.post(this.baseUrl, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return extractData<GoodsFiscalProfile>(response);
  }

  async update(
    id: string,
    payload: Partial<GoodsFiscalProfileFormData>,
    certificateFile?: File,
    certificatePassword?: string,
    cscId?: string,
    cscToken?: string,
  ): Promise<GoodsFiscalProfile> {
    const formData = this.buildFormData(payload, certificateFile, certificatePassword, cscId, cscToken);
    const response = await api.patch(`${this.baseUrl}/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return extractData<GoodsFiscalProfile>(response);
  }

  async remove(id: string): Promise<{ id: string }> {
    const response = await api.delete(`${this.baseUrl}/${id}`);
    return extractData<{ id: string }>(response);
  }

  private buildFormData(
    payload: Partial<GoodsFiscalProfileFormData>,
    certificateFile?: File,
    certificatePassword?: string,
    cscId?: string,
    cscToken?: string,
  ): FormData {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) =>
      appendField(formData, `goods_fiscal_profile[${key}]`, value),
    );

    if (certificateFile) {
      formData.append('goods_fiscal_profile[certificate_file]', certificateFile, certificateFile.name);
    }
    if (certificatePassword) {
      formData.append('goods_fiscal_profile[certificate_password]', certificatePassword);
    }
    if (cscId) {
      formData.append('goods_fiscal_profile[csc_id]', cscId);
    }
    if (cscToken) {
      formData.append('goods_fiscal_profile[csc_token]', cscToken);
    }

    return formData;
  }
}

export const goodsFiscalProfilesService = new GoodsFiscalProfilesService();
