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

interface MetaAdAccountPickerProps {
  onSelect: (account: { id: string; name: string }) => void;
}

// Seletor em duas etapas — Business Manager, depois Conta de Anúncio —
// com busca ao digitar nas duas listas (Command filtra por texto sozinho).
// Existe porque colar o ID da conta de cabeça (ou abrir o Painel Tráfego só
// pra descobrir qual é) é o jeito difícil: aqui é só digitar o nome.
export function MetaAdAccountPicker({ onSelect }: MetaAdAccountPickerProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'bm' | 'account'>('bm');

  const [bms, setBms] = useState<{ id: string; name: string }[] | null>(null);
  const [loadingBms, setLoadingBms] = useState(false);

  const [selectedBm, setSelectedBm] = useState<{ id: string; name: string } | null>(null);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[] | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Busca as BMs só na primeira vez que o popover abre, não a cada render.
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
    setStep('account');
    setAccounts(null);
    setLoadingAccounts(true);
    clientGoalsService
      .listAdAccountsForBm(bm.id)
      .then(setAccounts)
      .catch(() => {
        toast.error('Não foi possível carregar as contas dessa Business Manager.');
        setAccounts([]);
      })
      .finally(() => setLoadingAccounts(false));
  };

  const selectAccount = (account: { id: string; name: string }) => {
    onSelect(account);
    setOpen(false);
    // Reseta pra próxima vez que abrir — cada conta pode ficar em BMs diferentes.
    setStep('bm');
    setSelectedBm(null);
    setAccounts(null);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setStep('bm');
          setSelectedBm(null);
          setAccounts(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button size="icon" variant="outline" title="Selecionar conta (Business Manager > Conta)">
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
            <CommandInput placeholder="Buscar conta de anúncio..." />
            {loadingAccounts ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <>
                <CommandEmpty>Nenhuma conta encontrada nessa BM.</CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {(accounts || []).map((acc) => (
                    <CommandItem key={acc.id} value={acc.name} onSelect={() => selectAccount(acc)}>
                      {acc.name}
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
