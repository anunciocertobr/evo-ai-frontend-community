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
import municipiosData from '@/data/municipiosIBGE.json';

interface Municipio {
  codigo: string;
  nome: string;
  uf: string;
}

const MUNICIPIOS = municipiosData as Municipio[];
const MAX_RESULTS = 30;

// Busca sem acento/maiúscula pra "sao paulo" achar "São Paulo" — o dataset
// vem direto da API oficial do IBGE (servicodados.ibge.gov.br), então os
// nomes têm acentuação correta que a pessoa buscando nem sempre digita.
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// Botão de busca por nome da cidade que preenche o código IBGE (e a UF)
// automaticamente — fica AO LADO do campo de código, que continua editável
// na mão pra quem já sabe o código ou precisa corrigir algo. Cobre todos os
// ~5570 municípios do Brasil — diferente de SUPPORTED_MUNICIPIOS (só as
// poucas cidades onde o emissor de NFS-e do painel tem integração ativa):
// o tomador (cliente) da nota pode ser de qualquer cidade do país.
export function MunicipioSearchButton({ onSelect }: { onSelect: (municipio: Municipio) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (q.length < 2) return [];
    return MUNICIPIOS.filter((m) => normalize(m.nome).includes(q) || normalize(`${m.nome} ${m.uf}`).includes(q)).slice(
      0,
      MAX_RESULTS,
    );
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" title="Buscar cidade" className="shrink-0">
          <Search className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Digite o nome da cidade..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>
              {query.trim().length < 2 ? 'Digite ao menos 2 letras.' : 'Nenhuma cidade encontrada.'}
            </CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {results.map((m) => (
                <CommandItem
                  key={m.codigo}
                  value={m.codigo}
                  onSelect={() => {
                    onSelect(m);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {m.nome}/{m.uf}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
