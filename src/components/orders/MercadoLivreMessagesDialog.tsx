import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Textarea } from '@evoapi/design-system';
import { mercadoLivreService, type MercadoLivreMessage } from '@/services/orders/mercadoLivreService';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
  orderLabel?: string | null;
  sellerUserId?: number | null;
}

const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR') : '');

// Chat pós-venda por pedido — pack_id vem do pedido no backend (ver
// MercadoLivreController#pack_id_for). Texto limitado a 350 caracteres
// pela própria API do ML (ISO-8859-1 + emoticons); deixa a API recusar
// em vez de validar aqui.
export function MercadoLivreMessagesDialog({ open, onOpenChange, orderId, orderLabel, sellerUserId }: Props) {
  const [messages, setMessages] = useState<MercadoLivreMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = () => {
    if (!orderId) return;
    setLoading(true);
    mercadoLivreService
      .getMessages(orderId)
      .then(({ results }) => setMessages(results))
      .catch(() => toast.error('Erro ao carregar as mensagens desse pedido.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  const handleSend = async () => {
    if (!orderId || !text.trim()) return;
    setSending(true);
    try {
      await mercadoLivreService.sendMessage(orderId, text.trim());
      setText('');
      load();
    } catch {
      toast.error('Erro ao enviar a mensagem.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Mensagens {orderLabel ? `— pedido ${orderLabel}` : ''}</DialogTitle>
          <DialogDescription>Conversa com o comprador sobre este pedido.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-2 pr-1 min-h-[150px]">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Nenhuma mensagem ainda.</p>
            ) : (
              messages.map((m) => {
                const fromSeller = sellerUserId != null && m.from?.user_id === sellerUserId;
                return (
                  <div key={m.id} className={`flex ${fromSeller ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${fromSeller ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <p>{m.text}</p>
                      <p className="text-[10px] opacity-70 mt-1">{formatDate(m.message_date?.created)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="flex items-end gap-2 pt-2 border-t border-border">
          <Textarea
            value={text}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value.slice(0, 350))}
            placeholder="Escreva uma mensagem (até 350 caracteres)..."
            className="min-h-[60px] text-sm"
          />
          <Button size="sm" onClick={handleSend} disabled={sending || !text.trim()}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
