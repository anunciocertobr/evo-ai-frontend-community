import { useEffect, useMemo, useRef, useState } from 'react';
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
  /** BM selecionada, controlado pelo pai. `null` volta pra seleção de BM;
   *  omitido (undefined) o picker guarda a BM internamente, como antes. Com
   *  isso o pai consegue desenhar o breadcrumb (BM / Conta) e mandar o picker
   *  de volta pra um dos dois passos. */
  selectedBm?: Entity | null;
  onSelectBm?: (bm: Entity | null) => void;
  /** Incremente a cada volta pra lista de contas/páginas (o pai clica no
   *  breadcrumb e bumps isto) — como o id da BM não muda, é o que dispara a
   *  nova busca do passo 2. */
  resetKey?: number;
  /** Dentro de modal estreito o grid de 4 colunas fica espremido e o nome do
   *  card aparece cortado. Em compact o grid é estreito e o nome quebra em
   *  várias linhas, mostrando o nome inteiro. */
  compact?: boolean;
}

// Mesmo fluxo BM > [Conta/Página] do Painel Tráfego (grade de cards com
// busca, não uma lista/dropdown) — só depois de escolher os dois é que a
// aba (Formulários/Públicos/Direcionamento) aparece.
export function MetaScopedEntityPicker({
  stepTwoLabel,
  fetchStepTwo,
  onSelect,
  selectedBm,
  onSelectBm,
  resetKey,
  compact,
}: MetaScopedEntityPickerProps) {
  const [bms, setBms] = useState<Entity[] | null>(null);
  const [loadingBms, setLoadingBms] = useState(false);
  const [bmQuery, setBmQuery] = useState('');

  const [internalBm, setInternalBm] = useState<Entity | null>(null);
  const [items, setItems] = useState<Entity[] | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemQuery, setItemQuery] = useState('');

  const isControlled = selectedBm !== undefined;
  const activeBm = isControlled ? (selectedBm ?? null) : internalBm;

  // Os chamadores passam fetchStepTwo como arrow function inline (identidade
  // nova a cada render), então ele fica num ref: se fosse dependência do
  // efeito, a busca de contas dispararia a cada render do pai.
  const fetchStepTwoRef = useRef(fetchStepTwo);
  fetchStepTwoRef.current = fetchStepTwo;

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

  // Carrega o passo 2 sempre que a BM muda (ou quando o pai pede pra voltar
  // pra lista de contas via resetKey, com a mesma BM).
  useEffect(() => {
    if (!activeBm) return;
    setItems(null);
    setItemQuery('');
    setLoadingItems(true);
    fetchStepTwoRef
      .current(activeBm.id)
      .then(setItems)
      .catch(() => {
        toast.error(`Não foi possível carregar: ${stepTwoLabel}.`);
        setItems([]);
      })
      .finally(() => setLoadingItems(false));
    // stepTwoLabel é constante na prática (vem de prop literal dos chamadores).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBm?.id, resetKey]);

  const selectBm = (bm: Entity) => {
    if (!isControlled) setInternalBm(bm);
    onSelectBm?.(bm);
  };

  const backToBmList = () => {
    if (!isControlled) setInternalBm(null);
    onSelectBm?.(null);
  };

  const filteredBms = useMemo(
    () => (bms || []).filter((bm) => bm.name.toLowerCase().includes(bmQuery.trim().toLowerCase())),
    [bms, bmQuery],
  );
  const filteredItems = useMemo(
    () => (items || []).filter((item) => item.name.toLowerCase().includes(itemQuery.trim().toLowerCase())),
    [items, itemQuery],
  );

  const gridClass = compact
    ? 'grid grid-cols-1 lg:grid-cols-2 gap-3'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3';
  // No modo compacto o nome precisa aparecer inteiro (quebra de linha); na
  // grade larga do seletor principal, no máximo 2 linhas pra não estourar o
  // card — nos dois casos o title mantém o nome completo no hover.
  const nameClass = compact ? 'text-sm font-semibold break-words' : 'text-sm font-semibold break-words line-clamp-2';

  if (!activeBm) {
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
          <div className={gridClass}>
            {filteredBms.map((bm) => (
              <button
                key={bm.id}
                type="button"
                onClick={() => selectBm(bm)}
                className="text-left rounded-lg border border-border bg-card p-4 space-y-1 hover:border-primary/50 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <h4 className={nameClass} title={bm.name}>
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
          onClick={backToBmList}
          className="flex items-center justify-center h-7 w-7 rounded-md border border-border hover:bg-muted/40 transition-colors shrink-0"
          title="Voltar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <Badge variant="outline" className="gap-1.5 min-w-0">
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span className={compact ? 'break-words' : 'truncate'} title={activeBm.name}>
            {activeBm.name}
          </span>
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
        <div className={gridClass}>
          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className="text-left rounded-lg border border-border bg-card p-4 space-y-1 hover:border-primary/50 hover:bg-muted/40 transition-colors"
            >
              <h4 className={nameClass} title={item.name}>
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
