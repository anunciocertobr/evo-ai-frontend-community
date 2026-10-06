import { createContext, useContext } from 'react';

// BM e conta de anúncio escolhidas na Criação Meta. Ficam no pai (a página) e
// não dentro de cada aba: o Radix desmonta a aba inativa, então o estado local
// se perdia ao trocar entre Públicos, Direcionamento e Grupos de Locais.
export interface MetaScopeEntity {
  id: string;
  name: string;
}

export interface MetaAdAccountScope {
  account: MetaScopeEntity | null;
  setAccount: (account: MetaScopeEntity | null) => void;
  bm: MetaScopeEntity | null;
  setBm: (bm: MetaScopeEntity | null) => void;
  pickerKey: number;
  resetPicker: () => void;
}

export const MetaAdAccountScopeContext = createContext<MetaAdAccountScope | null>(null);

export function useMetaAdAccountScope(): MetaAdAccountScope {
  const scope = useContext(MetaAdAccountScopeContext);
  if (!scope) throw new Error('useMetaAdAccountScope precisa de MetaAdAccountScopeProvider');
  return scope;
}
