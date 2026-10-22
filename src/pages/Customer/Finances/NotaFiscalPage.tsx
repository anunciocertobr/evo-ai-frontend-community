import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, FileText, AlertTriangle, Trash2, Settings, Loader2, Search } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@evoapi/design-system';
import { toast } from 'sonner';
import { BaseHeader } from '@/components/base';
import { goodsFiscalProfilesService } from '@/services/finances/goodsFiscalProfilesService';
import { goodsInvoicesService } from '@/services/finances/goodsInvoicesService';
import { productsService } from '@/services/products/productsService';
import { apiErrorMessage } from '@/utils/apiHelpers';
import {
  GoodsFiscalProfile,
  GoodsFiscalProfileFormData,
  GoodsInvoice,
  GoodsInvoiceItem,
  GoodsInvoiceModelo,
  GoodsInvoiceStatus,
} from '@/types/goodsInvoices';
import { Product } from '@/types/products';

const STATUS_META: Record<GoodsInvoiceStatus, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  processing: { label: 'Processando', variant: 'outline' },
  authorized: { label: 'Autorizada', variant: 'default' },
  error: { label: 'Erro', variant: 'destructive' },
  cancelled: { label: 'Cancelada', variant: 'secondary' },
};

function currency(value: number | string): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const emptyProfileForm: GoodsFiscalProfileFormData = {
  cnpj: '',
  razao_social: '',
  nome_fantasia: '',
  uf: '',
  inscricao_estadual: '',
  crt: '1',
  ambiente: 'homologacao',
};

const emptyItem: GoodsInvoiceItem = {
  descricao: '',
  ncm: '',
  cfop: '5102',
  cst_csosn: '',
  origem: '0',
  quantidade: 1,
  valor_unitario: 0,
  valor_total: 0,
};

