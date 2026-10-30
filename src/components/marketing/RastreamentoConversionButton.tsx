import { useState } from 'react';
import { toast } from 'sonner';
import { Send, Loader2 } from 'lucide-react';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
} from '@evoapi/design-system';
import { rastreamentosService } from '@/services/marketing/rastreamentosService';

const STANDARD_EVENTS = ['Lead', 'Purchase', 'Contact', 'Schedule', 'SubmitApplication', 'CompleteRegistration', 'Message'];

interface Props {
  adId?: string | null;
  ctwaClid?: string | null;
  phone?: string | null;
}

// Botão "Enviar pro Meta" por linha, pro Rastreamentos (contatos Helena/
// WTS) — mesmo destino da Meta Conversions API que o "Ver Leads" usa
// (Meta::ConversionsApiService, via o novo endpoint send_conversion), só
// que mais simples: aqui ad_id/ctwa_clid/telefone já vêm da própria linha,
// não precisa de um formulário com todos os campos de novo (esse contato
// não tem leadgen_id — não é um lead de formulário, é um contato que
// clicou num anúncio e chegou pelo WhatsApp).
export function RastreamentoConversionButton({ adId, ctwaClid, phone }: Props) {
  const [open, setOpen] = useState(false);
  const [eventName, setEventName] = useState('Lead');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);

  const disabled = !adId && !ctwaClid && !phone;

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await rastreamentosService.sendConversion({
        ad_id: adId || '',
        ctwa_clid: ctwaClid || undefined,
        phone: phone || undefined,
        event_name: eventName,
      });
      setResult(res);
      if (res.success) toast.success('Evento enviado pro Meta.');
    } catch {
      setResult({ success: false, error: 'Falha ao enviar.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setResult(null); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" disabled={disabled} title="Enviar dados de conversão pro Meta">
          <Send className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <p className="text-sm font-medium">Enviar pro Meta (Conversion API)</p>
        <div className="space-y-1">
          <Label className="text-xs">Nome do evento</Label>
          <Select value={eventName} onValueChange={setEventName}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STANDARD_EVENTS.map((ev) => (
                <SelectItem key={ev} value={ev}>
                  {ev}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSend} disabled={sending} className="w-full" size="sm">
          {sending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
          {sending ? 'Enviando...' : 'Enviar'}
        </Button>
        {result && (
          <p className={`text-xs ${result.success ? 'text-emerald-600' : 'text-destructive'}`}>
            {result.success ? 'Enviado com sucesso.' : result.error}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
