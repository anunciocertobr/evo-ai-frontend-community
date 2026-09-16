import { useEffect, useState } from 'react';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@evoapi/design-system';
import { Building2, ChevronLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { clientGoalsService } from '@/services/marketing/clientGoalsService';
import { metaCreationService } from '@/services/marketing/metaCreationService';

interface MetaPagePickerProps {
  onSelect: (page: { id: string; name: string }) => void;
}

// Mesmo padrão de duas etapas do MetaAdAccountPicker, só que BM > Página em
// vez de BM > Conta de anúncio — formulário de lead pertence à Página, não
// à conta de anúncio, e cada BM pode enxergar uma Página diferente (cada
// cliente da agência tem a própria).
export function MetaPagePicker({ onSelect }: MetaPagePickerProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'bm' | 'page'>('bm');

  const [bms, setBms] = useState<{ id: string; name: string }[] | null>(null);
  const [loadingBms, setLoadingBms] = useState(false);

  const [selectedBm, setSelectedBm] = useState<{ id: string; name: string } | null>(null);
  const [pages, setPages] = useState<{ id: string; name: string }[] | null>(null);
  const [loadingPages, setLoadingPages] = useState(false);

  useEffect(() => {
    if (!open || bms !== null || loadingBms) return;
    setLoadingBms(true);
    clientGoalsService
      .listBusinessManagers()
      .then(setBms)
      .catch(() => {
        toast.error('Não foi possível carregar as Business Managers.');
        setBms([]);
      })
      .finally(() => setLoadingBms(false));
  }, [open, bms, loadingBms]);

  const selectBm = (bm: { id: string; name: string }) => {
    setSelectedBm(bm);
    setStep('page');
    setPages(null);
    setLoadingPages(true);
    metaCreationService
      .listPagesForBm(bm.id)
      .then(setPages)
      .catch(() => {
        toast.error('Não foi possível carregar as Páginas dessa Business Manager.');
        setPages([]);
      })
      .finally(() => setLoadingPages(false));
  };

  const selectPage = (page: { id: string; name: string }) => {
    onSelect(page);
    setOpen(false);
    setStep('bm');
    setSelectedBm(null);
    setPages(null);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setStep('bm');
          setSelectedBm(null);
          setPages(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button size="icon" variant="outline" title="Selecionar Página (Business Manager > Página)">
          <Building2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {step === 'bm' ? (
          <Command>
            <CommandInput placeholder="Buscar Business Manager..." />
            {loadingBms ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <>
                <CommandEmpty>Nenhuma Business Manager encontrada.</CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
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
            <div className="flex items-center gap-1 border-b px-2 py-1.5">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setStep('bm')}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="truncate text-xs text-muted-foreground">{selectedBm?.name}</span>
            </div>
            <CommandInput placeholder="Buscar Página..." />
            {loadingPages ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <>
                <CommandEmpty>Nenhuma Página encontrada nessa BM.</CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {(pages || []).map((page) => (
                    <CommandItem key={page.id} value={page.name} onSelect={() => selectPage(page)}>
                      {page.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
