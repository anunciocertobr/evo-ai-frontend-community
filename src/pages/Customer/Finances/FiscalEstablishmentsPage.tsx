import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  UploadCloud,
  FileCheck2,
  Building2,
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
import { apiErrorMessage } from '@/utils/apiHelpers';
import {
  FiscalEstablishment,
  FiscalEstablishmentFormData,
  FiscalAmbiente,
  SUPPORTED_MUNICIPIOS,
} from '@/types/fiscalInvoices';

const emptyForm: FiscalEstablishmentFormData = {
  municipio_ibge_code: '',
  municipio_nome: '',
  uf: '',
  inscricao_municipal: '',
  aliquota_iss_pct: 0,
  ambiente: 'homologacao',
  provider_key: 'guarulhos_gissonline',
  rps_serie: '1',
};

function certificateStatus(establishment: FiscalEstablishment): { label: string; variant: 'default' | 'destructive' | 'secondary' } {
  if (!establishment.configured) return { label: 'Sem certificado', variant: 'secondary' };
  if (!establishment.certificate_expires_at) return { label: 'Configurado', variant: 'default' };

  const expiresAt = new Date(establishment.certificate_expires_at);
  const daysLeft = Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: 'Certificado vencido', variant: 'destructive' };
  if (daysLeft <= 30) return { label: `Vence em ${daysLeft}d`, variant: 'destructive' };
  return { label: `Válido até ${expiresAt.toLocaleDateString('pt-BR')}`, variant: 'default' };
}

export default function FiscalEstablishmentsPage() {
  const [establishments, setEstablishments] = useState<FiscalEstablishment[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FiscalEstablishmentFormData>(emptyForm);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<FiscalEstablishment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadEstablishments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fiscalEstablishmentsService.list();
      setEstablishments(data);
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao carregar estabelecimentos fiscais.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEstablishments();
  }, [loadEstablishments]);

  const openCreateDialog = () => {
    setForm(emptyForm);
    setCertificateFile(null);
    setCertificatePassword('');
    setDialogOpen(true);
  };

  const handleMunicipioChange = (ibgeCode: string) => {
    const municipio = SUPPORTED_MUNICIPIOS.find((m) => m.ibge_code === ibgeCode);
    if (!municipio) return;
    setForm((prev) => ({
      ...prev,
      municipio_ibge_code: municipio.ibge_code,
      municipio_nome: municipio.nome,
      uf: municipio.uf,
      provider_key: municipio.provider_key || prev.provider_key,
    }));
  };

  const handleSave = async () => {
    if (!form.municipio_ibge_code) {
      toast.error('Selecione o município.');
      return;
    }
    if (!form.inscricao_municipal.trim()) {
      toast.error('Informe a inscrição municipal.');
      return;
    }
    setSaving(true);
    try {
      await fiscalEstablishmentsService.create(
        form,
        certificateFile || undefined,
        certificatePassword || undefined,
      );
      toast.success('Estabelecimento fiscal cadastrado com sucesso!');
      setDialogOpen(false);
      loadEstablishments();
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao salvar estabelecimento fiscal.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fiscalEstablishmentsService.remove(deleteTarget.id);
      toast.success('Estabelecimento removido.');
      setDeleteTarget(null);
      loadEstablishments();
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Não foi possível remover — verifique se não há notas emitidas por ele.');
    } finally {
      setDeleting(false);
    }
  };

  const pendingCities = SUPPORTED_MUNICIPIOS.filter((m) => !m.provider_key).map((m) => m.nome).join(', ');

  return (
    <div className="flex flex-col min-h-full bg-background p-6 space-y-6">
      <BaseHeader
        title="Emissores de NFS-e"
        subtitle="Cadastre o certificado digital A1 e a inscrição municipal de cada cidade onde você emite nota fiscal de serviço, direto com a prefeitura."
        primaryAction={{
          label: 'Novo estabelecimento',
          icon: <Plus className="w-4 h-4" />,
          onClick: openCreateDialog,
        }}
      />

      {pendingCities && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          Ainda sem suporte de emissão: {pendingCities} — cadastro fica disponível assim que a integração dessas cidades for implementada.
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando...
            </div>
          ) : establishments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Nenhum estabelecimento fiscal cadastrado ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Município</TableHead>
                  <TableHead>Inscrição Municipal</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Alíquota ISS</TableHead>
                  <TableHead>Certificado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {establishments.map((establishment) => {
                  const status = certificateStatus(establishment);
                  return (
                    <TableRow key={establishment.id}>
                      <TableCell className="font-medium">
                        {establishment.municipio_nome}/{establishment.uf}
                      </TableCell>
                      <TableCell>{establishment.inscricao_municipal}</TableCell>
                      <TableCell>
                        <Badge variant={establishment.ambiente === 'producao' ? 'default' : 'secondary'}>
                          {establishment.ambiente === 'producao' ? 'Produção' : 'Homologação'}
                        </Badge>
                      </TableCell>
                      <TableCell>{establishment.aliquota_iss_pct}%</TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="gap-1">
                          {establishment.configured ? (
                            <ShieldCheck className="w-3 h-3" />
                          ) : (
                            <ShieldAlert className="w-3 h-3" />
                          )}
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(establishment)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Pronto pra emitir notas? Vá para{' '}
        <Link to="/finances/nota-fiscal-servico" className="font-medium underline underline-offset-2">
          Nota Fiscal de Serviço
        </Link>
        .
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo estabelecimento fiscal</DialogTitle>
            <DialogDescription>
              O certificado digital A1 (.pfx/.p12) é obrigatório pra autenticar no webservice da prefeitura.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Município</Label>
              <Select value={form.municipio_ibge_code} onValueChange={handleMunicipioChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o município" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_MUNICIPIOS.map((municipio) => (
                    <SelectItem
                      key={municipio.ibge_code}
                      value={municipio.ibge_code}
                      disabled={!municipio.provider_key}
                    >
                      {municipio.nome}/{municipio.uf}
                      {!municipio.provider_key ? ' (em breve)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Inscrição Municipal</Label>
              <Input
                value={form.inscricao_municipal}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((prev) => ({ ...prev, inscricao_municipal: e.target.value }))
                }
                placeholder="Conforme consta no Cartão CNPJ / cadastro municipal"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Alíquota ISS (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.aliquota_iss_pct}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((prev) => ({ ...prev, aliquota_iss_pct: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Ambiente</Label>
                <Select
                  value={form.ambiente}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, ambiente: value as FiscalAmbiente }))}
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

            <div>
              <Label className="text-xs">Certificado Digital A1 (.pfx/.p12)</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                className="mt-1 rounded-lg border-2 border-dashed border-border p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition-colors"
              >
                {certificateFile ? (
                  <>
                    <FileCheck2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-sm truncate">{certificateFile.name}</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-5 h-5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground">Clique para selecionar o arquivo</span>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pfx,.p12"
                  className="hidden"
                  onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Senha do certificado</Label>
              <Input
                type="password"
                value={certificatePassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCertificatePassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover estabelecimento fiscal?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && `${deleteTarget.municipio_nome}/${deleteTarget.uf}`} — essa ação não pode ser
              desfeita. Notas já emitidas por ele não são afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
