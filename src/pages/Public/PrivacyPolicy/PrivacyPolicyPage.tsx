import { AppLogo } from '@/components/AppLogo';

const LAST_UPDATED = '29 de setembro de 2026';
const SUPPORT_EMAIL = 'contato@anunciocertobr.com.br';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center gap-3">
          <AppLogo className="h-10 max-w-44 object-contain" />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Política de Privacidade</h1>
          <p className="text-sm text-muted-foreground mt-1">Última atualização: {LAST_UPDATED}</p>
        </div>

        <section className="space-y-3 text-sm leading-relaxed">
          <p>
            Esta Política de Privacidade descreve como a <strong>Anúncio Certo Marketing Digital</strong> ("nós",
            "nosso") trata dados no CRM Anúncio Certo (site e aplicativo Android), uma ferramenta interna de gestão
            usada pela nossa equipe e por clientes autorizados para administrar contatos, conversas, campanhas de
            anúncios, arquivos e demais atividades de marketing digital.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. Quem processa os dados</h2>
          <p className="text-sm leading-relaxed">
            O CRM é operado pela Anúncio Certo Marketing Digital em infraestrutura própria (servidor dedicado), sem
            repassar os dados a provedores de CRM terceirizados. O acesso é restrito por login e senha a usuários
            autorizados (equipe interna e, quando aplicável, clientes da agência).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. Dados que tratamos</h2>
          <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1">
            <li><strong>Dados de conta:</strong> nome, e-mail e senha (armazenada de forma criptografada) dos usuários do CRM.</li>
            <li><strong>Dados de contatos e clientes:</strong> nome, telefone, e-mail e histórico de conversas/atendimento dos contatos gerenciados pela agência (ex.: via WhatsApp).</li>
            <li><strong>Dados de campanhas de marketing:</strong> informações de contas de anúncio, campanhas, públicos e métricas de plataformas como Meta Ads e Google Ads, conectadas voluntariamente pelo usuário.</li>
            <li><strong>Arquivos:</strong> imagens, vídeos e documentos enviados ao CRM ou vinculados via integrações (ex.: Google Drive) para uso em campanhas e atendimento.</li>
            <li><strong>Dados financeiros internos:</strong> informações de faturamento, recibos e notas fiscais cadastradas pela própria agência para controle interno.</li>
            <li><strong>Dados técnicos:</strong> registros de acesso e uso da plataforma, para segurança e diagnóstico de problemas.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. Como usamos esses dados</h2>
          <p className="text-sm leading-relaxed">
            Usamos os dados exclusivamente para operar o CRM: autenticar usuários, permitir o atendimento e a gestão
            de contatos, criar e acompanhar campanhas de marketing, organizar arquivos de trabalho e gerar relatórios
            internos. Não vendemos dados a terceiros.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. Compartilhamento com terceiros</h2>
          <p className="text-sm leading-relaxed">
            Alguns recursos do CRM se conectam, mediante autorização explícita do usuário, a serviços de terceiros
            necessários para o funcionamento das integrações que o usuário optar por usar, como Meta (WhatsApp,
            Instagram, Facebook Ads), Google (Ads, Drive, Agenda, Planilhas) e provedores de e-mail/SMS. Esses dados
            trafegam diretamente com as respectivas plataformas conforme os Termos e Políticas de Privacidade de cada
            uma delas, e apenas para as finalidades configuradas pelo próprio usuário.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. Armazenamento e segurança</h2>
          <p className="text-sm leading-relaxed">
            Os dados são armazenados em servidor próprio, com controle de acesso por login/senha e comunicação
            criptografada (HTTPS). Senhas de usuários e credenciais sensíveis de integrações são armazenadas de forma
            criptografada.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. Retenção e exclusão</h2>
          <p className="text-sm leading-relaxed">
            Mantemos os dados enquanto a conta estiver ativa ou enquanto forem necessários para as finalidades
            descritas acima. Usuários podem solicitar a exclusão de sua conta e dos dados associados a qualquer
            momento pelo e-mail de contato abaixo.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. Seus direitos (LGPD)</h2>
          <p className="text-sm leading-relaxed">
            Nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018), você pode solicitar a qualquer momento a
            confirmação, o acesso, a correção ou a exclusão dos seus dados pessoais, bem como informações sobre com
            quem eles são compartilhados. Para exercer esses direitos, entre em contato pelo e-mail abaixo.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Aplicativo Android</h2>
          <p className="text-sm leading-relaxed">
            O aplicativo Android do CRM Anúncio Certo é um encapsulamento (Trusted Web Activity) do mesmo site
            acessado pelo navegador, em <code className="text-xs bg-muted px-1 py-0.5 rounded">crmcerto.anunciocertobr.com.br</code>.
            Ele não coleta dados adicionais além dos descritos nesta política, e não requer permissões além das
            necessárias para exibir o conteúdo web e (quando autorizado pelo usuário) enviar notificações.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">9. Contato</h2>
          <p className="text-sm leading-relaxed">
            Dúvidas sobre esta política ou solicitações relacionadas aos seus dados podem ser enviadas para{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline underline-offset-2">
              {SUPPORT_EMAIL}
            </a>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">10. Alterações desta política</h2>
          <p className="text-sm leading-relaxed">
            Esta política pode ser atualizada periodicamente para refletir mudanças no CRM ou na legislação aplicável.
            A data da última atualização está indicada no topo desta página.
          </p>
        </section>
      </div>
    </div>
  );
}
