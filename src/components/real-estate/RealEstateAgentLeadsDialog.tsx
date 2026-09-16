import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from '@evoapi/design-system';
import { Mail, MessageCircle, Rocket } from 'lucide-react';
import { getAgentLeads, type AgentLead } from '@/services/realEstate/realEstateAgentsService';
import type { RealEstateAgent } from './RealEstateAgentsDialog';

interface RealEstateAgentLeadsDialogProps {
  agent: RealEstateAgent | null;
  onOpenChange: (open: boolean) => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

// Mesmo formato da notificação que já é enviada por WhatsApp quando um lead
// de tráfego pago cai (ver imagem de referência) — adaptado pros campos que
// o lead do site de imóveis realmente tem (imóvel em vez de campanha/anúncio
// do Meta Ads, que esse lead não tem por não vir de lá).
function formatLeadMessage(lead: AgentLead): string {
  const lines = ['🚀 Novo Lead para Você! 🚀', '', '📅 Data de Criação:', formatDate(lead.created_at), ''];
  if (lead.product_name) {
    lines.push('🏠 Imóvel:', lead.product_name, '');
  }
  lines.push('📋 Dados do Contato:');
  if (lead.contact.name) lines.push(`nome: ${lead.contact.name}`);
  if (lead.contact.phone) lines.push(`telefone: ${lead.contact.phone}`);
  if (lead.contact.email) lines.push(`email: ${lead.contact.email}`);
  if (lead.message) lines.push('', `mensagem: ${lead.message}`);
  return lines.join('\n');
}

// Mesma normalização usada no botão de WhatsApp do site público (buildWhatsappLink
// em RealEstatePage.tsx): sem DDI, assume Brasil.
function toWhatsappLink(phone: string, text: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.length <= 11) digits = `55${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function toMailtoLink(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Lista os leads atribuídos a um corretor, com botões pra reenviar cada um por email/WhatsApp. */
export function RealEstateAgentLeadsDialog({ agent, onOpenChange }: RealEstateAgentLeadsDialogProps) {
  const [leads, setLeads] = useState<AgentLead[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agent) return;
    setLoading(true);
    getAgentLeads(agent.id)
      .then(setLeads)
      .catch(() => toast.error('Erro ao carregar leads do corretor'))
      .finally(() => setLoading(false));
  }, [agent]);

  const sendByEmail = (lead: AgentLead) => {
    if (!agent?.email) {
      toast.error('Este corretor não tem email cadastrado');
      return;
    }
    window.open(toMailtoLink(agent.email, `Novo Lead: ${lead.product_name ?? lead.contact.name ?? ''}`, formatLeadMessage(lead)), '_blank');
  };

  const sendByWhatsapp = (lead: AgentLead) => {
    if (!agent?.phone) {
      toast.error('Este corretor não tem telefone cadastrado');
      return;
    }
    window.open(toWhatsappLink(agent.phone, formatLeadMessage(lead)), '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={Boolean(agent)} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-primary" /> Leads de {agent?.name}
          </DialogTitle>
          <DialogDescription>
            Leads do site de imóveis atribuídos a este corretor no Kanban "Imobiliária".
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-8">Carregando...</div>
        ) : leads.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8 border border-dashed rounded-md">
            Nenhum lead atribuído a este corretor ainda.
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {leads.map((lead) => (
              <div key={lead.id} className="border rounded-lg p-3 space-y-2 bg-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-primary">🚀 Novo Lead</span>
                  <span className="text-[0.65rem] text-muted-foreground">{formatDate(lead.created_at)}</span>
                </div>
                {lead.product_name && (
                  <p className="text-xs">
                    <span className="font-medium">🏠 Imóvel:</span> {lead.product_name}
                  </p>
                )}
                <div className="text-xs space-y-0.5">
                  <p className="font-medium">📋 Dados do Contato:</p>
                  {lead.contact.name && <p>nome: {lead.contact.name}</p>}
                  {lead.contact.phone && <p>telefone: {lead.contact.phone}</p>}
                  {lead.contact.email && <p>email: {lead.contact.email}</p>}
                </div>
                {lead.message && <p className="text-xs italic text-muted-foreground">"{lead.message}"</p>}
                <p className="text-[0.65rem] text-muted-foreground">Etapa: {lead.stage_name}</p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => sendByEmail(lead)}>
                    <Mail className="w-3.5 h-3.5 mr-1.5" /> Email
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => sendByWhatsapp(lead)}>
                    <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
