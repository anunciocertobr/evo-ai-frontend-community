import { LeadFormLead } from '@/services/marketing/metaCreationService';
import { leadDetailSections } from '@/components/marketing/leadDetails';

// Linha extra da tabela de leads (colSpan da tabela inteira) com o que não
// cabe nas colunas: IDs de campanha/conjunto/anúncio, texto principal,
// título e descrição do criativo e o direcionamento configurado no conjunto.
export default function LeadDetailsCell({ lead, colSpan }: { lead: LeadFormLead; colSpan: number }) {
  const secoes = leadDetailSections(lead);

  if (secoes.length === 0) {
    return (
      <tr className="border-t border-border bg-muted/30">
        <td colSpan={colSpan} className="p-3 text-xs text-muted-foreground">
          Sem detalhes de criativo ou direcionamento pra esse lead.
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border bg-muted/30">
      <td colSpan={colSpan} className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-border">
          {secoes.map((secao) => (
            <div key={secao.titulo} className="bg-background p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                {secao.titulo}
              </p>
              <dl className="space-y-1">
                {secao.itens.map((linha) => (
                  <div key={linha.label} className="flex gap-2">
                    <dt className="text-muted-foreground shrink-0 w-32">{linha.label}:</dt>
                    <dd className="whitespace-pre-wrap break-words min-w-0">{linha.valor}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
}
