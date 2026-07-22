import React, { useEffect, useState } from 'react';
import { Button } from '@evoapi/design-system/button';
import { Badge } from '@evoapi/design-system/badge';
import { Filter, Tag, UserCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@evoapi/design-system/popover';
import { ScrollArea } from '@evoapi/design-system/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@evoapi/design-system/accordion';
import { Checkbox } from '@evoapi/design-system/checkbox';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import { useContactFilterOptions } from '@/hooks/contacts/useContactFilterOptions';
import { BaseFilter } from '@/types/core';

interface ContactsFilterPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: BaseFilter[];
  onFiltersChange: (filters: BaseFilter[]) => void;
  onApplyFilters: (filters: BaseFilter[]) => void;
  onClearFilters: () => void;
  activeFiltersCount?: number;
  disabled?: boolean;
}

// Sanctioned hardcoded exception (see BaseStatusBadge): active/blocked always
// render as emerald/red dots, matching the badge shown elsewhere in the UI —
// not tokenized on purpose.
const BLOCKED_OPTIONS: Array<{ value: 'false' | 'true'; dotColor: string }> = [
  { value: 'false', dotColor: 'bg-emerald-600' },
  { value: 'true', dotColor: 'bg-red-600' },
];

const filterToValues = (filter: BaseFilter | undefined): string[] => {
  if (!filter) return [];
  return Array.isArray(filter.values)
    ? filter.values.map(String)
    : String(filter.values || '')
        .split(',')
        .filter(Boolean);
};

const buildFilter = (attributeKey: string, values: string[]): BaseFilter => ({
  attributeKey,
  filterOperator: 'equal_to',
  values: values.length > 1 ? values : values[0] || '',
  queryOperator: 'and',
  attributeModel: 'standard',
});

const SECTION_ACCENT = 'text-primary';

const ContactsFilterPopover: React.FC<ContactsFilterPopoverProps> = ({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters,
  activeFiltersCount = 0,
  disabled = false,
}) => {
  const { t } = useLanguage('contacts');
  const { labels } = useContactFilterOptions({ enabled: open });

  // Rascunho local: só vira `filters` de verdade ao clicar Aplicar.
  const [draft, setDraft] = useState<BaseFilter[]>(filters);
  const [openSections, setOpenSections] = useState<string[]>(['blocked']);

  useEffect(() => {
    if (open) {
      setDraft(filters);
    }
  }, [open, filters]);

  const toggleValue = (attributeKey: string, value: string, multi: boolean) => {
    const current = draft.find(f => f.attributeKey === attributeKey);
    const currentValues = filterToValues(current);

    let nextValues: string[];
    if (multi) {
      nextValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
    } else {
      nextValues = currentValues.includes(value) ? [] : [value];
    }

    const withoutSection = draft.filter(f => f.attributeKey !== attributeKey);
    setDraft(nextValues.length > 0 ? [...withoutSection, buildFilter(attributeKey, nextValues)] : withoutSection);
  };

  const blockedValues = filterToValues(draft.find(f => f.attributeKey === 'blocked'));
  const labelValues = filterToValues(draft.find(f => f.attributeKey === 'labels'));

  const activeCount = draft.filter(f => filterToValues(f).length > 0).length;
  const hasAppliedFilters = filters.filter(f => filterToValues(f).length > 0).length > 0 || activeFiltersCount > 0;

  const handleApply = () => {
    const validDraft = draft.filter(f => filterToValues(f).length > 0);
    onFiltersChange(validDraft);
    onApplyFilters(validDraft);
    onOpenChange(false);
  };

  const handleClearAll = () => {
    setDraft([]);
    onClearFilters();
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="bg-sidebar border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent whitespace-nowrap relative"
          data-tour="contacts-filter-button"
        >
          <Filter className="h-4 w-4 mr-2" />
          {t('filter.popover.trigger')}
          {hasAppliedFilters && (
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs bg-sidebar-accent">
              {activeFiltersCount || activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 h-[22rem] p-0 flex flex-col overflow-hidden bg-muted"
        side="bottom"
        align="end"
        sideOffset={8}
        collisionPadding={12}
      >
        <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-background border-b">
          <span className="text-sm font-semibold">{t('filter.popover.title')}</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeCount}
            </Badge>
          )}
        </div>

        <ScrollArea className="grow min-h-0 overflow-y-auto">
          <div className="p-2.5 flex flex-col gap-2">
            <Accordion type="multiple" value={openSections} onValueChange={setOpenSections}>
              <AccordionItem
                value="blocked"
                className="border-0 rounded-xl bg-background shadow-sm overflow-hidden"
              >
                <AccordionTrigger className="px-3.5 py-3 text-sm font-semibold hover:no-underline [&>svg]:text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <UserCheck className={cn('h-4 w-4', SECTION_ACCENT)} />
                    {t('filter.attributes.blocked')}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3.5 pb-3 pt-0 space-y-1">
                  {BLOCKED_OPTIONS.map(option => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2.5 w-full py-1.5 text-sm rounded-lg cursor-pointer"
                    >
                      <Checkbox
                        checked={blockedValues.includes(option.value)}
                        onCheckedChange={() => toggleValue('blocked', option.value, false)}
                      />
                      <span className="flex-1">{t(`filter.options.blocked.${option.value}`)}</span>
                      <span className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', option.dotColor)} />
                    </label>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Accordion type="multiple" value={openSections} onValueChange={setOpenSections}>
              <AccordionItem
                value="labels"
                className={cn(
                  'border-0 rounded-xl bg-background shadow-sm overflow-hidden',
                  openSections.includes('labels') && 'ring-1 ring-primary/25',
                )}
              >
                <AccordionTrigger className="px-3.5 py-3 text-sm font-semibold hover:no-underline [&>svg]:text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Tag className={cn('h-4 w-4', SECTION_ACCENT)} />
                    {t('filter.attributes.labels')}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3.5 pb-3 pt-0 space-y-1">
                  {labels.length === 0 ? (
                    <div className="py-1.5 text-xs text-muted-foreground">
                      {t('filter.popover.noOptions')}
                    </div>
                  ) : (
                    labels.map(option => (
                      <label
                        key={option.value}
                        className="flex items-center gap-2.5 w-full py-1.5 text-sm rounded-lg cursor-pointer"
                      >
                        <Checkbox
                          checked={labelValues.includes(option.value)}
                          onCheckedChange={() => toggleValue('labels', option.value, true)}
                        />
                        <span className="flex-1 truncate">{option.label}</span>
                      </label>
                    ))
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between px-4 py-3 border-t bg-background gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-xs cursor-pointer">
            {t('filter.popover.clearAll')}
          </Button>
          <Button size="sm" onClick={handleApply} className="cursor-pointer">
            {t('filter.apply')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ContactsFilterPopover;
