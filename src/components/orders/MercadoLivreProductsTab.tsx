import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, Star } from 'lucide-react';
import { Badge, Button } from '@evoapi/design-system';
import { mercadoLivreService, type MercadoLivreProduct } from '@/services/orders/mercadoLivreService';
import { MercadoLivreReviewsDialog } from '@/components/orders/MercadoLivreReviewsDialog';

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

const STATUS_LABEL: Record<string, string> = { active: 'Ativo', paused: 'Pausado', closed: 'Encerrado', under_review: 'Em revisão' };
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  paused: 'secondary',
  closed: 'destructive',
  under_review: 'outline',
};

// Anúncios JÁ PUBLICADOS na loja — ver MercadoLivre::Client#my_items,
// testado contra a conta real (2 anúncios reais). "Ver avaliações" abre o
// mesmo diálogo por item_id (as avaliações do ML são por anúncio, não
// agregadas por vendedor).
export function MercadoLivreProductsTab() {
  const [products, setProducts] = useState<MercadoLivreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewsItem, setReviewsItem] = useState<MercadoLivreProduct | null>(null);

  useEffect(() => {
    mercadoLivreService
      .getProducts()
      .then(setProducts)
      .catch(() => toast.error('Erro ao carregar os anúncios do Mercado Livre.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>;

  if (products.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-10 border border-dashed rounded-md">
        Nenhum anúncio publicado ainda.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {products.map((p) => (
          <div key={p.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="flex items-start gap-3">
              {p.thumbnail && <img src={p.thumbnail} alt={p.title} className="w-14 h-14 rounded object-cover border border-border shrink-0" />}
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold line-clamp-2" title={p.title}>
                  {p.title}
                </h4>
                <p className="text-xs text-muted-foreground font-mono">{p.id}</p>
              </div>
              <Badge variant={STATUS_VARIANT[p.status] || 'outline'} className="shrink-0">
                {STATUS_LABEL[p.status] || p.status}
              </Badge>
            </div>
            <p className="text-sm font-semibold">{formatCurrency(p.price)}</p>
            <p className="text-xs text-muted-foreground">
              {p.available_quantity} disponível(is) · {p.sold_quantity} vendido(s)
            </p>
            <div className="flex items-center gap-1.5 pt-1">
              <Button size="sm" variant="outline" className="flex-1 min-w-0" onClick={() => setReviewsItem(p)}>
                <Star className="w-3.5 h-3.5 mr-1 shrink-0" />
                <span className="truncate">Ver avaliações</span>
              </Button>
              {p.permalink && (
                <Button size="sm" variant="outline" className="shrink-0 px-2" asChild>
                  <a href={p.permalink} target="_blank" rel="noopener noreferrer" title="Ver no Mercado Livre">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <MercadoLivreReviewsDialog
        open={Boolean(reviewsItem)}
        onOpenChange={(o) => !o && setReviewsItem(null)}
        itemId={reviewsItem?.id || null}
        itemTitle={reviewsItem?.title}
      />
    </>
  );
}
