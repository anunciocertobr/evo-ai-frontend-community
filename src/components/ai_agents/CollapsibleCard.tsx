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

/**
 * A borda vive no CABEÇALHO e no CORPO, não na raiz: com ela na raiz o corpo
 * aberto ganhava uma linha extra dividindo os dois (a "emenda" da spec §7.4).
 * Aberto, o cabeçalho perde a borda de baixo e arredonda só o topo; o corpo
 * perde a de cima e arredonda só a base — os dois viram um card contínuo.
 */
const CollapsibleCard = ({
  title,
  subtitle,
  icon,
  defaultOpen = false,
  children,
}: CollapsibleCardProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={`flex w-full items-center gap-[13px] border border-[#ECEEF2] bg-white px-[22px] py-[18px] text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${
          open ? 'rounded-t-[14px] border-b-0' : 'rounded-[14px]'
        }`}
        aria-expanded={open}
      >
        {icon && (
          <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] bg-[#F0FAF4] text-[#359558]">
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-[#1A211E]">{title}</span>
          {subtitle && (
            <span className="mt-[3px] block text-[13px] text-[#8A928F]">{subtitle}</span>
          )}
        </span>
        <ChevronDown
          className={`h-[18px] w-[18px] flex-shrink-0 text-[#9AA3A0] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="rounded-b-[14px] border border-t-0 border-[#ECEEF2] bg-white px-[22px] pb-[18px] pt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default CollapsibleCard;
