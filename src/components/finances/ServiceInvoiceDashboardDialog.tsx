import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Label,
  Input,
} from '@evoapi/design-system';
import { DollarSign, Receipt, FileText, Loader2 } from 'lucide-react';
import BaseStatsGrid from '@/components/base/BaseStatsGrid';
import BarChartCard from '@/components/charts/BarChartCard';
import { serviceInvoicesService } from '@/services/finances/serviceInvoicesService';
import type { ServiceInvoice } from '@/types/fiscalInvoices';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PeriodKey = 'semana' | 'mes' | 'trimestre' | 'semestre' | 'personalizado';

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mês' },
  { key: 'trimestre', label: 'Trimestre' },
  { key: 'semestre', label: 'Semestre' },
  { key: 'personalizado', label: 'Personalizado' },
];

const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const pad2 = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Mesma convenção já usada em FinancesPage (Semana/Mês = calendário em
// curso até hoje, não "últimos N dias") — Trimestre/Semestre seguem o
// mesmo padrão: bloco de 3/6 meses do calendário em curso.
function periodRange(key: PeriodKey): { from: string; to: string } {
  const now = new Date();
  const today = pad2(now);
  if (key === 'semana') {
    const monday = (now.getDay() + 6) % 7;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - monday);
    return { from: pad2(weekStart), to: today };
  }
  if (key === 'mes') {
    return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: today };
  }
  if (key === 'trimestre') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return { from: `${now.getFullYear()}-${String(quarterStartMonth + 1).padStart(2, '0')}-01`, to: today };
  }
  if (key === 'semestre') {
    const semesterStartMonth = now.getMonth() < 6 ? 0 : 6;
    return { from: `${now.getFullYear()}-${String(semesterStartMonth + 1).padStart(2, '0')}-01`, to: today };
  }
  return { from: '', to: '' };
}

type Granularity = 'day' | 'week' | 'month';

function granularityFor(from: string, to: string): Granularity {
  if (!from || !to) return 'day';
  const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000));
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

function bucketKey(dateIso: string, granularity: Granularity): string {
  const d = new Date(dateIso);
  if (granularity === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (granularity === 'week') {
    const firstJan = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d.getTime() - firstJan.getTime()) / 86400000);
    const week = Math.floor(days / 7) + 1;
    return `${d.getFullYear()}-S${String(week).padStart(2, '0')}`;
  }
  return pad2(d);
}

function bucketLabel(key: string, granularity: Granularity): string {
  if (granularity === 'month') {
    const [y, m] = key.split('-');
    return `${MONTH_LABELS[Number(m) - 1]}/${y.slice(2)}`;
  }
  if (granularity === 'week') {
    const [, week] = key.split('-');
    return `Sem ${week.replace('S', '')}`;
  }
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
}

// Diálogo autônomo (busca própria, não interfere na tabela principal da
// página) — filtros de texto com debounce de 400ms, preset de período
// aplica na hora. Só considera notas "authorized" pros gráficos/totais:
// são as únicas com valor confirmado de verdade pela prefeitura.
export function ServiceInvoiceDashboardDialog({ open, onOpenChange }: Props) {
  const [periodKey, setPeriodKey] = useState<PeriodKey>('mes');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [tomadorNome, setTomadorNome] = useState('');
  const [tomadorCnpj, setTomadorCnpj] = useState('');
  const [discriminacao, setDiscriminacao] = useState('');
  const [rawInvoices, setRawInvoices] = useState<ServiceInvoice[]>([]);
  const [loading, setLoading] = useState(false);

  const { from, to } = periodKey === 'personalizado' ? { from: customFrom, to: customTo } : periodRange(periodKey);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setLoading(true);
      serviceInvoicesService
        .list({
          tomador_nome: tomadorNome || undefined,
          tomador_cpf_cnpj: tomadorCnpj || undefined,
          discriminacao: discriminacao || undefined,
          date_from: from || undefined,
          date_to: to || undefined,
        })
        .then(setRawInvoices)
        .catch(() => toast.error('Erro ao carregar dados do dashboard.'))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, periodKey, customFrom, customTo, tomadorNome, tomadorCnpj, discriminacao]);

  const authorized = useMemo(() => rawInvoices.filter((i) => i.status === 'authorized'), [rawInvoices]);

  const totals = useMemo(() => {
    const valorEmitido = authorized.reduce((sum, i) => sum + Number(i.valor_servicos || 0), 0);
    const valorIss = authorized.reduce((sum, i) => sum + Number(i.valor_iss || 0), 0);
    return { valorEmitido, valorIss, count: authorized.length };
  }, [authorized]);

  const granularity = useMemo(() => granularityFor(from, to), [from, to]);

  const { emitidoData, issData } = useMemo(() => {
    const buckets = new Map<string, { emitido: number; iss: number }>();
    authorized.forEach((inv) => {
      const key = bucketKey(inv.created_at, granularity);
      const current = buckets.get(key) || { emitido: 0, iss: 0 };
      current.emitido += Number(inv.valor_servicos || 0);
      current.iss += Number(inv.valor_iss || 0);
      buckets.set(key, current);
    });
    const sortedKeys = Array.from(buckets.keys()).sort();
    return {
      emitidoData: sortedKeys.map((k) => ({ name: bucketLabel(k, granularity), value: buckets.get(k)!.emitido })),
      issData: sortedKeys.map((k) => ({ name: bucketLabel(k, granularity), value: buckets.get(k)!.iss })),
    };
  }, [authorized, granularity]);

  const currency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dashboard — Nota Fiscal de Serviço</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {PERIOD_OPTIONS.map((opt) => (
              <Button
                key={opt.key}
                size="sm"
                variant={periodKey === opt.key ? 'default' : 'outline'}
                onClick={() => setPeriodKey(opt.key)}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {periodKey === 'personalizado' && (
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              <div>
                <Label className="text-xs">De</Label>
                <Input type="date" value={customFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input type="date" value={customTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Tomador (nome)</Label>
              <Input value={tomadorNome} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTomadorNome(e.target.value)} placeholder="Buscar por nome..." />
            </div>
            <div>
              <Label className="text-xs">CPF/CNPJ do tomador</Label>
              <Input value={tomadorCnpj} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTomadorCnpj(e.target.value)} placeholder="Buscar por CPF/CNPJ..." />
            </div>
            <div>
              <Label className="text-xs">Discriminação do serviço</Label>
              <Input value={discriminacao} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDiscriminacao(e.target.value)} placeholder="Buscar na descrição..." />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
            </div>
          ) : (
            <>
              <BaseStatsGrid
                columns={3}
                cards={[
                  { title: 'Valor emitido no período', value: totals.valorEmitido, icon: DollarSign, color: 'green', valueFormat: 'currency' },
                  { title: 'ISS calculado no período', value: totals.valorIss, icon: Receipt, color: 'orange', valueFormat: 'currency' },
                  { title: 'Notas autorizadas', value: totals.count, icon: FileText, color: 'blue' },
                ]}
              />

              {authorized.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-12 border border-dashed rounded-lg">
                  Nenhuma nota autorizada encontrada pra esses filtros/período.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <BarChartCard
                    title="Valor emitido"
                    data={emitidoData}
                    color="#22c55e"
                    gradientFrom="#22c55e"
                    gradientTo="#16a34a"
                    valueFormatter={currency}
                  />
                  <BarChartCard
                    title="ISS calculado"
                    data={issData}
                    color="#f97316"
                    gradientFrom="#f97316"
                    gradientTo="#ea580c"
                    valueFormatter={currency}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
