import { Tabs, TabsContent, TabsList, TabsTrigger } from '@evoapi/design-system';
import { SitesTab } from '@/pages/Customer/Dashboard/components/SitesTab';
import { MetaLeadFormsTab } from '@/components/marketing/MetaLeadFormsTab';
import { RastreamentoWhatsappTab } from '@/components/marketing/RastreamentoWhatsappTab';
import { RastreamentoExternoTab } from '@/components/marketing/RastreamentoExternoTab';

// 4 fontes de rastreamento de origem de lead, centralizadas num só lugar —
// cada aba reaproveita o componente JÁ EXISTENTE de onde ela vem (pedido
// explícito do usuário: "quero que abra exatamente... tudo igual
// exatamente como foi desenvolvido, só estou centralizando em um lugar"),
// sem reconstruir nada:
// - Site: o mesmo SitesTab de Dashboards > Sites (cards + SiteLeadsDialog).
// - Formulário: o mesmo MetaLeadFormsTab de Marketing > Criação Meta
//   (extraído de lá pra um componente compartilhado, usado nos dois
//   lugares com o comportamento idêntico).
// - WhatsApp: puxa da NOSSA base interna (AdLead, capturado pelo webhook
//   oficial da Meta — ver Whatsapp::AdReferralCapture no backend), não
//   depende de nenhum sistema externo.
// - Externo: contatos da Helena/WTS (CRM externo) enriquecidos com
//   campanha/conjunto/anúncio/criativo — distinto de "WhatsApp" porque é
//   outra base de dados (API de terceiro), mesmo os dois sendo canal
//   WhatsApp na prática.
// As abas ficam ao lado do título (não numa linha cheia abaixo) pra não
// ocupar espaço vertical extra, como pedido.
export default function RastreamentosPage() {
  return (
    <div className="flex flex-col min-h-full bg-background p-6 space-y-4">
      <Tabs defaultValue="whatsapp" className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Rastreamentos</h1>
            <p className="hidden sm:block text-sm text-muted-foreground">Origem dos leads por canal: site, formulário, WhatsApp e CRM externo</p>
          </div>
          <TabsList>
            <TabsTrigger value="site">Site</TabsTrigger>
            <TabsTrigger value="formulario">Formulário</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="externo">Externo</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="site" className="flex-1 flex flex-col min-h-0 mt-4 overflow-y-auto">
          <SitesTab />
        </TabsContent>
        <TabsContent value="formulario" className="flex-1 flex flex-col min-h-0 mt-4 overflow-y-auto">
          <MetaLeadFormsTab />
        </TabsContent>
        <TabsContent value="whatsapp" className="flex-1 flex flex-col min-h-0 mt-4">
          <RastreamentoWhatsappTab />
        </TabsContent>
        <TabsContent value="externo" className="flex-1 flex flex-col min-h-0 mt-4">
          <RastreamentoExternoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
