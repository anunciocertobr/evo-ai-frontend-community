import type { ReactNode } from 'react';
import { MetaAdAccountScopeContext, type MetaAdAccountScope } from '@/components/marketing/metaAdAccountScope';

export function MetaAdAccountScopeProvider({ value, children }: { value: MetaAdAccountScope; children: ReactNode }) {
  return <MetaAdAccountScopeContext.Provider value={value}>{children}</MetaAdAccountScopeContext.Provider>;
}
