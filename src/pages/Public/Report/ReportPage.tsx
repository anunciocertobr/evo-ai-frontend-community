import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@evoapi/design-system';
import {
  fetchPublicReport,
  type PublicReportPayload,
  type AdsInsightRow,
  type AdsReportData,
} from '@/services/marketing/reportLinksService';
import type { ClientGoal } from '@/services/marketing/clientGoalsService';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'gone'; message: string }
  | { kind: 'ready'; payload: PublicReportPayload };

const RANGE_OPTIONS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
];

/**
 * Relatório público de anúncios. Sem login: quem tem o link vê só as contas
 * que o dono marcou, e a filtragem acontece no servidor (AdsReportsPayload) —
 * esta tela não escolhe conta nenhuma.
 *
 * Não existe token de API no browser aqui, ao contrário da tela interna de
 * Relatórios, que carrega um Personal Access Token dentro do HTML e por isso
 * não pode simplesmente ser transformada em link público.
 */
export default function ReportPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [days, setDays] = useState(30);

  const load = useCallback(
    async (rangeDays: number) => {
      if (!token) return;
      setState({ kind: 'loading' });
      const stop = new Date();
      const start = new Date();
      start.setDate(stop.getDate() - (rangeDays - 1));
      const fmt = (d: Date) => d.toISOString().slice(0, 10);

      try {
        const payload = await fetchPublicReport(token, {
          dateStart: fmt(start),
          dateStop: fmt(stop),
        });
        setState({ kind: 'ready', payload });
      } catch (e) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status === 410) {
          setState({ kind: 'gone', message: 'Este link expirou ou foi revogado.' });
        } else if (status === 404) {
          setState({ kind: 'error', message: 'Link inválido.' });
        } else {
          setState({ kind: 'error', message: 'Não foi possível carregar o relatório.' });
        }
      }
    },
    [token],
  );

  useEffect(() => {
    void load(days);
  }, [load, days]);

  if (state.kind === 'loading') {
    return (
      <Shell title="">
        <p className="p-8 text-center text-muted-foreground">Carregando relatório…</p>
      </Shell>
    );
  }

  if (state.kind !== 'ready') {
    return (
      <Shell title="">
        <p className="p-8 text-center text-muted-foreground">{state.message}</p>
      </Shell>
    );
  }

  const { link, report, goals } = state.payload;
  const isAds = Boolean(report);

  return (
    <Shell title={link.title}>
      <div className="space-y-6 p-4 md:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{link.title}</h1>
            <p className="text-sm text-muted-foreground">
              {report &&
                `${formatBr(report.range.date_start)} a ${formatBr(report.range.date_stop)}`}
              {link.days_left > 0 && ` · válido por mais ${link.days_left} dia(s)`}
            </p>
          </div>
          <div className="flex gap-1">
            {RANGE_OPTIONS.map(o => (
              <button
                key={o.days}
                onClick={() => setDays(o.days)}
                className={
                  days === o.days
                    ? 'rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'
                    : 'rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted'
                }
              >
                {o.label}
              </button>
            ))}
          </div>
        </header>

        {isAds ? <AdsSections report={report!} /> : <GoalsSections goals={goals ?? []} />}
      </div>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {title && <div className="sr-only">{title}</div>}
      {children}
    </div>
  );
}

function AdsSections({ report }: { report: AdsReportData }) {
  const totalSpend = useMemo(
    () => report.meta.reduce((acc, b) => acc + num(b.totals['Gasto']), 0),
    [report.meta],
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Contas" value={String(report.meta.length)} />
          <Stat label="Investimento" value={brl(totalSpend)} />
          <Stat label="Cliques" value={String(sum(report.meta, 'Cliques'))} />
          <Stat label="Impressões" value={String(sum(report.meta, 'Impressões'))} />
        </CardContent>
      </Card>

      {report.meta.map(acc => (
        <Card key={acc.id}>
          <CardHeader>
            <CardTitle>{acc.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
              <Stat label="Investido" value={brl(num(acc.totals['Gasto']))} />
              <Stat label="Cliques" value={String(num(acc.totals['Cliques']))} />
              <Stat label="Mensagens" value={String(num(acc.totals['Mensagens']))} />
              <Stat label="Leads Pixel" value={String(num(acc.totals['Leads do Pixel']))} />
              <Stat label="Leads Ads" value={String(num(acc.totals['Leads do Meta Ads']))} />
              <Stat label="Impressões" value={String(num(acc.totals['Impressões']))} />
            </div>
            <RowsTable rows={acc.rows} />
          </CardContent>
        </Card>
      ))}

      {report.google_ads && (
        <Card>
          <CardHeader>
            <CardTitle>Google Ads</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto text-xs">
              {JSON.stringify(report.google_ads, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function RowsTable({ rows }: { rows: AdsInsightRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados no período.</p>;
  }

  const columns = [
    'Campanha',
    'Gasto',
    'Cliques',
    'CPC',
    'Impressões',
    'Mensagens',
    'Leads do Meta Ads',
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            {columns.map(c => (
              <th key={c} className="py-2 pr-3 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {columns.map(c => (
                <td key={c} className="py-1.5 pr-3">
                  {String(r[c] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GoalsSections({ goals }: { goals: ClientGoal[] }) {
  if (goals.length === 0) {
    return <p className="text-muted-foreground">Nenhuma meta para exibir.</p>;
  }
  return (
    <div className="space-y-4">
      {goals.map(g => (
        <Card key={g.id}>
          <CardHeader>
            <CardTitle>{g.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Stat label="Investimento" value={brl(Number(g.meta_budget ?? 0))} />
              <Stat label="Canal" value={g.sales_channel || '-'} />
              <Stat label="Contas" value={String((g.ad_accounts ?? []).length)} />
            </div>
            {(g.ad_accounts ?? []).map(a => (
              <div key={a.id} className="border-t pt-3">
                <div className="text-sm font-medium">{a.name}</div>
                <div className="text-xs text-muted-foreground">{a.id}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

/** '678,12' -> 678.12. As strings do relatório são pt-BR. */
function num(v: string | number | undefined): number {
  return typeof v === 'number'
    ? v
    : Number(
        String(v ?? '0')
          .replace(/\./g, '')
          .replace(',', '.'),
      ) || 0;
}

function sum(blocks: AdsReportData['meta'], key: string): number {
  return blocks.reduce((acc, b) => acc + num(b.totals[key]), 0);
}

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatBr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
