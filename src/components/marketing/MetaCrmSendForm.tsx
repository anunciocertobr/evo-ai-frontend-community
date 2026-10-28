import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, Plus, Send, Trash2 } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@evoapi/design-system';
import { metaLeadPageSettingsService } from '@/services/admin/metaLeadPageSettingsService';
import { metaLeadFormsService } from '@/services/admin/metaLeadFormsService';
import {
  metaConversionLeadsService,
  MetaCrmCustomData,
  MetaCrmUserData,
  SendToMetaCrmResult,
} from '@/services/admin/metaConversionLeadsService';

// Mesmo catálogo de Meta::ConversionsApiService::STANDARD_EVENTS no backend
// — a Meta não exige um conjunto fixo pro Conversion Leads, mas restringir
// ao catálogo padrão evita erro de digitação (pedido do usuário: "coloca
// pra selecionar os eventos padrao").
const STANDARD_EVENTS = ['Lead', 'Purchase', 'Contact', 'Schedule', 'SubmitApplication', 'CompleteRegistration', 'Message'];

const ACTION_SOURCES = [
  ['system_generated', 'Gerado pelo sistema'],
  ['website', 'Site'],
  ['email', 'E-mail'],
  ['phone_call', 'Ligação'],
  ['chat', 'Chat'],
  ['physical_store', 'Loja física'],
  ['other', 'Outro'],
];

const OTHER_DATASET = '__other__';

// Campos de "Dados do Cliente" (user_data) — texto puro aqui, o backend
// aplica o hash SHA256 nos que a Meta exige (em/ph/fn/ln/ge/db/ct/st/zp/
// country/external_id). Baseado no Payload Helper oficial da Conversions API.
// Telefone/nome primeiro: é o que o lead do Meta quase sempre traz
// preenchido; e-mail é mais raro (pedido do usuário).
const USER_DATA_FIELDS: Array<{ key: keyof MetaCrmUserData; label: string; placeholder?: string }> = [
  { key: 'ph', label: 'Telefone' },
  { key: 'fn', label: 'Nome' },
  { key: 'em', label: 'E-mail' },
  { key: 'ln', label: 'Sobrenome' },
  { key: 'ge', label: 'Gênero (m/f)' },
  { key: 'db', label: 'Nascimento (AAAAMMDD)', placeholder: '19900115' },
  { key: 'ct', label: 'Cidade' },
  { key: 'st', label: 'Estado (UF)' },
  { key: 'zp', label: 'CEP' },
  { key: 'country', label: 'País', placeholder: 'br' },
  { key: 'external_id', label: 'ID do cliente (seu sistema)' },
  { key: 'client_ip_address', label: 'IP do cliente' },
  { key: 'client_user_agent', label: 'User agent' },
  { key: 'fbc', label: 'Cookie _fbc' },
  { key: 'fbp', label: 'Cookie _fbp' },
];

// Campos de "Dados do Produto/Pedido" (custom_data) — nunca hasheado.
const CUSTOM_DATA_FIELDS: Array<{ key: keyof MetaCrmCustomData; label: string; placeholder?: string }> = [
  { key: 'currency', label: 'Moeda', placeholder: 'BRL' },
  { key: 'value', label: 'Valor', placeholder: '142.52' },
  { key: 'content_name', label: 'Nome do produto/conteúdo' },
  { key: 'content_category', label: 'Categoria' },
  { key: 'content_type', label: 'Tipo (product/product_group)' },
  { key: 'order_id', label: 'ID do pedido' },
  { key: 'num_items', label: 'Quantidade de itens' },
  { key: 'search_string', label: 'Termo buscado' },
  { key: 'status', label: 'Status do pedido' },
  { key: 'delivery_category', label: 'Categoria de entrega' },
  { key: 'predicted_ltv', label: 'LTV previsto' },
];

interface Props {
  leadgenId: string;
  pageId: string;
  initialEmail?: string | null;
  initialPhone?: string | null;
  initialName?: string | null;
  adId?: string | null;
}

