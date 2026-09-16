import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Checkbox,
} from '@evoapi/design-system';
import { Search } from 'lucide-react';
import { contactsService } from '@/services/contacts/contactsService';
import { metaCreationService } from '@/services/marketing/metaCreationService';
import type { Contact } from '@/types/contacts/contact';

interface AudienceContactsPickerDialogProps {
  audienceId: string | null;
  audienceName: string;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/** Segundo passo do público "Lista de clientes": busca contatos do CRM e envia (com hash) pra Meta. */
export function AudienceContactsPickerDialog({
  audienceId,
  audienceName,
  onOpenChange,
  onDone,
}: AudienceContactsPickerDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Map<string, Contact>>(new Map());
  const [sending, setSending] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const response = await contactsService.searchContacts({ q: query.trim(), per_page: 50 });
      setResults(response.data.filter((c) => c.email || c.phone_number));
    } catch {
      toast.error('Erro ao buscar contatos');
    } finally {
      setSearching(false);
    }
  };

  const toggle = (contact: Contact) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(contact.id)) next.delete(contact.id);
      else next.set(contact.id, contact);
      return next;
    });
  };

  const selectAllResults = () => {
    setSelected((prev) => {
      const next = new Map(prev);
      results.forEach((c) => next.set(c.id, c));
      return next;
    });
  };

  const handleSend = async () => {
    if (!audienceId || selected.size === 0) return;
    setSending(true);
    try {
      const result = await metaCreationService.addContactsToAudience(audienceId, Array.from(selected.keys()));
      toast.success(`${result.uploaded} contato(s) enviados para o público na Meta!`);
      onDone();
    } catch {
      toast.error('Erro ao enviar os contatos para a Meta');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={Boolean(audienceId)} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar contatos a "{audienceName}"</DialogTitle>
          <DialogDescription>
            Busque contatos do CRM pra incluir neste público. Email e telefone saem só como hash —
            nenhum dado em claro é enviado pra Meta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar por nome, email ou telefone..."
          />
          <Button variant="outline" onClick={handleSearch} disabled={searching}>
            <Search className="w-4 h-4" />
          </Button>
        </div>

        {results.length > 0 && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={selectAllResults}>
              Selecionar todos os resultados
            </Button>
          </div>
        )}

        <div className="max-h-72 overflow-y-auto border rounded-md divide-y">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {searching ? 'Buscando...' : 'Nenhum resultado ainda — busque acima.'}
            </p>
          ) : (
            results.map((contact) => (
              <label key={contact.id} className="flex items-center gap-2 p-2 text-sm hover:bg-muted/40 cursor-pointer">
                <Checkbox checked={selected.has(contact.id)} onCheckedChange={() => toggle(contact)} />
                <div className="min-w-0">
                  <p className="font-medium truncate">{contact.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[contact.email, contact.phone_number].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </label>
            ))
          )}
        </div>

        <p className="text-xs text-muted-foreground">{selected.size} contato(s) selecionado(s)</p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Fechar
          </Button>
          <Button onClick={handleSend} disabled={sending || selected.size === 0}>
            {sending ? 'Enviando...' : `Enviar ${selected.size || ''} para a Meta`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
