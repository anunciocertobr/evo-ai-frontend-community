import { useState } from 'react';
import { Input, Label, Button } from '@evoapi/design-system';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { KeyValueEditor } from '@/components/ai_agents/shared';

export interface Step2Data {
  url: string;
  headers: Record<string, unknown>;
}

interface Step2Props {
  data: Step2Data;
  onChange: (data: Step2Data) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step2_Connection({ data, onChange, onNext, onBack }: Step2Props) {
  const { t } = useLanguage('customMcpServers');
  const [error, setError] = useState('');

  const handleNext = () => {
    if (!data.url || !data.url.trim()) {
      setError(t('form.validation.urlRequired'));
      return;
    }
    try {
      new URL(data.url);
    } catch {
      setError(t('form.validation.urlInvalid'));
      return;
    }
    setError('');
    onNext();
  };

  return (
    <div className="flex flex-col h-full min-h-0 max-w-4xl mx-auto py-2 px-4">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="w-full max-w-2xl mx-auto space-y-4">
          <div>
            <Label className="text-sm mb-1.5 block font-semibold">
              {t('form.labels.url')} <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder={t('form.placeholders.url')}
              value={data.url}
              onChange={e => onChange({ ...data, url: e.target.value })}
              className={`h-10 text-sm ${error ? 'border-red-500' : ''}`}
              autoFocus
            />
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </div>

          <div className="pt-2">
            <KeyValueEditor
              id="headers"
              label={t('form.labels.headers')}
              value={data.headers}
              onChange={next => onChange({ ...data, headers: next })}
              hint={t('form.hints.headers')}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between flex-shrink-0 pt-2 border-t">
        <Button variant="outline" className="px-6 gap-2" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          {t('wizard.actions.back')}
        </Button>
        <Button className="px-6 gap-2" onClick={handleNext} disabled={!data.url}>
          {t('wizard.actions.continue')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
