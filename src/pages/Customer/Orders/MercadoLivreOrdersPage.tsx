import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@evoapi/design-system';
import { BaseHeader } from '@/components/base';
import { mercadoLivreService } from '@/services/orders/mercadoLivreService';
import type { MercadoLivreOrder, MercadoLivreStatus } from '@/types/orders/mercadoLivreOrder';

// Status reais de `order.status` na Orders API do Mercado Livre — ver
// MercadoLivreOrder::STATUSES no backend.
const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmado',
  payment_required: 'Aguardando pagamento',
  payment_in_process: 'Pagamento em processamento',
  partially_paid: 'Pago parcialmente',
  paid: 'Pago',
  cancelled: 'Cancelado',
  invalid: 'Inválido',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  paid: 'default',
  partially_paid: 'secondary',
  confirmed: 'secondary',
  payment_required: 'outline',
  payment_in_process: 'outline',
  cancelled: 'destructive',
  invalid: 'destructive',
};

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

export default function MercadoLivreOrdersPage() {
  const [status, setStatus] = useState<MercadoLivreStatus | null>(null);
  const [orders, setOrders] = useState<MercadoLivreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusResult, ordersResult] = await Promise.all([
        mercadoLivreService.getStatus(),
        mercadoLivreService.getOrders(),
      ]);
      setStatus(statusResult);
      setOrders(ordersResult);
    } catch {
      toast.error('Erro ao carregar pedidos do Mercado Livre.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await mercadoLivreService.syncOrders();
      setOrders(result);
      toast.success('Pedidos sincronizados!');
    } catch {
      toast.error('Erro ao sincronizar pedidos.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <BaseHeader
        title="Pedidos do Mercado Livre"
        subtitle="Pedidos recebidos na(s) conta(s) vendedora(s) conectadas, sincronizados automaticamente a cada 5 minutos."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : status?.connected ? (
            <Badge variant="default">Conectado{status.user_id ? ` · ${status.user_id}` : ''}</Badge>
          ) : (
            <Badge variant="destructive">Não conectado</Badge>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link to="/settings/integrations/mercado_livre">
              <Settings2 className="w-3.5 h-3.5 mr-1.5" /> Configurar conexão
            </Link>
          </Button>
        </div>
        <Button onClick={handleSync} disabled={syncing || !status?.connected}>
          {syncing ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-1.5" />
          )}
          Sincronizar agora
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
      ) : orders.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-10 border border-dashed rounded-md">
          {status?.connected
            ? 'Nenhum pedido recebido ainda.'
            : 'Conecte uma conta do Mercado Livre em Integrações pra começar a receber pedidos aqui.'}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">{order.ml_order_id}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[order.status] || 'outline'}>
                    {STATUS_LABELS[order.status] || order.status}
                  </Badge>
                </TableCell>
                <TableCell>{order.customer_name || '—'}</TableCell>
                <TableCell>{order.items_count}</TableCell>
                <TableCell>{formatCurrency(order.total_price)}</TableCell>
                <TableCell>{formatDate(order.placed_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