// Formulário de envio manual, único, pro Conversion Leads da Meta — nunca
// grava nada no CRM (nem o payload mandado, nem o resultado), cada clique
// em "Enviar" é uma chamada isolada à Graph API (ver
// Meta::ConversionsApiCrmService#send_manual_event). Schema completo de
// user_data/custom_data da Conversions API, agrupado em "Dados do Cliente"
// e "Dados do Produto/Pedido" — pedido do usuário, baseado no Payload
// Helper oficial da Meta.
export function MetaCrmSendForm({ leadgenId, pageId, initialEmail, initialPhone, initialName, adId }: Props) {
  const [userData, setUserData] = useState<MetaCrmUserData>({});
  const [customData, setCustomData] = useState<MetaCrmCustomData>({});
  const [eventName, setEventName] = useState('Lead');
  const [actionSource, setActionSource] = useState('system_generated');
  const [datasetIds, setDatasetIds] = useState<string[]>(['']);
  // Pixels/datasets da conta de anúncios de onde ESTE lead veio (via
  // adId, GET /meta_lead_submissions/pixels_for_ad) — pedido do usuário:
  // "deve listar os relacionados àquela conta de anúncios que o lead
  // veio", em vez de uma lista fixa configurada manualmente antes. Sem
  // adId (raro — lead sem anúncio vinculado), cai pro que já foi
  // configurado manualmente alguma vez (metaLeadPageSettingsService).
  const [adPixels, setAdPixels] = useState<Array<{ id: string; name: string }>>([]);
  // Dataset(s) digitado(s) manualmente (fora da lista conhecida) — linha
  // mostra Input em vez de Select enquanto estiver marcado 'other' aqui.
  const [customDatasetIndexes, setCustomDatasetIndexes] = useState<Set<number>>(new Set());
  const [openCustomer, setOpenCustomer] = useState(true);
  const [openProduct, setOpenProduct] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<SendToMetaCrmResult[] | null>(null);

  useEffect(() => {
    // país quase sempre BR e moeda quase sempre BRL pra essa conta — pré-
    // preenche os dois (valor de verdade, não só placeholder) pra economizar
    // digitação; o usuário ainda pode apagar/trocar se for o caso.
    setUserData({ em: initialEmail || undefined, ph: initialPhone || undefined, fn: initialName || undefined, country: 'br' });
    setCustomData({ currency: 'BRL' });
    setEventName('Lead');
    setActionSource('system_generated');
    setDatasetIds(['']);
    setCustomDatasetIndexes(new Set());
    setSendResults(null);
    setAdPixels([]);

    if (adId) {
      metaLeadFormsService
        .pixelsForAd(adId)
        .then((pixels) => {
          setAdPixels(pixels);
          // Conta com 1 pixel só (o mais comum): pré-seleciona sozinho em
          // vez de deixar o usuário escolher entre uma lista de 1 item.
          if (pixels.length === 1) setDatasetIds([pixels[0].id]);
        })
        .catch(() => setAdPixels([]));
    } else {
      metaLeadPageSettingsService
        .listKnownDatasetIds()
        .then((ids) => setAdPixels(ids.map((id) => ({ id, name: id }))))
        .catch(() => setAdPixels([]));
    }
    if (pageId) {
      metaLeadPageSettingsService
        .get(pageId)
        .then((settings) => {
          if (settings.dataset_ids.length > 0) setDatasetIds(settings.dataset_ids);
        })
        .catch(() => undefined);
    }
  }, [leadgenId, pageId, initialEmail, initialPhone, initialName, adId]);

  const updateDatasetId = (index: number, value: string) => {
    setDatasetIds((prev) => prev.map((d, i) => (i === index ? value : d)));
  };
  const addDatasetId = () => setDatasetIds((prev) => [...prev, '']);
  const removeDatasetId = (index: number) => setDatasetIds((prev) => prev.filter((_, i) => i !== index));

  const handleSendToMeta = async () => {
    const validDatasetIds = datasetIds.map((d) => d.trim()).filter(Boolean);
    if (validDatasetIds.length === 0) {
      toast.error('Informe ao menos um dataset.');
      return;
    }
    setSending(true);
    setSendResults(null);
    try {
      const results = await metaConversionLeadsService.sendToMetaCrm({
        leadgen_id: leadgenId,
        dataset_ids: validDatasetIds,
        event_name: eventName.trim() || 'Lead',
        action_source: actionSource,
        user_data: userData,
        custom_data: customData,
      });
      setSendResults(results);
    } catch {
      toast.error('Falha ao enviar pro Meta.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <p className="text-sm font-medium">Enviar pro Meta (Conversion Leads)</p>
      <p className="text-xs text-muted-foreground">
        Preencha e aperte Enviar — manda na hora, não salva nada no CRM.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Nome do evento</Label>
          <Select value={eventName} onValueChange={setEventName}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STANDARD_EVENTS.map((ev) => (
                <SelectItem key={ev} value={ev}>
                  {ev}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Origem da ação</Label>
          <Select value={actionSource} onValueChange={setActionSource}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_SOURCES.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Collapsible open={openCustomer} onOpenChange={setOpenCustomer}>
        <CollapsibleTrigger asChild>
          <button type="button" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openCustomer ? 'rotate-180' : ''}`} />
            Dados do cliente
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="grid grid-cols-2 gap-2">
            {USER_DATA_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  value={userData[f.key] || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserData((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder || 'opcional'}
                />
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={openProduct} onOpenChange={setOpenProduct}>
        <CollapsibleTrigger asChild>
          <button type="button" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openProduct ? 'rotate-180' : ''}`} />
            Dados do produto/pedido
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="grid grid-cols-2 gap-2">
            {CUSTOM_DATA_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  value={customData[f.key] || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomData((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder || 'opcional'}
                />
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="space-y-1.5">
        <Label className="text-xs">Dataset(s)</Label>
        {datasetIds.map((d, index) => (
          <div key={index} className="flex items-center gap-2">
            {customDatasetIndexes.has(index) ? (
              <Input
                value={d}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateDatasetId(index, e.target.value)}
                placeholder="ID do dataset (Events Manager > Conversion Leads)"
              />
            ) : (
              <Select
                value={d || undefined}
                onValueChange={(v) => {
                  if (v === OTHER_DATASET) {
                    setCustomDatasetIndexes((prev) => new Set(prev).add(index));
                    updateDatasetId(index, '');
                  } else {
                    updateDatasetId(index, v);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o dataset..." />
                </SelectTrigger>
                <SelectContent>
                  {adPixels.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name !== p.id ? `${p.name} (${p.id})` : p.id}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER_DATASET}>Outro (digitar ID)</SelectItem>
                </SelectContent>
              </Select>
            )}
            {datasetIds.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => removeDatasetId(index)} className="shrink-0 text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addDatasetId} className="w-full">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar dataset
        </Button>
      </div>

      <Button onClick={handleSendToMeta} disabled={sending} className="w-full">
        <Send className="w-4 h-4 mr-1.5" /> {sending ? 'Enviando...' : 'Enviar pro Meta'}
      </Button>

      {sendResults && (
        <div className="space-y-1.5">
          {sendResults.map((r, i) => (
            <Alert key={i} variant={r.success ? 'default' : 'destructive'} className="py-2">
              <AlertDescription className="text-xs">
                <span className="font-mono">{r.dataset_id}</span>: {r.success ? 'Enviado com sucesso' : r.error}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}
