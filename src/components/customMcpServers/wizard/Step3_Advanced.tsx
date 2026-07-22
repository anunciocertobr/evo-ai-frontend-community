import { useState } from 'react';
import { Input, Label, Button } from '@evoapi/design-system';
import { ArrowRight, ArrowLeft, Clock, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

export interface Step3Data {
  timeout: number;
  retry_count: number;
}

interface Step3Props {
  data: Step3Data;
  onChange: (data: Step3Data) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step3_Advanced({ data, onChange, onNext, onBack }: Step3Props) {
  const { t } = useLanguage('customMcpServers');
  const [errors, setErrors] = useState<{ timeout?: string; retry_count?: string }>({});

  const handleNext = () => {
    const nextErrors: { timeout?: string; retry_count?: string } = {};
    if (data.timeout < 1 || data.timeout > 300) {
      nextErrors.timeout = t('form.validation.timeoutRange');
    }
    if (data.retry_count < 0 || data.retry_count > 10) {
      nextErrors.retry_count = t('form.validation.retriesRange');
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    onNext();
  };

  return (
    <div className="flex flex-col h-full min-h-0 max-w-4xl mx-auto py-2 px-4">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="w-full max-w-2xl mx-auto space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm mb-1.5 flex items-center gap-1 font-semibold">
                <Clock className="h-4 w-4" />
                {t('form.labels.timeout')}
              </Label>
              <Input
                type="number"
                min="1"
                max="300"
                value={data.timeout}
                onChange={e =>
                  onChange({ ...data, timeout: parseInt(e.target.value) || 30 })
                }
                className={`h-10 text-sm ${errors.timeout ? 'border-red-500' : ''}`}
              />
              {errors.timeout && (
                <p className="text-sm text-red-600 mt-2">{errors.timeout}</p>
              )}
            </div>

            <div>
              <Label className="text-sm mb-1.5 flex items-center gap-1 font-semibold">
                <RotateCcw className="h-4 w-4" />
                {t('form.labels.retries')}
              </Label>
              <Input
                type="number"
                min="0"
                max="10"
                value={data.retry_count}
                onChange={e =>
                  onChange({ ...data, retry_count: parseInt(e.target.value) || 3 })
                }
                className={`h-10 text-sm ${errors.retry_count ? 'border-red-500' : ''}`}
              />
              {errors.retry_count && (
                <p className="text-sm text-red-600 mt-2">{errors.retry_count}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between flex-shrink-0 pt-2 border-t">
        <Button variant="outline" className="px-6 gap-2" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          {t('wizard.actions.back')}
        </Button>
        <Button className="px-6 gap-2" onClick={handleNext}>
          {t('wizard.actions.continue')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
