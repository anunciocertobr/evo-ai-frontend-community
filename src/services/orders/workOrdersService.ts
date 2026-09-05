import api from '@/services/core/api';
import { extractData, extractResponse } from '@/utils/apiHelpers';
import type {
  WorkOrder,
  WorkOrderFormData,
  WorkOrdersListParams,
} from '@/types/orders/workOrder';

export interface WorkOrderPipelineStageOption {
  id: string;
  name: string;
}

export interface WorkOrderPipelineOption {
  id: string;
  name: string;
  stages: WorkOrderPipelineStageOption[];
}

export interface WorkOrderPipelineConfig {
  pipeline_id: string | null;
  pipeline_stage_id: string | null;
  pipelines: WorkOrderPipelineOption[];
}

class WorkOrdersService {
  private readonly baseUrl = '/work_orders';

  async getOrders(params?: WorkOrdersListParams): Promise<WorkOrder[]> {
    try {
      const response = await api.get(this.baseUrl, { params });
      return extractResponse<WorkOrder>(response).data;
    } catch (error) {
      console.error('WorkOrdersService.getOrders error:', error);
      throw error;
    }
  }

  async getOrder(id: string): Promise<WorkOrder> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return extractData<WorkOrder>(response);
  }

  async createOrder(payload: WorkOrderFormData): Promise<WorkOrder> {
    const response = await api.post(this.baseUrl, { work_order: payload });
    return extractData<WorkOrder>(response);
  }

  async updateOrder(id: string, payload: Partial<WorkOrderFormData>): Promise<WorkOrder> {
    const response = await api.put(`${this.baseUrl}/${id}`, { work_order: payload });
    return extractData<WorkOrder>(response);
  }

  async deleteOrder(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  // Config de pra qual pipeline/etapa uma ordem nova vira card automaticamente
  // (Orders::PipelineSyncService no backend) — ver WorkOrderPipelineConfig.
  async getPipelineConfig(): Promise<WorkOrderPipelineConfig> {
    const response = await api.get('/admin/work_order_pipeline_config');
    return extractData<WorkOrderPipelineConfig>(response);
  }

  async updatePipelineConfig(pipelineId: string | null, pipelineStageId: string | null): Promise<WorkOrderPipelineConfig> {
    const response = await api.put('/admin/work_order_pipeline_config', {
      pipeline_id: pipelineId,
      pipeline_stage_id: pipelineStageId,
    });
    return extractData<WorkOrderPipelineConfig>(response);
  }
}

export const workOrdersService = new WorkOrdersService();
