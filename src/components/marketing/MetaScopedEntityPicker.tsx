import { useEffect, useState } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, Button } from '@evoapi/design-system';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { clientGoalsService } from '@/services/marketing/clientGoalsService';

interface Entity {
  id: string;
  name: string;
}

interface MetaScopedEntityPickerProps {
  stepTwoLabel: string;
  fetchStepTwo: (businessManagerId: string) => Promise<Entity[]>;
  onSelect: (entity: Entity) => void;
}

// Mesmo fluxo BM > [Conta/Página] do Painel Tráfego, mas mostrado direto na
// tela (com barra de busca em cada etapa) em vez de escondido atrás de um
// botão — só depois de escolher os dois é que a aba (Formulários/Públicos/
// Direcionamento) aparece.
export function MetaScopedEntityPicker({ stepTwoLabel, fetchStepTwo, onSelect }: MetaScopedEntityPickerProps) {
  const [bms, setBms] = useState<Entity[] | null>(null);
  const [loadingBms, setLoadingBms] = useState(false);

  const [selectedBm, setSelectedBm] = useState<Entity | null>(null);
  const [items, setItems] = useState<Entity[] | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    setLoadingBms(true);
    clientGoalsService
      .listBusinessManagers()
      .then(setBms)
      .catch(() => {
        toast.error('Não foi possível carregar as Business Managers.');
        setBms([]);
      })
      .finally(() => setLoadingBms(false));
  }, []);

  const selectBm = (bm: Entity) => {
    setSelectedBm(bm);
    setItems(null);
    setLoadingItems(true);
    fetchStepTwo(bm.id)
      .then(setItems)
      .catch(() => {
        toast.error(`Não foi possível carregar: ${stepTwoLabel}.`);
        setItems([]);
      })
      .finally(() => setLoadingItems(false));
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      {!selectedBm ? (
        <Command>
          <CommandInput placeholder="Buscar Business Manager..." />
          {loadingBms ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <>
              <CommandEmpty>Nenhuma Business Manager encontrada.</CommandEmpty>
              <CommandGroup heading="Business Manager" className="max-h-96 overflow-auto">
                {(bms || []).map((bm) => (
                  <CommandItem key={bm.id} value={bm.name} onSelect={() => selectBm(bm)}>
                    {bm.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </Command>
      ) : (
        <Command>
          <div className="flex items-center gap-1.5 border-b px-2 py-1.5">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSelectedBm(null)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="truncate text-xs text-muted-foreground">{selectedBm.name}</span>
          </div>
          <CommandInput placeholder={`Buscar ${stepTwoLabel.toLowerCase()}...`} />
          {loadingItems ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <>
              <CommandEmpty>Nada encontrado nessa Business Manager.</CommandEmpty>
              <CommandGroup heading={stepTwoLabel} className="max-h-96 overflow-auto">
                {(items || []).map((item) => (
                  <CommandItem key={item.id} value={item.name} onSelect={() => onSelect(item)}>
                    {item.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </Command>
      )}
    </div>
  );
}
