import { useEffect, useMemo, useState } from 'react';
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
import { whatsappGroupsService, WhatsappGroup } from '@/services/admin/whatsappGroupsService';

interface Props {
  inboxId: string;
  value: string; // group_jid selecionado
  onSelect: (group: WhatsappGroup) => void;
}

// Lista os grupos reais da inbox (Evolution/Evolution Go) com busca — pedido
// do Marco: "lista grupo e barra de pesquisa pra filtrar". Carrega 1 vez
// quando o inbox muda e filtra em memória (não bate na API por tecla).
export function WhatsappGroupPicker({ inboxId, value, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<WhatsappGroup[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setGroups([]);
    if (!inboxId) return;
    setLoading(true);
    whatsappGroupsService
      .list(inboxId)
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, [inboxId]);

  const selected = useMemo(() => groups.find((g) => g.jid === value), [groups, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" disabled={!inboxId} className="w-full justify-between font-normal">
          <span className="truncate">
            {!inboxId ? 'Escolha o canal primeiro' : selected?.name || value || 'Selecione o grupo...'}
          </span>
          {loading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar grupo..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{loading ? 'Carregando...' : 'Nenhum grupo encontrado.'}</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {filtered.map((g) => (
                <CommandItem
                  key={g.jid}
                  value={g.jid}
                  onSelect={() => {
                    onSelect(g);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {g.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
