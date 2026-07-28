import { ReactNode } from 'react';
import { Card } from '@evoapi/design-system';
import BrandIcon, { getBrandIcon } from '@/components/BrandIcon';

interface CompactIntegrationCardProps {
  id: string;
  name: string;
  description: string;
  action: ReactNode;
}

/**
 * Card compacto horizontal (logo · nome/descrição · botão de estado) usado pelos
 * blocos de Integrações e Servidores MCP dentro do detalhe do agente.
 */
export function CompactIntegrationCard({
  id,
  name,
  description,
  action,
}: CompactIntegrationCardProps) {
  const hasBrandIcon = Boolean(getBrandIcon(id));

  return (
    <Card className="flex flex-col items-start gap-4 p-4 transition-colors hover:border-primary/50 md:flex-row md:items-center">
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-muted/50 p-2">
        {hasBrandIcon ? <BrandIcon id={id} size={32} className="h-8 w-8" /> : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="w-full flex-shrink-0 md:w-auto">{action}</div>
    </Card>
  );
}
