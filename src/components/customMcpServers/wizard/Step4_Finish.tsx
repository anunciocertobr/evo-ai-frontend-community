import { Button } from '@evoapi/design-system';
import { ArrowLeft, Check } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

export interface Step4Data {
  name: string;
  description: string;
  url: string;
  headers: Record<string, unknown>;
  timeout: number;
  retry_count: number;
  tags: string[];
}

interface Step4Props {
  data: Step4Data;
  onBack: () => void;
  onSubmit: () => void;
  loading?: boolean;
  mode?: 'create' | 'edit';
}

export default function Step4_Finish({
  data,
  onBack,
  onSubmit,
  loading = false,
  mode = 'create',
}: Step4Props) {
  const { t } = useLanguage('customMcpServers');

  const headersCount = Object.keys(data.headers || {}).length;
  const tagsCount = (data.tags || []).length;

  const rows: Array<{ label: string; value: string }> = [
    { label: t('form.labels.name'), value: data.name || '-' },
    { label: t('form.labels.description'), value: data.description?.trim() || '-' },
    { label: t('form.labels.url'), value: data.url || '-' },
    { label: t('form.labels.headers'), value: String(headersCount) },
    { label: t('form.labels.timeout'), value: String(data.timeout) },
    { label: t('form.labels.retries'), value: String(data.retry_count) },
    { label: t('form.labels.tags'), value: tagsCount > 0 ? data.tags.join(', ') : '-' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 max-w-4xl mx-auto py-2 px-4">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="w-full max-w-2xl mx-auto space-y-4">
          <p className="text-sm text-muted-foreground bg-muted/40 rounded p-3">
            {t('wizard.step4.reviewHint')}
          </p>

          <dl className="divide-y rounded-lg border">
            {rows.map(row => (
              <div
                key={row.label}
                className="grid grid-cols-[140px_1fr] gap-3 px-4 py-2.5"
              >
                <dt className="text-sm font-semibold text-muted-foreground">
                  {row.label}
                </dt>
                <dd className="text-sm break-words">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="flex justify-between flex-shrink-0 pt-2 border-t">
        <Button variant="outline" className="px-6 gap-2" onClick={onBack} disabled={loading}>
          <ArrowLeft className="h-4 w-4" />
          {t('wizard.actions.back')}
        </Button>
        <Button className="px-6 gap-2" onClick={onSubmit} disabled={loading}>
          <Check className="h-4 w-4" />
          {loading
            ? t('form.buttons.saving')
            : t(mode === 'edit' ? 'wizard.actions.save' : 'wizard.actions.create')}
        </Button>
      </div>
    </div>
  );
}
