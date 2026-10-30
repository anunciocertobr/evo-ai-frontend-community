import { Tabs, TabsContent, TabsList, TabsTrigger } from '@evoapi/design-system';
import { RastreamentoSiteTab } from '@/components/marketing/RastreamentoSiteTab';
import { RastreamentoFormularioTab } from '@/components/marketing/RastreamentoFormularioTab';
import { RastreamentoWhatsappTab } from '@/components/marketing/RastreamentoWhatsappTab';

// 3 fontes de rastreamento de origem de lead (Meta/Instagram), cada uma
// com seu próprio formato de dado — por isso 3 abas em vez de uma tabela
// só. As abas ficam ao lado do título (não numa linha cheia abaixo) pra
// não ocupar espaço vertical extra, como pedido.
export default function RastreamentosPage() {
  return (
    <div className="flex flex-col min-h-full bg-background p-6 space-y-4">
      <Tabs defaultValue="whatsapp" className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Rastreamentos</h1>
            <p className="hidden sm:block text-sm text-muted-foreground">Origem dos leads por canal: site, formulário e WhatsApp</p>
          </div>
          <TabsList>
            <TabsTrigger value="site">Site</TabsTrigger>
            <TabsTrigger value="formulario">Formulário</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="site" className="flex-1 flex flex-col min-h-0 mt-4">
          <RastreamentoSiteTab />
        </TabsContent>
        <TabsContent value="formulario" className="flex-1 flex flex-col min-h-0 mt-4">
          <RastreamentoFormularioTab />
        </TabsContent>
        <TabsContent value="whatsapp" className="flex-1 flex flex-col min-h-0 mt-4">
          <RastreamentoWhatsappTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
