import { useEffect, useRef, useState } from 'react';
import { ChevronsUpDown, Loader2 } from 'lucide-react';
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@evoapi/design-system';
import { contactsService } from '@/services/contacts/contactsService';
import type { Contact } from '@/types/contacts';

interface Props {
  value: string; // telefone do contato selecionado
  selectedName?: string;
  onSelect: (contact: Contact) => void;
}

const DEBOUNCE_MS = 300;

// Busca contatos já cadastrados no CRM pra usar como destino (ex.: enviar
// NFS-e/relatório por WhatsApp pra um contato existente em vez de digitar o
// número). Diferente do WhatsappGroupPicker (que carrega todos os grupos de
// uma inbox de uma vez — lista pequena), a base de contatos pode ser grande,
// então busca via API com debounce a cada digitação (GET /contacts/search),
// não filtro em memória. Só mostra contatos com telefone cadastrado — sem
// isso não dá pra mandar WhatsApp.
export function ContactPicker({ value, selectedName, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setContacts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      contactsService
        .searchContacts({ q, per_page: 30 })
        .then((res) => setContacts((res.data ?? []).filter((c) => c.phone_number)))
        .catch(() => setContacts([]))
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">{selectedName || value || 'Buscar contato...'}</span>
          {loading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Nome ou telefone..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Buscando...' : query ? 'Nenhum contato com telefone encontrado.' : 'Digite pra buscar.'}
            </CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {contacts.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => {
                    onSelect(c);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{c.phone_number}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
