import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Loader2,
  FileText,
  XCircle,
  Settings,
  AlertTriangle,
  Code2,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@evoapi/design-system';
import { toast } from 'sonner';
import { BaseHeader } from '@/components/base';
import { fiscalEstablishmentsService } from '@/services/finances/fiscalEstablishmentsService';
import { serviceInvoicesService } from '@/services/finances/serviceInvoicesService';
import { apiErrorMessage } from '@/utils/apiHelpers';
import {
  FiscalEstablishment,
  ServiceInvoice,
  ServiceInvoiceFormData,
  ServiceInvoiceStatus,
} from '@/types/fiscalInvoices';

const STATUS_META: Record<ServiceInvoiceStatus, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  processing: { label: 'Processando', variant: 'outline' },
  authorized: { label: 'Autorizada', variant: 'default' },
  error: { label: 'Erro', variant: 'destructive' },
  cancelled: { label: 'Cancelada', variant: 'secondary' },
};

function currency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const emptyEndereco = { logradouro: '', numero: '', bairro: '', codigo_municipio: '', uf: '', cep: '' };

const emptyForm: ServiceInvoiceFormData = {
  fiscal_establishment_id: '',
  tomador_nome: '',
  tomador_cpf_cnpj: '',
  tomador_email: '',
  tomador_endereco: emptyEndereco,
  discriminacao: '',
  codigo_servico_municipal: '',
  valor_servicos: 0,
  valor_deducoes: 0,
};

