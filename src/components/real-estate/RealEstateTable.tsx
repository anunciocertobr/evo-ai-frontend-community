import { Button, Badge } from '@evoapi/design-system';
import { Pencil, Trash2, Home } from 'lucide-react';
import type { Product } from '@/types/products';

const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const resolveMediaUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('//') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
};

interface Props {
  items: Product[];
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (item: Product) => void;
  onDelete: (item: Product) => void;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  inactive: 'secondary',
  draft: 'outline',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  draft: 'Rascunho',
};

function formatPrice(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export default function RealEstateTable({ items, canUpdate, canDelete, onEdit, onDelete }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-10 border border-dashed rounded-md">
        Nenhum imóvel cadastrado ainda.
      </div>
    );
  }

  return (
    <div className="border rounded-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="px-3 py-2 w-10"></th>
            <th className="px-3 py-2">Nome</th>
            <th className="px-3 py-2">Cidade / Bairro</th>
            <th className="px-3 py-2">Valor</th>
            <th className="px-3 py-2">Quartos</th>
            <th className="px-3 py-2">Banheiros</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const metadata = (item.metadata ?? {}) as Record<string, unknown>;
            const thumb = item.media?.find((m) => m.kind === 'image')?.url ?? null;
            const cidade = typeof metadata.cidade === 'string' ? metadata.cidade : null;
            const bairro = typeof metadata.bairro === 'string' ? metadata.bairro : null;
            const local = [bairro, cidade].filter(Boolean).join(' / ') || '—';

            return (
              <tr key={item.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 w-10">
                  {thumb ? (
                    <img
                      src={resolveMediaUrl(thumb)}
                      alt={item.name}
                      className="h-9 w-9 rounded object-cover border"
                    />
                  ) : (
                    <Home className="h-4 w-4 text-muted-foreground" />
                  )}
                </td>
                <td className="px-3 py-2 font-medium">{item.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{local}</td>
                <td className="px-3 py-2 font-mono text-xs">{formatPrice(item.default_price, item.currency)}</td>
                <td className="px-3 py-2 text-muted-foreground">{(metadata.quartos as number) ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{(metadata.banheiros as number) ?? '—'}</td>
                <td className="px-3 py-2">
                  <Badge variant={STATUS_VARIANT[item.status] ?? 'outline'}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!canUpdate}
                    onClick={() => onEdit(item)}
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!canDelete}
                    onClick={() => onDelete(item)}
                    title="Excluir"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
