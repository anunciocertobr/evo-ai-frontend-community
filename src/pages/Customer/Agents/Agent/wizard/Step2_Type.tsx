import { useState } from 'react';
import { Card, CardContent, Button, Badge } from '@evoapi/design-system';
import {
  ArrowRight,
  ArrowLeft,
  Bot,
  ListChecks,
  ArrowRight as ArrowRightIcon,
  GitBranch,
  RefreshCw,
  Plug,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import type { LucideIcon } from 'lucide-react';

interface Step2Props {
  data: { type: string };
  onChange: (data: { type: string }) => void;
  onNext: () => void;
  onBack: () => void;
}

interface AgentTypeDef {
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
  badge?: string | null;
  badgeVariant?: 'default' | 'outline' | 'secondary';
}

// Two lay-friendly primary choices — these are the existing `llm` and `external`
// backend types, just presented up-front. The 4 orchestration types below are
// distinct backend types kept behind an "Avançado" reveal (they still write their
// real enum value, so the downstream wizard flow is unchanged).
const getPrimaryTypes = (t: (key: string) => string): AgentTypeDef[] => [
  {
    value: 'llm',
    label: t('wizard.step2.types.llm.label'),
    description: t('wizard.step2.types.llm.description'),
    icon: Bot,
    badge: t('wizard.step2.badges.mostPopular'),
    badgeVariant: 'default',
  },
  {
    value: 'external',
    label: t('wizard.step2.types.external.label'),
    description: t('wizard.step2.types.external.description'),
    icon: Plug,
    badgeVariant: 'secondary',
  },
];

const getAdvancedTypes = (t: (key: string) => string): AgentTypeDef[] => [
  {
    value: 'task',
    label: t('wizard.step2.types.task.label'),
    description: t('wizard.step2.types.task.description'),
    icon: ListChecks,
  },
  {
    value: 'sequential',
    label: t('wizard.step2.types.sequential.label'),
    description: t('wizard.step2.types.sequential.description'),
    icon: ArrowRightIcon,
  },
  {
    value: 'parallel',
    label: t('wizard.step2.types.parallel.label'),
    description: t('wizard.step2.types.parallel.description'),
    icon: GitBranch,
  },
  {
    value: 'loop',
    label: t('wizard.step2.types.loop.label'),
    description: t('wizard.step2.types.loop.description'),
    icon: RefreshCw,
  },
];

const ADVANCED_VALUES = ['task', 'sequential', 'parallel', 'loop'];

const Step2_Type = ({ data, onChange, onNext, onBack }: Step2Props) => {
  const { t } = useLanguage('aiAgents');
  const [error, setError] = useState<string>('');
  // Auto-open the advanced section if the current selection is one of the advanced types.
  const [showAdvanced, setShowAdvanced] = useState<boolean>(() =>
    ADVANCED_VALUES.includes(data.type),
  );

  const primaryTypes = getPrimaryTypes(t);
  const advancedTypes = getAdvancedTypes(t);

  const handleNext = () => {
    if (!data.type) {
      setError(t('validation.typeRequired'));
      return;
    }
    onNext();
  };

  const handleTypeSelect = (type: string) => {
    onChange({ type });
    setError('');
  };

  // Primary card: prominent, tinted icon (design-system tokens, no raw gradients).
  const PrimaryCard = ({ type }: { type: AgentTypeDef }) => {
    const IconComponent = type.icon;
    const isSelected = data.type === type.value;
    return (
      <Card
        className={`cursor-pointer transition-all duration-200 hover:shadow-md flex flex-col ${
          isSelected ? 'border-primary border-2 bg-primary/5' : 'hover:border-primary/50'
        }`}
        onClick={() => handleTypeSelect(type.value)}
      >
        <CardContent className="p-5 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <IconComponent className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-2">
              <h3 className="font-semibold text-base">{type.label}</h3>
              {type.badge && (
                <Badge variant={type.badgeVariant} className="text-[11px]">
                  {type.badge}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-snug">{type.description}</p>
          </div>
          {isSelected && (
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Advanced row: compact, lighter (icon in a muted tile).
  const AdvancedRow = ({ type }: { type: AgentTypeDef }) => {
    const IconComponent = type.icon;
    const isSelected = data.type === type.value;
    return (
      <Card
        className={`cursor-pointer transition-colors ${
          isSelected ? 'border-primary border-2 bg-primary/5' : 'hover:border-primary/40'
        }`}
        onClick={() => handleTypeSelect(type.value)}
      >
        <CardContent className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-muted flex items-center justify-center">
            <IconComponent className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-medium text-sm truncate">{type.label}</h4>
            <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2">
              {type.description}
            </p>
          </div>
          {isSelected && <Check className="w-4 h-4 text-primary shrink-0" strokeWidth={3} />}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 max-w-3xl mx-auto py-2 px-4">
      <div className="flex-1 min-h-0 overflow-y-auto p-1">
        {/* Two primary, lay-friendly choices */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {primaryTypes.map(type => (
            <PrimaryCard key={type.value} type={type} />
          ))}
        </div>

        {/* Advanced orchestration types — collapsed by default */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            />
            {t('wizard.step2.advanced')}
          </button>

          {showAdvanced && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {advancedTypes.map(type => (
                <AdvancedRow key={type.value} type={type} />
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 text-center mb-3 flex-shrink-0">{error}</p>}

      <div className="flex justify-between flex-shrink-0 pt-3 border-t mt-3">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('actions.back')}
        </Button>
        <Button onClick={handleNext} disabled={!data.type} className="gap-2 px-6">
          {t('actions.continue')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default Step2_Type;
