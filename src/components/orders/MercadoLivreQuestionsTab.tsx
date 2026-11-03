import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { Button, Textarea } from '@evoapi/design-system';
import { mercadoLivreService, type MercadoLivreQuestion } from '@/services/orders/mercadoLivreService';

const formatDate = (iso: string) => new Date(iso).toLocaleString('pt-BR');

// Perguntas feitas nos anúncios (Q&A) — ver MercadoLivre::Client#questions,
// testado contra a conta real (0 pendentes, resposta real da API). Só
// pendentes (UNANSWERED) por padrão, pra não misturar com o histórico de
// já respondidas.
export function MercadoLivreQuestionsTab() {
  const [questions, setQuestions] = useState<MercadoLivreQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [sendingId, setSendingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    mercadoLivreService
      .getQuestions('UNANSWERED')
      .then(({ questions: q }) => setQuestions(q))
      .catch(() => toast.error('Erro ao carregar as perguntas do Mercado Livre.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAnswer = async (questionId: number) => {
    const text = (drafts[questionId] || '').trim();
    if (!text) return;
    setSendingId(questionId);
    try {
      await mercadoLivreService.answerQuestion(questionId, text);
      toast.success('Resposta enviada.');
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    } catch {
      toast.error('Erro ao enviar a resposta. Tente novamente.');
    } finally {
      setSendingId(null);
    }
  };

  if (loading) return <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>;

  if (questions.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-10 border border-dashed rounded-md">
        Nenhuma pergunta pendente — tudo respondido.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {questions.map((q) => (
        <div key={q.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground font-mono">Anúncio {q.item_id}</p>
            <span className="text-xs text-muted-foreground">{formatDate(q.date_created)}</span>
          </div>
          <p className="text-sm">{q.text}</p>
          <div className="flex items-end gap-2">
            <Textarea
              value={drafts[q.id] || ''}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDrafts((prev) => ({ ...prev, [q.id]: e.target.value.slice(0, 2000) }))}
              placeholder="Escreva a resposta..."
              className="min-h-[50px] text-sm"
            />
            <Button size="sm" onClick={() => handleAnswer(q.id)} disabled={sendingId === q.id || !(drafts[q.id] || '').trim()}>
              {sendingId === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
