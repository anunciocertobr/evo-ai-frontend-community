import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicReport, PublicReportPayload } from '@/services/marketing/reportLinksService';
import {
  ClientGoal,
  ClientGoalAdAccount,
  ClientGoalObjective,
  OBJECTIVE_TYPE_OPTIONS,
} from '@/services/marketing/clientGoalsService';

const currency = (value: number | null | undefined) =>
  value === null || value === undefined
    ? '—'
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const decimal = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('pt-BR');

// O backend não manda `label` no tipo compartilhado (só o OBJECTIVE_LABELS
// interno dele), então resolvemos pelo objetivo — 'outro' usa o rótulo livre.
const objectiveLabel = (objective: ClientGoalObjective): string => {
  if (objective.objective_type === 'outro') {
    return objective.custom_label || 'Outro';
  }
  return (
    OBJECTIVE_TYPE_OPTIONS.find((option) => option.value === objective.objective_type)?.label ??
    'Objetivo'
  );
};

const ObjectiveRow = ({ objective }: { objective: ClientGoalObjective }) => {
  const status = objective.status;
  const hasStatus = Boolean(status?.trackable);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-foreground">{objectiveLabel(objective)}</span>
        <span className="text-sm text-muted-foreground">
          Orçamento: {currency(objective.budget)}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Meta diária</dt>
          <dd className="text-foreground">{decimal(objective.target_result_daily)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Meta semanal</dt>
          <dd className="text-foreground">{decimal(objective.target_result_weekly)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Meta mensal</dt>
          <dd className="text-foreground">{decimal(objective.target_result_monthly)}</dd>
        </div>
      </dl>

      {hasStatus && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              status?.last_within_margin
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {status?.last_within_margin ? 'Dentro da meta' : 'Fora da meta'}
          </span>
          <span className="text-muted-foreground">
            Custo por resultado: {currency(status?.last_cost_per_result)}
          </span>
          {Boolean(status?.days_out_of_margin) && (
            <span className="text-muted-foreground">
              {status?.days_out_of_margin} dia(s) fora da meta
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const AccountCard = ({ account }: { account: ClientGoalAdAccount }) => (
  <div className="rounded-lg border border-border bg-background p-4">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="font-medium text-foreground">{account.name || 'Conta sem nome'}</span>
      {account.id && (
        <span className="font-mono text-xs text-muted-foreground">{account.id}</span>
      )}
    </div>
    <div className="mt-3 space-y-2">
      {account.objectives.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma meta definida nesta conta.</p>
      ) : (
        account.objectives.map((objective, index) => (
          <ObjectiveRow key={objective.key ?? index} objective={objective} />
        ))
      )}
    </div>
  </div>
);

const GoalCard = ({ goal }: { goal: ClientGoal }) => (
  <section className="space-y-3">
    <header className="space-y-1">
      <h2 className="text-lg font-semibold text-foreground">{goal.name}</h2>
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        {goal.sales_channel && <span>Canal: {goal.sales_channel}</span>}
        <span>Orçamento total: {currency(goal.meta_budget)}</span>
        {Array.isArray(goal.segments) && goal.segments.length > 0 && (
          <span>Segmentos: {goal.segments.join(', ')}</span>
        )}
      </div>
    </header>
    <div className="space-y-3">
      {goal.ad_accounts.map((account, index) => (
        <AccountCard key={account.id || index} account={account} />
      ))}
    </div>
  </section>
);

const PublicReportPage = () => {
  const { token } = useParams<{ token: string }>();
  const [payload, setPayload] = useState<PublicReportPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!token) return;
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const result = await fetchPublicReport(token);
        if (!cancelled) setPayload(result);
      } catch (error: unknown) {
        if (cancelled) return;
        // 404 = link nunca existiu; 410 = expirado ou revogado. A mensagem
        // do servidor é usada porque ela já é escrita pro visitante final.
        const response = (error as { response?: { status?: number; data?: { error?: string } } })
          ?.response;
        setErrorMessage(
          response?.data?.error ??
            (response?.status === 404
              ? 'Link inválido.'
              : 'Não foi possível carregar o relatório.'),
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">Relatório indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">
            {payload?.link.title || 'Relatório'}
          </h1>
          {typeof payload?.link.days_left === 'number' && (
            <p className="text-sm text-muted-foreground">
              Este link expira em {payload.link.days_left} dia(s).
            </p>
          )}
        </header>

        {payload?.goals.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhuma conta de anúncio foi compartilhada neste link.
          </div>
        ) : (
          <div className="space-y-10">
            {payload?.goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicReportPage;