import { useMemo, useState } from 'react';
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
import { ChevronsUpDown, Check } from 'lucide-react';
import type { FiscalTomador } from '@/types/fiscalInvoices';
import { cn } from '@/lib/utils';

interface Props {
  tomadores: FiscalTomador[];
  value: string;
  onSelect: (id: string) => void;
}

// Combobox com busca (nome ou CPF/CNPJ) pro Select de "Tomador salvo" — o
// <Select> puro (sem campo de busca) ficava impraticável de achar um
// cliente específico conforme a lista de tomadores salvos crescia, mesmo
// padrão Popover+Command já usado em MunicipioAutocomplete/ContactPicker.
export function TomadorPicker({ tomadores, value, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = tomadores.find((t) => t.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tomadores;
    return tomadores.filter((t) => t.nome.toLowerCase().includes(q) || t.cpf_cnpj.includes(q));
  }, [tomadores, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected ? `${selected.nome} — ${selected.cpf_cnpj}` : tomadores.length ? 'Escolha pra preencher automaticamente' : 'Nenhum tomador salvo ainda'}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar por nome ou CPF/CNPJ..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Nenhum tomador encontrado.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {filtered.map((t) => (
                <CommandItem
                  key={t.id}
                  value={t.id}
                  onSelect={() => {
                    onSelect(t.id);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === t.id ? 'opacity-100' : 'opacity-0')} />
                  {t.nome} — {t.cpf_cnpj}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
