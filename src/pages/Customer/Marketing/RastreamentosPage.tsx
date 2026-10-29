import { useEffect, useState } from 'react';
import { Card, CardContent } from '@evoapi/design-system';
import { BaseHeader } from '@/components/base';
import api from '@/services/core/api';

interface HelenaUtm {
  source?: string;
  sourceId?: string;
  campaign?: string;
  clid?: string;
  medium?: string;
  content?: string;
  headline?: string;
  referralUrl?: string;
}

interface HelenaContact {
  id: string;
  name?: string;
  nameWhatsapp?: string;
  phoneNumber?: string;
  phoneNumberFormatted?: string;
  email?: string;
  origin?: string;
  utm?: HelenaUtm;
  createdAt?: string;
}

// Contatos importados da API WTS/Helena com dados de origem (Meta/Instagram)
// — movido de Dashboard/index.tsx pra cá (página própria em Marketing, logo
// abaixo de "Relatórios" no menu) porque não é uma métrica de atendimento
// do CRM, é rastreamento de origem de lead de campanha, igual os outros
// itens dessa seção do menu (Metas de Clientes, Criação Meta etc.).
export default function RastreamentosPage() {
  const [contacts, setContacts] = useState<HelenaContact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/reports/helena_wts/all_contacts?limit=100');
        setContacts(res.data?.items || []);
      } catch (err) {
        console.error('Error loading Helena contacts:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="flex flex-col min-h-full bg-background p-6 space-y-6">
      <BaseHeader
        title="Rastreamentos"
        subtitle="Contatos importados da API WTS/Helena com dados de origem (Meta/Instagram)"
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/50">
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-left p-3 font-medium">Telefone</th>
                  <th className="text-left p-3 font-medium">E-mail</th>
                  <th className="text-left p-3 font-medium">Origem</th>
                  <th className="text-left p-3 font-medium">Plataforma</th>
                  <th className="text-left p-3 font-medium">Campanha (ID)</th>
                  <th className="text-left p-3 font-medium">Clid / waclid</th>
                  <th className="text-left p-3 font-medium">Medium</th>
                  <th className="text-left p-3 font-medium">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-muted-foreground">Carregando...</td>
                  </tr>
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-muted-foreground">Nenhum contato encontrado</td>
                  </tr>
                ) : (
                  contacts.slice(0, 200).map((c) => {
                    const utm = c.utm || {};
                    return (
                      <tr key={c.id} className="border-b hover:bg-gray-50/50">
                        <td className="p-3">{c.name || c.nameWhatsapp || '-'}</td>
                        <td className="p-3">{c.phoneNumberFormatted || c.phoneNumber || '-'}</td>
                        <td className="p-3">{c.email || '-'}</td>
                        <td className="p-3">{c.origin || '-'}</td>
                        <td className="p-3">{utm.source || '-'}</td>
                        <td className="p-3">{utm.sourceId || utm.campaign || '-'}</td>
                        <td className="p-3 max-w-[250px] truncate" title={utm.clid || ''}>{utm.clid || '-'}</td>
                        <td className="p-3">{utm.medium || '-'}</td>
                        <td className="p-3">{c.createdAt ? new Date(c.createdAt).toLocaleString('pt-BR') : '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {contacts.length > 200 && (
              <div className="px-6 py-3 text-sm text-muted-foreground border-t">
                Exibindo 200 de {contacts.length} registros
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
