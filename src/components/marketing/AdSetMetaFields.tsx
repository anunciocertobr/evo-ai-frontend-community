import { useEffect, useState } from 'react';
import { Button, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@evoapi/design-system';
import {
  CONVERSION_EVENTS,
  ConversionEvent,
  MENSAGEM_DESTINOS,
  MensagemDestino,
  ObjectiveKey,
  WhatsappNumberOption,
} from '@/services/marketing/metaAdsManagerService';
import {
  AdAccountPageOption,
  AdSetMetaValues,
  CONVERSA_DESCRICAO,
  CONVERSAO_DESCRICAO,
  conversaoTiposFor,
  AUDIENCE_NETWORK_POSITIONS,
  AUDIENCE_NETWORK_POSITION_OPTIONS,
  FACEBOOK_POSITIONS,
  FACEBOOK_POSITION_OPTIONS,
  INSTAGRAM_POSITIONS,
  INSTAGRAM_POSITION_OPTIONS,
  PLATFORM_OPTIONS,
  platformWithPositions,
} from '@/components/marketing/adSetMetaOptions';

const inputClass = 'bg-slate-700 border-slate-600 text-slate-200';

// Blocos do NÍVEL DO CONJUNTO. "Onde acontecem as conversões" vem primeiro —
// é o seletor principal (Formulário/WhatsApp/Site) — e "onde a conversa
// acontece" (o canal: WhatsApp/Messenger/Direct) só aparece aninhado dentro
// dela, quando o tipo escolhido é conversa por mensagem. Antes os dois blocos
// apareciam soltos e sempre juntos (a conversa vinha antes, incondicional,
// sempre que o objetivo permitia CONVERSATIONS) mesmo quando a pessoa tinha
// escolhido Formulário ou Site — pedido do usuário pra corrigir isso.
export function AdSetMetaFields({
  objectiveKey,
  pages,
  loadingPages,
  values,
  onChange,
  positions,
  onPositionsChange,
  whatsappNumbers,
  loadingWhatsappNumbers = false,
  requirePage = false,
}: {
  objectiveKey: ObjectiveKey | '' | null;
  pages: AdAccountPageOption[];
  loadingPages: boolean;
  values: AdSetMetaValues;
  onChange: (patch: Partial<AdSetMetaValues>) => void;
  positions?: { facebook: string[]; instagram: string[]; audienceNetwork?: string[] };
  onPositionsChange?: (patch: { facebook?: string[]; instagram?: string[]; audienceNetwork?: string[] }) => void;
  whatsappNumbers?: WhatsappNumberOption[];
  loadingWhatsappNumbers?: boolean;
  requirePage?: boolean;
}) {
  const [digitandoNumero, setDigitandoNumero] = useState(false);
  const selectedPage = pages.find((p) => p.id === values.pageId);
  const tiposConversao = conversaoTiposFor(objectiveKey);
  // Existe alguma meta de conversão liberada pro objetivo (formulário, conversa
  // ou site) além de "Nenhuma" — se não, o bloco inteiro nem aparece.
  const temConversao = tiposConversao.length > 1;
  const precisaNumero = values.conversaoTipo === 'WHATSAPP' && values.mensagemDestino === 'WHATSAPP';
  const numeros = whatsappNumbers ?? [];

  // A lista de números vem da conta; enquanto ela carrega, o campo fica em
  // modo digitação pra não sumir do formulário e não travar a tela.
  useEffect(() => {
    if (numeros.length > 0) setDigitandoNumero(false);
  }, [numeros.length]);

  return (
    <div className="space-y-4">
      {temConversao && (
        <div className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/30 p-3">
          <div>
            <Label className="text-xs text-slate-300 font-medium">Onde acontecem as conversões</Label>
            <p className="text-xs text-slate-500 mt-1">{CONVERSAO_DESCRICAO}</p>
          </div>
          <Select
            value={values.conversaoTipo}
            onValueChange={(v: string) => onChange({ conversaoTipo: v as AdSetMetaValues['conversaoTipo'] })}
          >
            <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
              {tiposConversao.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label} — {t.hint}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* "Onde a conversa acontece" só faz sentido — e só aparece — quando
              o tipo de conversão escolhido acima é conversa por mensagem
              (WhatsApp/Messenger/Direct), nunca pra Formulário ou Site. */}
          {values.conversaoTipo === 'WHATSAPP' && (
            <div className="space-y-3 rounded-md border border-sky-900/60 bg-sky-950/20 p-3">
              <div>
                <Label className="text-xs text-slate-300 font-medium">Onde a conversa acontece</Label>
                <p className="text-xs text-slate-500 mt-1">{CONVERSA_DESCRICAO}</p>
              </div>
              <Select
                value={values.mensagemDestino}
                onValueChange={(v: string) => {
                  const destinoEscolhido = v as MensagemDestino;
                  setDigitandoNumero(false);
                  onChange({
                    mensagemDestino: destinoEscolhido,
                    whatsappPhone: destinoEscolhido === 'WHATSAPP' ? values.whatsappPhone : '',
                  });
                }}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                  {MENSAGEM_DESTINOS.map((d) => (
                    <SelectItem
                      key={d.value}
                      value={d.value}
                      disabled={d.value === 'INSTAGRAM' && selectedPage ? !selectedPage.hasInstagram : false}
                    >
                      {d.label} — {d.hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {precisaNumero && (
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">Número de WhatsApp</Label>
                  {numeros.length > 0 && !digitandoNumero ? (
                    <>
                      <Select value={values.whatsappPhone} onValueChange={(v: string) => onChange({ whatsappPhone: v })}>
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                          <SelectValue placeholder={loadingWhatsappNumbers ? 'Buscando números da conta...' : 'Escolha o número'} />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                          {numeros.map((n) => (
                            <SelectItem key={n.phone_number} value={n.phone_number}>
                              {n.phone_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-slate-200"
                        onClick={() => setDigitandoNumero(true)}
                      >
                        Digitar outro número
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input
                        value={values.whatsappPhone}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ whatsappPhone: e.target.value })}
                        placeholder="5511999999999"
                        className={inputClass}
                      />
                      {numeros.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-slate-400 hover:text-slate-200"
                          onClick={() => setDigitandoNumero(false)}
                        >
                          Voltar para os números da conta
                        </Button>
                      )}
                    </>
                  )}
                  {loadingWhatsappNumbers && <p className="text-xs text-slate-500">Buscando os números que esta conta já usa...</p>}
                  {!loadingWhatsappNumbers && numeros.length === 0 && (
                    <p className="text-xs text-amber-400/80">
                      Esta conta ainda não tem nenhum conjunto de WhatsApp publicado, então não há número pra suggest. Digite
                      o número (com DDI e DDD, só números) habilitado no WhatsApp Business da página escolhida.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {values.conversaoTipo === 'SITE' && (
            <>
              <div>
                <Label className="text-xs text-slate-400">Local de conversão (site)</Label>
                <Input
                  value={values.conversionLocation}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ conversionLocation: e.target.value })}
                  placeholder="https://www.seusite.com.br"
                  className={inputClass}
                />
                <p className="text-xs text-slate-500 mt-1">
                  A Meta valida a URL e exige que o pixel do site esteja instalado para o evento escolhido.
                </p>
              </div>
              <div>
                <Label className="text-xs text-slate-400">Evento de conversão</Label>
                <Select
                  value={values.conversionEvent}
                  onValueChange={(v: string) => onChange({ conversionEvent: v as ConversionEvent })}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                    {CONVERSION_EVENTS.map((ev) => (
                      <SelectItem key={ev} value={ev}>
                        {ev}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {values.conversaoTipo === 'FORMULARIO' && (
            <p className="text-xs text-slate-500">
              O formulário é criado pelo próprio Meta e abre dentro do anúncio, sem destino extra. A Página precisa ter os
              Termos de Serviço de Geração de Cadastros aceitos — sem isso a Meta recusa o conjunto.
            </p>
          )}
        </div>
      )}

      <div>
        <Label className="text-xs text-slate-400">Página do Facebook</Label>
        <Select value={values.pageId || '__none__'} onValueChange={(v: string) => onChange({ pageId: v === '__none__' ? '' : v })}>
          <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
            <SelectValue
              placeholder={loadingPages ? 'Carregando páginas da conta...' : 'Escolha a página que vai veicular'}
            />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
            <SelectItem value="__none__">Somente leitura (usa a página conectada)</SelectItem>
            {pages.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
                {p.hasInstagram ? ' · com Instagram' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {requirePage && !values.pageId && (
          <p className="text-xs text-amber-400/80 mt-1">
            Sem página escolhida o anúncio sai na página conectada do sistema, que pode não ser a desta conta de anúncios.
          </p>
        )}
        {pages.length === 0 && !loadingPages && (
          <p className="text-xs text-amber-400/80 mt-1">
            Nenhuma página foi devolvida para esta conta de anúncios. Recarregue a lista ou escolha a conta de novo.
          </p>
        )}
        {values.pageId && !selectedPage && !loadingPages && pages.length > 0 && (
          <p className="text-xs text-amber-400/80 mt-1">A página escolhida não está mais entre as páginas desta conta.</p>
        )}
        {values.mensagemDestino === 'INSTAGRAM' && selectedPage && !selectedPage.hasInstagram && (
          <p className="text-xs text-amber-400/80 mt-1">
            Esta página não tem perfil profissional do Instagram ligado — o Direct não vai funcionar.
          </p>
        )}
      </div>

      {positions && onPositionsChange && (
        <div className="space-y-2">
          <Label className="text-xs text-slate-400 block">Posições</Label>
          {([
            { prefixo: 'FB', lista: FACEBOOK_POSITIONS, ativas: positions.facebook, campo: 'facebook' as const },
            { prefixo: 'IG', lista: INSTAGRAM_POSITIONS, ativas: positions.instagram, campo: 'instagram' as const },
            {
              prefixo: 'AN',
              lista: AUDIENCE_NETWORK_POSITIONS,
              ativas: positions.audienceNetwork ?? [],
              campo: 'audienceNetwork' as const,
            },
          ]).map((grupo) => (
            <div key={grupo.prefixo} className="flex flex-wrap gap-x-4 gap-y-2">
              {grupo.lista.map((p) => (
                <label key={p.value} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <Checkbox
                    checked={grupo.ativas.includes(p.value)}
                    onCheckedChange={() => {
                      const next = grupo.ativas.includes(p.value)
                        ? grupo.ativas.filter((v) => v !== p.value)
                        : [...grupo.ativas, p.value];
                      onPositionsChange({ [grupo.campo]: next });
                    }}
                  />
                  {grupo.prefixo} · {p.label}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Descrição do conjunto é campo do próprio conjunto na Meta (aparece na coluna
// "Descrição" do Gerenciador de Anúncios) — por isso mora aqui, junto dos
// outros campos do nível.
export function AdSetDescriptionField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <Label className="text-xs text-slate-400">Descrição do conjunto</Label>
      <Textarea
        value={value}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        rows={2}
        placeholder="Ex: Conversa no WhatsApp - página Anúncio Certo - 25 a 45 anos"
        className={inputClass}
      />
      <p className="text-xs text-slate-500 mt-1">Serve para identificar a página, a conversa e o público dentro do Gerenciador.</p>
    </div>
  );
}

// Escolha do tipo de orçamento do conjunto. A Meta exige data de término quando
// o orçamento é vitalício (erro 1487094: "Os conjuntos de anúncios que usam o
// orçamento vitalício devem ter uma data de término") e nunca aceita vitalício
// junto com CBO — por isso o campo some quando o orçamento está na campanha.
export type BudgetMode = 'DIARIO' | 'VITALICIO';

export function AdSetBudgetFields({
  mode,
  onModeChange,
  value,
  onValueChange,
  endDate,
  onEndDateChange,
  disabled = false,
  hint,
}: {
  mode: BudgetMode;
  onModeChange: (mode: BudgetMode) => void;
  value: string;
  onValueChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-slate-400">Orçamento do conjunto</Label>
      <div className="flex gap-3">
        {(['DIARIO', 'VITALICIO'] as BudgetMode[]).map((m) => (
          <label key={m} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="radio"
              name="budget-mode"
              checked={mode === m}
              disabled={disabled}
              onChange={() => onModeChange(m)}
              className="accent-sky-500"
            />
            {m === 'DIARIO' ? 'Diário' : 'Vitalício'}
          </label>
        ))}
      </div>
      <Input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onValueChange(e.target.value)}
        disabled={disabled}
        placeholder={mode === 'DIARIO' ? 'Ex: 50.00' : 'Valor total do período'}
        className={inputClass}
      />
      {mode === 'VITALICIO' && (
        <>
          <Input
            type="date"
            value={endDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onEndDateChange(e.target.value)}
            disabled={disabled}
            className={inputClass}
          />
          <p className="text-xs text-slate-500 mt-1">
            O vitalício é o valor TOTAL até a data final, e a Meta exige essa data (mínimo 24h à frente). Com o orçamento
            na campanha (CBO) só existe orçamento diário no conjunto.
          </p>
        </>
      )}
      {mode === 'DIARIO' && hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

// Plataforma + posições do conjunto, num bloco só. A Meta recusa
// `facebook_positions` com a plataforma Facebook desligada (e o inverso
// também), então os dois campos andam juntos: marcar a plataforma marca
// TODAS as posições dela e desligar a plataforma desliga todas.
// Padrão: tudo marcado, MENOS as posições de Audience Network.
export function AdSetPlatformPositionsFields({
  platforms,
  onPlatformsChange,
  positions,
  onPositionsChange,
}: {
  platforms: string[];
  onPlatformsChange: (platforms: string[]) => void;
  positions: { facebook: string[]; instagram: string[]; audienceNetwork: string[] };
  onPositionsChange: (patch: Partial<{ facebook: string[]; instagram: string[]; audienceNetwork: string[] }>) => void;
}) {
  const togglePlatform = (value: string) => {
    const ativando = !platforms.includes(value);
    onPlatformsChange(ativando ? [...platforms, value] : platforms.filter((p) => p !== value));
    const todas = platformWithPositions(value, ativando);
    if (value === 'facebook') onPositionsChange({ facebook: todas });
    if (value === 'instagram') onPositionsChange({ instagram: todas });
    if (value === 'audience_network') onPositionsChange({ audienceNetwork: todas });
  };

  const grupos = [
    { prefixo: 'FB', lista: FACEBOOK_POSITION_OPTIONS, ativas: positions.facebook, campo: 'facebook' as const },
    { prefixo: 'IG', lista: INSTAGRAM_POSITION_OPTIONS, ativas: positions.instagram, campo: 'instagram' as const },
    { prefixo: 'AN', lista: AUDIENCE_NETWORK_POSITION_OPTIONS, ativas: positions.audienceNetwork, campo: 'audienceNetwork' as const },
  ];

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-slate-400 block mb-2">Plataformas</Label>
        <div className="flex flex-wrap gap-4">
          {PLATFORM_OPTIONS.map((p) => (
            <label key={p.value} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <Checkbox checked={platforms.includes(p.value)} onCheckedChange={() => togglePlatform(p.value)} />
              {p.label}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-slate-400 block">Posições</Label>
        {grupos.map((grupo) => (
          <div key={grupo.prefixo} className="flex flex-wrap gap-x-4 gap-y-2">
            {grupo.lista.map((p) => (
              <label key={p.value} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <Checkbox
                  checked={grupo.ativas.includes(p.value)}
                  onCheckedChange={() =>
                    onPositionsChange({
                      [grupo.campo]: grupo.ativas.includes(p.value)
                        ? grupo.ativas.filter((v) => v !== p.value)
                        : [...grupo.ativas, p.value],
                    })
                  }
                />
                {grupo.prefixo} · {p.label}
              </label>
            ))}
          </div>
        ))}
        <p className="text-xs text-slate-500">
          Todas as posições vêm marcadas, menos as de Audience Network. Ao marcar a plataforma Audience Network, as posições dela são marcadas
          automaticamente.
        </p>
      </div>
    </div>
  );
}
