import { useEffect, useState } from 'react';
import { Globe, Info } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { productsService } from '@/services/products/productsService';
import { getAgentTypeLabel, isExternalAgent } from '@/utils/agents';
import type { Agent } from '@/types/agents';

interface AgentSummaryPanelProps {
  agent: Agent;
  /** Modelo em edição; cai para o do agente salvo quando o form ainda não tocou nele. */
  model?: string;
  subAgentsCount: number;
}

const AgentSummaryPanel = ({ agent, model, subAgentsCount }: AgentSummaryPanelProps) => {
  const { t, currentLanguage } = useLanguage('aiAgents');
  const [productsCount, setProductsCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    if (!agent?.id) return;

    productsService
      .listAgentProducts(agent.id)
      .then(products => {
        if (active) setProductsCount((products ?? []).length);
      })
      // A contagem é informativa: falhar aqui não pode quebrar a aba Perfil.
      .catch(() => {
        if (active) setProductsCount(null);
      });

    return () => {
      active = false;
    };
  }, [agent?.id]);

  const typeLabel = getAgentTypeLabel(agent.type, t);
  const origin = isExternalAgent(agent.type)
    ? t('edit.profile.summary.external') || 'Externo'
    : t('edit.profile.summary.native') || 'Nativo';

  const createdAt = agent.created_at
    ? new Date(agent.created_at).toLocaleDateString(currentLanguage)
    : '—';

  const rows = [
    { label: t('edit.profile.summary.type') || 'Tipo', value: `${typeLabel} · ${origin}` },
    { label: t('edit.profile.summary.model') || 'Modelo', value: model || agent.model || '—' },
    { label: t('edit.profile.summary.createdAt') || 'Criado em', value: createdAt },
  ];

  const counters = [
    {
      value: subAgentsCount,
      label: t('edit.profile.summary.subAgents') || 'Sub-agentes',
    },
    {
      value: productsCount ?? 0,
      label: t('edit.profile.summary.products') || 'Produtos',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[14px] border border-[#ECEEF2] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-center gap-[9px] border-b border-[#F2F4F7] px-5 py-4">
          <Globe className="h-[17px] w-[17px] text-[#359558]" />
          <span className="text-[12.5px] font-bold uppercase tracking-[0.5px] text-[#359558]">
            {t('edit.profile.summary.title') || 'Resumo do Agente'}
          </span>
        </div>

        <div className="px-5 pb-2 pt-1">
          <div className="flex items-center justify-between border-b border-[#F4F6F8] py-[13px]">
            <span className="text-[13.5px] text-[#8A928F]">
              {t('edit.profile.summary.status') || 'Status'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BFE8D1] bg-[#F0FAF4] px-[11px] py-[3px] text-[12.5px] font-semibold text-[#2C834E]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#359558]" />
              {t('edit.profile.summary.active') || 'Ativo'}
            </span>
          </div>

          {rows.map((row, index) => (
            <div
              key={row.label}
              className={`flex items-center justify-between gap-4 py-[13px] ${
                index < rows.length - 1 ? 'border-b border-[#F4F6F8]' : ''
              }`}
            >
              <span className="text-[13.5px] text-[#8A928F]">{row.label}</span>
              <span className="truncate text-[13.5px] font-semibold text-[#1A211E]">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {counters.map(counter => (
          <div
            key={counter.label}
            className="rounded-[14px] border border-[#ECEEF2] bg-white px-[18px] py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
          >
            <p className="text-2xl font-extrabold text-[#131917]">{counter.value}</p>
            <p className="mt-0.5 text-[12.5px] text-[#8A928F]">{counter.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-[11px] rounded-[14px] border border-[#D5ECDF] bg-[#F0FAF4] px-[18px] py-4">
        <Info className="mt-0.5 h-[17px] w-[17px] flex-shrink-0 text-[#2C834E]" />
        <div>
          <p className="text-[13px] font-bold text-[#2C834E]">
            {t('edit.profile.summary.tipTitle') || 'Dica de configuração'}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-[1.55] text-[#4A7A5C]">
            {t('edit.profile.summary.tipBody') ||
              'Preencha o Papel e o Objetivo para que o agente entenda melhor seu contexto e responda com mais precisão.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AgentSummaryPanel;
