import { useEffect, useMemo, useState } from 'react';
import { Input, Badge } from '@evoapi/design-system';
import { Building2, ChevronLeft, Loader2, Search } from 'lucide-react';
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

// Mesmo fluxo BM > [Conta/Página] do Painel Tráfego (grade de cards com
// busca, não uma lista/dropdown) — só depois de escolher os dois é que a
// aba (Formulários/Públicos/Direcionamento) aparece.
export function MetaScopedEntityPicker({ stepTwoLabel, fetchStepTwo, onSelect }: MetaScopedEntityPickerProps) {
  const [bms, setBms] = useState<Entity[] | null>(null);
  const [loadingBms, setLoadingBms] = useState(false);
  const [bmQuery, setBmQuery] = useState('');

  const [selectedBm, setSelectedBm] = useState<Entity | null>(null);
  const [items, setItems] = useState<Entity[] | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemQuery, setItemQuery] = useState('');

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
    setItemQuery('');
    setLoadingItems(true);
    fetchStepTwo(bm.id)
      .then(setItems)
      .catch(() => {
        toast.error(`Não foi possível carregar: ${stepTwoLabel}.`);
        setItems([]);
      })
      .finally(() => setLoadingItems(false));
  };

  const filteredBms = useMemo(
    () => (bms || []).filter((bm) => bm.name.toLowerCase().includes(bmQuery.trim().toLowerCase())),
    [bms, bmQuery],
  );
  const filteredItems = useMemo(
    () => (items || []).filter((item) => item.name.toLowerCase().includes(itemQuery.trim().toLowerCase())),
    [items, itemQuery],
  );

  if (!selectedBm) {
    return (
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={bmQuery}
            onChange={(e) => setBmQuery(e.target.value)}
            placeholder="Buscar Business Manager..."
            className="pl-8"
          />
        </div>

        {loadingBms ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : filteredBms.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-10 border border-dashed rounded-md">
            Nenhuma Business Manager encontrada.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {filteredBms.map((bm) => (
              <button
                key={bm.id}
                type="button"
                onClick={() => selectBm(bm)}
                className="text-left rounded-lg border border-border bg-card p-4 space-y-1 hover:border-primary/50 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary shrink-0" />
                  <h4 className="text-sm font-semibold truncate" title={bm.name}>
                    {bm.name}
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">Toque para ver as contas</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedBm(null)}
          className="flex items-center justify-center h-7 w-7 rounded-md border border-border hover:bg-muted/40 transition-colors shrink-0"
          title="Voltar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <Badge variant="outline" className="gap-1.5">
          <Building2 className="w-3.5 h-3.5" /> {selectedBm.name}
        </Badge>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={itemQuery}
          onChange={(e) => setItemQuery(e.target.value)}
          placeholder={`Buscar ${stepTwoLabel.toLowerCase()}...`}
          className="pl-8"
        />
      </div>

      {loadingItems ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-10 border border-dashed rounded-md">
          Nada encontrado nessa Business Manager.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className="text-left rounded-lg border border-border bg-card p-4 space-y-1 hover:border-primary/50 hover:bg-muted/40 transition-colors"
            >
              <h4 className="text-sm font-semibold truncate" title={item.name}>
                {item.name}
              </h4>
              <p className="text-xs text-muted-foreground">Toque para selecionar</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
