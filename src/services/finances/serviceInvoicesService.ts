import api from '@/services/core/api';
import { extractData, extractResponse } from '@/utils/apiHelpers';
import { ServiceInvoice, ServiceInvoiceFormData } from '@/types/fiscalInvoices';

class ServiceInvoicesService {
  private readonly baseUrl = '/finances/service_invoices';

  async list(): Promise<ServiceInvoice[]> {
    const response = await api.get(this.baseUrl);
    return (extractResponse<ServiceInvoice>(response).data as ServiceInvoice[]) ?? [];
  }

  async get(id: string): Promise<ServiceInvoice> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return extractData<ServiceInvoice>(response);
  }

  async create(
    fiscalEstablishmentId: string,
    payload: Omit<ServiceInvoiceFormData, 'fiscal_establishment_id'>,
  ): Promise<ServiceInvoice> {
    const response = await api.post(this.baseUrl, {
      service_invoice: { ...payload, fiscal_establishment_id: fiscalEstablishmentId },
    });
    return extractData<ServiceInvoice>(response);
  }

  async cancel(id: string): Promise<ServiceInvoice> {
    const response = await api.post(`${this.baseUrl}/${id}/cancel`);
    return extractData<ServiceInvoice>(response);
  }

  async getPdf(id: string): Promise<Blob> {
    const response = await api.get(`${this.baseUrl}/${id}/pdf`, { responseType: 'blob' });
    return response.data as Blob;
  }

  async sendPdf(
    id: string,
    destination: { inbox_id: string; whatsapp_number?: string; group_jid?: string; group_name?: string },
  ): Promise<void> {
    await api.post(`${this.baseUrl}/${id}/send_pdf`, destination);
  }
}

export const serviceInvoicesService = new ServiceInvoicesService();