export default function NotaFiscalPage() {
  const [profiles, setProfiles] = useState<GoodsFiscalProfile[]>([]);
  const [invoices, setInvoices] = useState<GoodsInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<GoodsFiscalProfileFormData>(emptyProfileForm);
  const [savingProfile, setSavingProfile] = useState(false);

  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [modelo, setModelo] = useState<GoodsInvoiceModelo>('55');
  const [naturezaOperacao, setNaturezaOperacao] = useState('Venda de mercadoria');
  const [destinatarioNome, setDestinatarioNome] = useState('');
  const [destinatarioCpfCnpj, setDestinatarioCpfCnpj] = useState('');
  const [itens, setItens] = useState<GoodsInvoiceItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeProfiles = useMemo(() => profiles.filter((p) => p.active), [profiles]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesData, invoicesData] = await Promise.all([
        goodsFiscalProfilesService.list(),
        goodsInvoicesService.list(),
      ]);
      setProfiles(profilesData);
      setInvoices(invoicesData);
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao carregar notas fiscais de mercadoria.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openProfileDialog = () => {
    setProfileForm(emptyProfileForm);
    setProfileDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!profileForm.cnpj.trim() || !profileForm.razao_social.trim() || !profileForm.inscricao_estadual.trim()) {
      toast.error('Informe CNPJ, razão social e inscrição estadual.');
      return;
    }
    setSavingProfile(true);
    try {
      await goodsFiscalProfilesService.create(profileForm);
      toast.success('Perfil fiscal cadastrado.');
      setProfileDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao salvar perfil fiscal.');
    } finally {
      setSavingProfile(false);
    }
  };

  const openInvoiceDialog = () => {
    setSelectedProfileId(activeProfiles[0]?.id || '');
    setModelo('55');
    setNaturezaOperacao('Venda de mercadoria');
    setDestinatarioNome('');
    setDestinatarioCpfCnpj('');
    setItens([]);
    setProductSearch('');
    setProductResults([]);
    setInvoiceDialogOpen(true);
  };

  const searchProducts = async (term: string) => {
    setProductSearch(term);
    if (term.trim().length < 2) {
      setProductResults([]);
      return;
    }
    setSearchingProducts(true);
    try {
      const response = await productsService.getProducts({ q: term, per_page: 10 });
      setProductResults(response.data || []);
    } catch {
      setProductResults([]);
    } finally {
      setSearchingProducts(false);
    }
  };

  // NCM/CFOP/CST/CSOSN e a classificação IBS/CBS vêm do cadastro do produto
  // (ver Product#ncm, #cfop_padrao, #csosn, #cst_icms, #cclasstrib) — é o
  // mesmo cadastro que /products/:id/calcular_imposto usa. Editável aqui
  // só pra correção pontual da venda, mas o imposto de verdade é sempre
  // recalculado no backend a partir do product_id, nunca do que for editado.
  const addProductAsItem = (product: Product) => {
    const item: GoodsInvoiceItem = {
      product_id: product.id,
      descricao: product.name,
      ncm: product.ncm || '',
      cfop: product.cfop_padrao || '5102',
      cst_csosn: product.csosn || product.cst_icms || '',
      origem: '0',
      quantidade: 1,
      valor_unitario: product.default_price || 0,
      valor_total: product.default_price || 0,
      cclasstrib: product.cclasstrib,
    };
    setItens((prev) => [...prev, item]);
    setProductSearch('');
    setProductResults([]);
  };

  const addBlankItem = () => setItens((prev) => [...prev, { ...emptyItem }]);

  const updateItem = (index: number, patch: Partial<GoodsInvoiceItem>) => {
    setItens((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        next.valor_total = Number((next.quantidade * next.valor_unitario).toFixed(2));
        return next;
      }),
    );
  };

  const removeItem = (index: number) => setItens((prev) => prev.filter((_, i) => i !== index));

  const totalProdutos = useMemo(() => itens.reduce((sum, item) => sum + item.valor_total, 0), [itens]);

  const handleSaveInvoice = async () => {
    if (!selectedProfileId) {
      toast.error('Cadastre e selecione um perfil fiscal primeiro.');
      return;
    }
    if (itens.length === 0) {
      toast.error('Adicione ao menos um item.');
      return;
    }
    if (modelo === '55' && (!destinatarioNome.trim() || !destinatarioCpfCnpj.trim())) {
      toast.error('NF-e (modelo 55) exige nome e CPF/CNPJ do destinatário.');
      return;
    }

    setSaving(true);
    try {
      const invoice = await goodsInvoicesService.create(selectedProfileId, {
        modelo,
        natureza_operacao: naturezaOperacao,
        destinatario_nome: destinatarioNome || undefined,
        destinatario_cpf_cnpj: destinatarioCpfCnpj || undefined,
        itens,
      });
      if (invoice.erro_mensagem) {
        toast.warning(`Nota registrada, mas não transmitida: ${invoice.erro_mensagem}`);
      } else {
        toast.success('Nota fiscal registrada.');
      }
      setInvoiceDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao registrar nota fiscal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-background p-6 space-y-6">
      <BaseHeader
        title="Nota Fiscal — NF-e & NFC-e"
        subtitle="NF-e 55 (e-commerce) + NFC-e 65 (balcão/delivery), já com os campos da Reforma Tributária (IBS/CBS)."
        primaryAction={{
          label: 'Nova Nota',
          icon: <Plus className="w-4 h-4" />,
          onClick: openInvoiceDialog,
          disabled: activeProfiles.length === 0,
        }}
        secondaryActions={[
          {
            label: 'Perfil Fiscal',
            icon: <Settings className="w-4 h-4" />,
            onClick: openProfileDialog,
            variant: 'outline',
          },
        ]}
      />

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3 text-sm">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium text-amber-700 dark:text-amber-400">
            Transmissão para a SEFAZ ainda não configurada
          </p>
          <p className="text-muted-foreground">
            Os dados fiscais (itens, NCM/CFOP, IBS/CBS calculado pela Reforma Tributária) já são reais e ficam
            registrados aqui. A emissão de verdade exige contratar um provedor certificado (eNotas, Focus NFe,
            PlugNotas etc.) e configurar a chave de API no Perfil Fiscal — até lá, as notas ficam como{' '}
            <strong>pendente</strong> com o motivo explicado.
          </p>
        </div>
      </div>

      {activeProfiles.length === 0 && !loading && (
        <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
          Cadastre um Perfil Fiscal (CNPJ, IE, regime tributário) antes de emitir a primeira nota.
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>IBS+CBS</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => {
              const status = STATUS_META[invoice.status];
              return (
                <TableRow key={invoice.id}>
                  <TableCell>{invoice.modelo === '65' ? 'NFC-e 65' : 'NF-e 55'}</TableCell>
                  <TableCell>
                    {invoice.serie}/{invoice.numero}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{invoice.destinatario_nome || 'Consumidor não identificado'}</TableCell>
                  <TableCell>{currency(invoice.valor_total)}</TableCell>
                  <TableCell>{currency(Number(invoice.valor_ibs) + Number(invoice.valor_cbs))}</TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {invoice.erro_mensagem && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-[260px] truncate" title={invoice.erro_mensagem}>
                        {invoice.erro_mensagem}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {invoices.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma nota registrada ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Perfil Fiscal */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Perfil Fiscal (NF-e/NFC-e)</DialogTitle>
            <DialogDescription>Dados do emitente perante a SEFAZ do estado — independente do cadastro de NFS-e.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">CNPJ</Label>
                <Input value={profileForm.cnpj} onChange={(e) => setProfileForm((p) => ({ ...p, cnpj: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Inscrição Estadual</Label>
                <Input
                  value={profileForm.inscricao_estadual}
                  onChange={(e) => setProfileForm((p) => ({ ...p, inscricao_estadual: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Razão Social</Label>
              <Input value={profileForm.razao_social} onChange={(e) => setProfileForm((p) => ({ ...p, razao_social: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">UF</Label>
                <Input
                  value={profileForm.uf}
                  maxLength={2}
                  onChange={(e) => setProfileForm((p) => ({ ...p, uf: e.target.value.toUpperCase() }))}
                />
              </div>
              <div>
                <Label className="text-xs">Regime (CRT)</Label>
                <Select value={profileForm.crt} onValueChange={(v) => setProfileForm((p) => ({ ...p, crt: v as '1' | '2' | '3' }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — Simples Nacional</SelectItem>
                    <SelectItem value="2">2 — Simples excesso</SelectItem>
                    <SelectItem value="3">3 — Regime Normal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Ambiente</Label>
                <Select
                  value={profileForm.ambiente}
                  onValueChange={(v) => setProfileForm((p) => ({ ...p, ambiente: v as 'homologacao' | 'producao' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homologacao">Homologação</SelectItem>
                    <SelectItem value="producao">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova Nota */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Nota Fiscal de Mercadoria</DialogTitle>
            <DialogDescription>
              IBS/CBS calculados automaticamente por item a partir do cadastro do produto (fase de testes 2026).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Perfil Fiscal</Label>
                <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.razao_social} ({profile.uf})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Modelo</Label>
                <Select value={modelo} onValueChange={(v) => setModelo(v as GoodsInvoiceModelo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="55">NF-e 55 (e-commerce)</SelectItem>
                    <SelectItem value="65">NFC-e 65 (balcão/delivery)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Natureza da Operação</Label>
              <Input value={naturezaOperacao} onChange={(e) => setNaturezaOperacao(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">
                  Destinatário {modelo === '65' && <span className="text-muted-foreground">(opcional em NFC-e)</span>}
                </Label>
                <Input value={destinatarioNome} onChange={(e) => setDestinatarioNome(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">CPF/CNPJ</Label>
                <Input value={destinatarioCpfCnpj} onChange={(e) => setDestinatarioCpfCnpj(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Itens</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar produto cadastrado (usa NCM/CFOP/CST/IBS-CBS de lá)..."
                  value={productSearch}
                  onChange={(e) => searchProducts(e.target.value)}
                />
                {searchingProducts && <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin" />}
                {productResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-56 overflow-y-auto">
                    {productResults.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                        onClick={() => addProductAsItem(product)}
                      >
                        {product.name} — {currency(product.default_price || 0)}
                        {!product.ncm && <span className="text-amber-500 ml-1">(sem NCM cadastrado)</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addBlankItem}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Item avulso (sem produto)
              </Button>

              {itens.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-20">NCM</TableHead>
                        <TableHead className="w-16">CFOP</TableHead>
                        <TableHead className="w-16">Qtd</TableHead>
                        <TableHead className="w-24">Vlr. Unit.</TableHead>
                        <TableHead className="w-24">Total</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              className="h-8"
                              value={item.descricao}
                              onChange={(e) => updateItem(index, { descricao: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input className="h-8" value={item.ncm} onChange={(e) => updateItem(index, { ncm: e.target.value })} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-8" value={item.cfop} onChange={(e) => updateItem(index, { cfop: e.target.value })} />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8"
                              type="number"
                              min="0"
                              value={item.quantidade}
                              onChange={(e) => updateItem(index, { quantidade: Number(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8"
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.valor_unitario}
                              onChange={(e) => updateItem(index, { valor_unitario: Number(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell className="text-sm">{currency(item.valor_total)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(index)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                IBS/CBS/Imposto Seletivo são calculados no servidor ao salvar, a partir do produto vinculado — valores
                aqui são só o subtotal de mercadoria.
              </p>
            </div>

            <div className="flex justify-end text-sm font-medium">Total produtos: {currency(totalProdutos)}</div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveInvoice} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Registrar Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
