import api from '@/services/core/api';
import { extractData, extractResponse } from '@/utils/apiHelpers';
import {
  ServiceInvoiceSchedule,
  ServiceInvoiceScheduleFormData,
  ServiceInvoiceScheduleConfirmation,
} from '@/types/serviceInvoiceSchedules';

class ServiceInvoiceSchedulesService {
  private readonly baseUrl = '/finances/service_invoice_schedules';

  async list(): Promise<ServiceInvoiceSchedule[]> {
    const response = await api.get(this.baseUrl);
    return (extractResponse<ServiceInvoiceSchedule>(response).data as ServiceInvoiceSchedule[]) ?? [];
  }

  async create(payload: ServiceInvoiceScheduleFormData): Promise<ServiceInvoiceSchedule> {
    const response = await api.post(this.baseUrl, { service_invoice_schedule: payload });
    return extractData<ServiceInvoiceSchedule>(response);
  }

  async update(id: string, payload: Partial<ServiceInvoiceScheduleFormData>): Promise<ServiceInvoiceSchedule> {
    const response = await api.patch(`${this.baseUrl}/${id}`, { service_invoice_schedule: payload });
    return extractData<ServiceInvoiceSchedule>(response);
  }

  async remove(id: string): Promise<{ id: string }> {
    const response = await api.delete(`${this.baseUrl}/${id}`);
    return extractData<{ id: string }>(response);
  }
}

class ServiceInvoiceScheduleConfirmationsService {
  private readonly baseUrl = '/finances/service_invoice_schedule_confirmations';

  async pending(): Promise<ServiceInvoiceScheduleConfirmation[]> {
    const response = await api.get(`${this.baseUrl}/pending`);
    return (extractResponse<ServiceInvoiceScheduleConfirmation>(response).data as ServiceInvoiceScheduleConfirmation[]) ?? [];
  }

  async confirm(id: string): Promise<ServiceInvoiceScheduleConfirmation> {
    const response = await api.post(`${this.baseUrl}/${id}/confirm`);
    return extractData<ServiceInvoiceScheduleConfirmation>(response);
  }

  async decline(id: string): Promise<ServiceInvoiceScheduleConfirmation> {
    const response = await api.post(`${this.baseUrl}/${id}/decline`);
    return extractData<ServiceInvoiceScheduleConfirmation>(response);
  }

  async editAndConfirm(
    id: string,
    overrides: { valor_servicos?: string; discriminacao?: string },
  ): Promise<ServiceInvoiceScheduleConfirmation> {
    const response = await api.post(`${this.baseUrl}/${id}/edit_and_confirm`, { overrides });
    return extractData<ServiceInvoiceScheduleConfirmation>(response);
  }
}

export const serviceInvoiceSchedulesService = new ServiceInvoiceSchedulesService();
export const serviceInvoiceScheduleConfirmationsService = new ServiceInvoiceScheduleConfirmationsService();
