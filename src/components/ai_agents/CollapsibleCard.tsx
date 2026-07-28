import { ReactNode, useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@evoapi/design-system';
import { ChevronDown } from 'lucide-react';

interface CollapsibleCardProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

const CollapsibleCard = ({
  title,
  subtitle,
  icon,
  defaultOpen = false,
  children,
}: CollapsibleCardProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-[14px] border border-[#ECEEF2] bg-white shadow-[0_1px_3px_rgba(20,30,45,0.05)]"
    >
      <CollapsibleTrigger
        className="flex w-full items-center gap-3 p-5 text-left"
        aria-expanded={open}
      >
        {icon && (
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-[#F0FAF4] text-[#359558]">
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-[#1A211E]">{title}</span>
          {subtitle && <span className="block text-sm text-muted-foreground">{subtitle}</span>}
        </span>
        <ChevronDown
          className={`h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t border-[#ECEEF2] p-5">{children}</CollapsibleContent>
    </Collapsible>
  );
};

export default CollapsibleCard;
