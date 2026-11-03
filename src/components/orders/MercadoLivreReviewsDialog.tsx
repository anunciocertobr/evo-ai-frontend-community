import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@evoapi/design-system';
import { mercadoLivreService, type MercadoLivreReview } from '@/services/orders/mercadoLivreService';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string | null;
  itemTitle?: string | null;
}

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

// Só LEITURA — a API do Mercado Livre (diferente da do iFood) não deixa o
// vendedor responder avaliação, só consultar (ver MercadoLivre::Client#reviews).
export function MercadoLivreReviewsDialog({ open, onOpenChange, itemId, itemTitle }: Props) {
  const [reviews, setReviews] = useState<MercadoLivreReview[]>([]);
  const [ratingAverage, setRatingAverage] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !itemId) return;
    setLoading(true);
    mercadoLivreService
      .getReviews(itemId)
      .then(({ reviews: r, rating_average }) => {
        setReviews(r);
        setRatingAverage(rating_average);
      })
      .catch(() => toast.error('Erro ao carregar as avaliações desse anúncio.'))
      .finally(() => setLoading(false));
  }, [open, itemId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Avaliações {itemTitle ? `— ${itemTitle}` : ''}</DialogTitle>
          <DialogDescription>
            {ratingAverage != null ? `Nota média: ${ratingAverage.toFixed(1)} / 5` : 'O Mercado Livre não permite responder avaliações, só consultar.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Nenhuma avaliação recebida ainda.</p>
        ) : (
          <div className="overflow-y-auto space-y-3 pr-1">
            {reviews.map((r) => (
              <div key={r.id} className="border border-border rounded-md p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < r.rate ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(r.date_created)}</span>
                </div>
                {r.title && <p className="text-sm font-medium">{r.title}</p>}
                {r.content && <p className="text-sm text-muted-foreground">{r.content}</p>}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
