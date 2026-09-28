import { Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@evoapi/design-system';
import { CONVERSION_EVENTS, ConversionEvent, MENSAGEM_DESTINOS, MensagemDestino } from '@/services/marketing/metaAdsManagerService';
import {
  AdAccountPageOption,
  AdSetMetaValues,
  destinoKindFor,
  FACEBOOK_POSITIONS,
  INSTAGRAM_POSITIONS,
} from '@/components/marketing/adSetMetaOptions';

const inputClass = 'bg-slate-700 border-slate-600 text-slate-200';

export function AdSetMetaFields({
  optimizationGoal,
  pages,
  loadingPages,
  values,
  onChange,
  positions,
  onPositionsChange,
  requirePage = false,
}: {
  optimizationGoal: string | undefined | null;
  pages: AdAccountPageOption[];
  loadingPages: boolean;
  values: AdSetMetaValues;
  onChange: (patch: Partial<AdSetMetaValues>) => void;
  positions?: { facebook: string[]; instagram: string[] };
  onPositionsChange?: (patch: { facebook?: string[]; instagram?: string[] }) => void;
  requirePage?: boolean;
}) {
  const kind = destinoKindFor(optimizationGoal);
  const selectedPage = pages.find((p) => p.id === values.pageId);
  const destino = MENSAGEM_DESTINOS.find((d) => d.value === values.mensagemDestino) ?? MENSAGEM_DESTINOS[0];

  return (
    <div className="space-y-4">
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
        {values.pageId && !selectedPage && !loadingPages && (
          <p className="text-xs text-amber-400/80 mt-1">A página escolhida não está mais entre as páginas desta conta.</p>
        )}
        {kind === 'mensagem' && values.mensagemDestino === 'INSTAGRAM' && selectedPage && !selectedPage.hasInstagram && (
          <p className="text-xs text-amber-400/80 mt-1">
            Esta página não tem perfil profissional do Instagram ligado — o Direct não vai funcionar.
          </p>
        )}
      </div>

      {kind === 'mensagem' && (
        <div className="space-y-3 rounded-md border border-slate-700/70 p-3 bg-slate-900/30">
          <Label className="text-xs text-slate-400">Onde a conversa acontece</Label>
          <Select
            value={values.mensagemDestino}
            onValueChange={(v: string) => onChange({ mensagemDestino: v as MensagemDestino })}
          >
            <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
              {MENSAGEM_DESTINOS.map((d) => (
                <SelectItem key={d.value} value={d.value} disabled={d.value === 'INSTAGRAM' && selectedPage && !selectedPage.hasInstagram}>
                  {d.label} — {d.hint}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {destino.needsPhone && (
            <div>
              <Label className="text-xs text-slate-400">Número de WhatsApp (com DDD)</Label>
              <Input
                value={values.whatsappPhone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ whatsappPhone: e.target.value })}
                placeholder="5511999999999"
                className={inputClass}
              />
              <p className="text-xs text-slate-500 mt-1">
                Precisa ser um número habilitado no WhatsApp Business da página escolhida.
              </p>
            </div>
          )}
        </div>
      )}

      {kind === 'conversao' && (
        <div className="space-y-3 rounded-md border border-slate-700/70 p-3 bg-slate-900/30">
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
        </div>
      )}

      {kind === 'formulario' && (
        <p className="text-xs text-slate-500 rounded-md border border-slate-700/70 p-3 bg-slate-900/30">
          Objetivo de lead usa formulário instantâneo: o formulário abre dentro do próprio anúncio, sem destino extra para
          escolher.
        </p>
      )}

      {positions && onPositionsChange && (
        <div className="space-y-2">
          <Label className="text-xs text-slate-400 block">Posições</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {FACEBOOK_POSITIONS.map((p) => (
              <label key={p.value} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <Checkbox
                  checked={positions.facebook.includes(p.value)}
                  onCheckedChange={() => {
                    const next = positions.facebook.includes(p.value)
                      ? positions.facebook.filter((v) => v !== p.value)
                      : [...positions.facebook, p.value];
                    onPositionsChange({ facebook: next.length ? next : ['feed'] });
                  }}
                />
                FB · {p.label}
              </label>
            ))}
            {INSTAGRAM_POSITIONS.map((p) => (
              <label key={p.value} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <Checkbox
                  checked={positions.instagram.includes(p.value)}
                  onCheckedChange={() => {
                    const next = positions.instagram.includes(p.value)
                      ? positions.instagram.filter((v) => v !== p.value)
                      : [...positions.instagram, p.value];
                    onPositionsChange({ instagram: next.length ? next : ['feed'] });
                  }}
                />
                IG · {p.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Ao menos uma posição por plataforma marcada precisa continuar ligada, senão a Meta usa o padrão.
          </p>
        </div>
      )}
    </div>
  );
}
