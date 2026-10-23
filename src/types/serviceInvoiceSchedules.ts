import { ServiceInvoiceEndereco } from '@/types/fiscalInvoices';

// "Bot" de emissão recorrente de NFS-e — manda confirmação por WhatsApp/
// Telegram/CRM antes de emitir, nunca emite sozinho sem resposta.

export type ServiceInvoiceScheduleRecurrence = 'once' | 'monthly' | 'weekly';
export type ServiceInvoiceScheduleChannel = 'whatsapp' | 'telegram' | 'notification';

export interface ServiceInvoiceSchedule {
  id: string;
  fiscal_establishment_id: string;
  tomador_nome: string;
  tomador_cpf_cnpj: string;
  tomador_email?: string | null;
  tomador_endereco?: ServiceInvoiceEndereco;
  discriminacao: string;
  codigo_servico_municipal: string;
  codigo_nbs: string;
  codigo_tributacao_municipio?: string | null;
  valor_servicos: string;
  valor_deducoes: string;
  aliquota_iss_pct?: string | null;
  recurrence_type: ServiceInvoiceScheduleRecurrence;
  day_of_month?: number | null;
  day_of_week?: number | null;
  next_run_at: string;
  notify_before_value: number;
  notify_before_unit: 'days' | 'hours';
  channels: ServiceInvoiceScheduleChannel[];
  notify_whatsapp_number?: string | null;
  notify_telegram_chat_id?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceInvoiceScheduleFormData {
  fiscal_establishment_id: string;
  tomador_nome: string;
  tomador_cpf_cnpj: string;
  tomador_email?: string;
  tomador_endereco?: ServiceInvoiceEndereco;
  discriminacao: string;
  codigo_servico_municipal: string;
  codigo_nbs: string;
  codigo_tributacao_municipio?: string;
  valor_servicos: number;
  valor_deducoes?: number;
  aliquota_iss_pct?: number;
  recurrence_type: ServiceInvoiceScheduleRecurrence;
  day_of_month?: number;
  day_of_week?: number;
  next_run_at: string;
  notify_before_value: number;
  notify_before_unit: 'days' | 'hours';
  channels: ServiceInvoiceScheduleChannel[];
  notify_whatsapp_number?: string;
  notify_telegram_chat_id?: string;
  active?: boolean;
}

export type ServiceInvoiceScheduleConfirmationStatus =
  | 'pending_notification'
  | 'notified'
  | 'awaiting_edit_field'
  | 'awaiting_edit_value'
  | 'awaiting_edit_confirmation'
  | 'confirmed'
  | 'declined'
  | 'emitted'
  | 'error'
  | 'no_response';

export interface ServiceInvoiceScheduleConfirmation {
  id: string;
  service_invoice_schedule_id: string;
  tomador_nome: string;
  scheduled_for: string;
  status: ServiceInvoiceScheduleConfirmationStatus;
  overrides: Record<string, string>;
  notified_at?: string | null;
  responded_at?: string | null;
  erro_mensagem?: string | null;
  invoice_attrs: {
    tomador_nome: string;
    tomador_cpf_cnpj: string;
    discriminacao: string;
    valor_servicos: number | string;
  };
  created_at: string;
}
