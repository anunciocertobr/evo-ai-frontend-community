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
import { Search } from 'lucide-react';
import { SERVICOS_LC116 } from '@/data/servicosLC116';

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// Botão de busca por descrição do serviço na Lista LC 116/2003 — referência
// nacional que a maioria dos municípios usa como base, mas alguns adaptam a
// própria tabela. Fica ao lado do campo de código, que continua editável na
// mão pra corrigir se a prefeitura do tomador usar um código diferente.
export function ServicoLC116SearchButton({ onSelect }: { onSelect: (servico: { codigo: string; descricao: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (q.length < 2) return [];
    return SERVICOS_LC116.filter((s) => normalize(s.descricao).includes(q) || s.codigo.startsWith(q)).slice(0, 30);
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" title="Buscar por tipo de serviço" className="shrink-0">
          <Search className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Digite o tipo de serviço (ex: consultoria, desenvolvimento)..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {query.trim().length < 2 ? 'Digite ao menos 2 letras.' : 'Nenhum serviço encontrado — digite o código manualmente.'}
            </CommandEmpty>
            <CommandGroup className="max-h-72 overflow-auto">
              {results.map((s) => (
                <CommandItem
                  key={s.codigo}
                  value={s.codigo}
                  onSelect={() => {
                    onSelect(s);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <span className="truncate">
                    <span className="font-medium">{s.codigo}</span> — {s.descricao}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