export default function NotaFiscalServicoPage() {
  const [establishments, setEstablishments] = useState<FiscalEstablishment[]>([]);
  const [invoices, setInvoices] = useState<ServiceInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ServiceInvoiceFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [xmlTarget, setXmlTarget] = useState<ServiceInvoice | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ServiceInvoice | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const activeEstablishments = useMemo(() => establishments.filter((e) => e.active), [establishments]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [establishmentsData, invoicesData] = await Promise.all([
        fiscalEstablishmentsService.list(),
        serviceInvoicesService.list(),
      ]);
      setEstablishments(establishmentsData);
      setInvoices(invoicesData);
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao carregar notas fiscais de serviço.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateDialog = () => {
    setForm({
      ...emptyForm,
      fiscal_establishment_id: activeEstablishments[0]?.id || '',
      aliquota_iss_pct: activeEstablishments[0] ? parseFloat(activeEstablishments[0].aliquota_iss_pct) : undefined,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.fiscal_establishment_id) {
      toast.error('Cadastre e selecione um estabelecimento fiscal primeiro.');
      return;
    }
    if (!form.tomador_nome.trim() || !form.tomador_cpf_cnpj.trim()) {
      toast.error('Informe nome e CPF/CNPJ do tomador do serviço.');
      return;
    }
    if (!form.discriminacao.trim() || !form.codigo_servico_municipal.trim()) {
      toast.error('Informe a discriminação e o código de serviço municipal.');
      return;
    }
    if (!form.valor_servicos || form.valor_servicos <= 0) {
      toast.error('Informe um valor de serviço válido.');
      return;
    }

    setSaving(true);
    try {
      const { fiscal_establishment_id, ...payload } = form;
      await serviceInvoicesService.create(fiscal_establishment_id, payload);
      toast.success('NFS-e enviada para emissão.');
      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao emitir NFS-e.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await serviceInvoicesService.cancel(cancelTarget.id);
      toast.success('Solicitação de cancelamento enviada.');
      setCancelTarget(null);
      loadData();
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao cancelar NFS-e.');
    } finally {
      setCancelling(false);
    }
  };

  const openXml = async (invoice: ServiceInvoice) => {
    try {
      const full = await serviceInvoicesService.get(invoice.id);
      setXmlTarget(full);
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao carregar XML.');
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-background p-6 space-y-6">
      <BaseHeader
        title="Nota Fiscal de Serviço"
        subtitle="Emita NFS-e direto com a prefeitura, sem gateway pago — sujeito a ter um estabelecimento fiscal configurado com certificado digital."
        primaryAction={{
          label: 'Emitir NFS-e',
          icon: <Plus className="w-4 h-4" />,
          onClick: openCreateDialog,
          disabled: activeEstablishments.length === 0,
        }}
      />

      {!loading && activeEstablishments.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Nenhum estabelecimento fiscal configurado ainda.
          <Link
            to="/finances/fiscal-establishments"
            className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
          >
            <Settings className="w-3 h-3" /> Configurar agora
          </Link>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando...
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Nenhuma NFS-e emitida ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RPS</TableHead>
                  <TableHead>NFS-e</TableHead>
                  <TableHead>Tomador</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const status = STATUS_META[invoice.status];
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        {invoice.serie_rps}/{invoice.numero_rps}
                      </TableCell>
                      <TableCell>{invoice.numero_nfse || '—'}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{invoice.tomador_nome}</TableCell>
                      <TableCell>{currency(Number(invoice.valor_servicos))}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                        {invoice.status === 'error' && invoice.erro_mensagem && (
                          <p className="text-xs text-destructive mt-1 max-w-[220px] truncate" title={invoice.erro_mensagem}>
                            {invoice.erro_mensagem}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => openXml(invoice)} title="Ver XML">
                          <Code2 className="w-4 h-4" />
                        </Button>
                        {(invoice.status === 'authorized' || invoice.status === 'processing') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCancelTarget(invoice)}
                            title="Cancelar"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Emitir NFS-e</DialogTitle>
            <DialogDescription>A nota é enviada pro webservice da prefeitura de forma assíncrona.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Estabelecimento fiscal</Label>
              <Select
                value={form.fiscal_establishment_id}
                onValueChange={(value: string) => setForm((prev) => ({ ...prev, fiscal_establishment_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {activeEstablishments.map((establishment) => (
                    <SelectItem key={establishment.id} value={establishment.id}>
                      {establishment.municipio_nome}/{establishment.uf} — {establishment.inscricao_municipal}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome do tomador</Label>
                <Input
                  value={form.tomador_nome}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((prev) => ({ ...prev, tomador_nome: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">CPF/CNPJ do tomador</Label>
                <Input
                  value={form.tomador_cpf_cnpj}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((prev) => ({ ...prev, tomador_cpf_cnpj: e.target.value }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">E-mail do tomador (opcional)</Label>
                <Input
                  type="email"
                  value={form.tomador_email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((prev) => ({ ...prev, tomador_email: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Logradouro</Label>
                <Input
                  value={form.tomador_endereco.logradouro}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((prev) => ({ ...prev, tomador_endereco: { ...prev.tomador_endereco, logradouro: e.target.value } }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Número</Label>
                <Input
                  value={form.tomador_endereco.numero}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((prev) => ({ ...prev, tomador_endereco: { ...prev.tomador_endereco, numero: e.target.value } }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Bairro</Label>
                <Input
                  value={form.tomador_endereco.bairro}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((prev) => ({ ...prev, tomador_endereco: { ...prev.tomador_endereco, bairro: e.target.value } }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Código IBGE do município</Label>
                <Input
                  value={form.tomador_endereco.codigo_municipio}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((prev) => ({ ...prev, tomador_endereco: { ...prev.tomador_endereco, codigo_municipio: e.target.value } }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">UF</Label>
                <Input
                  maxLength={2}
                  value={form.tomador_endereco.uf}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((prev) => ({ ...prev, tomador_endereco: { ...prev.tomador_endereco, uf: e.target.value.toUpperCase() } }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">CEP</Label>
                <Input
                  value={form.tomador_endereco.cep}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((prev) => ({ ...prev, tomador_endereco: { ...prev.tomador_endereco, cep: e.target.value } }))
                  }
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Discriminação do serviço</Label>
              <Textarea
                value={form.discriminacao}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setForm((prev) => ({ ...prev, discriminacao: e.target.value }))
                }
                rows={3}
                placeholder="Descrição do serviço prestado, exibida na nota"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Cód. serviço municipal</Label>
                <Input
                  value={form.codigo_servico_municipal}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((prev) => ({ ...prev, codigo_servico_municipal: e.target.value }))
                  }
                  placeholder="Lista LC116"
                />
              </div>
              <div>
                <Label className="text-xs">Valor do serviço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor_servicos}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((prev) => ({ ...prev, valor_servicos: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Deduções (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor_deducoes}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((prev) => ({ ...prev, valor_deducoes: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Alíquota ISS (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.aliquota_iss_pct ?? ''}
                  placeholder="Do estabelecimento"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((prev) => ({ ...prev, aliquota_iss_pct: parseFloat(e.target.value) || undefined }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Emitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!xmlTarget} onOpenChange={(open) => !open && setXmlTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>XML da NFS-e {xmlTarget?.serie_rps}/{xmlTarget?.numero_rps}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Envio</Label>
              <pre className="text-xs bg-muted/40 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                {xmlTarget?.xml_envio || 'Ainda não enviado.'}
              </pre>
            </div>
            <div>
              <Label className="text-xs">Retorno</Label>
              <pre className="text-xs bg-muted/40 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                {xmlTarget?.xml_retorno || 'Aguardando retorno da prefeitura.'}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar NFS-e?</AlertDialogTitle>
            <AlertDialogDescription>
              RPS {cancelTarget?.serie_rps}/{cancelTarget?.numero_rps} — o cancelamento é enviado direto pra
              prefeitura e não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelling}>
              {cancelling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
