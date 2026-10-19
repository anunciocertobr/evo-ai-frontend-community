import { Checkbox, Label } from '@evoapi/design-system';
import {
  ALL_NOTIFY_CONTENT_SECTIONS,
  NOTIFY_CONTENT_GROUPS,
} from './notifyContentSections';

interface Props {
  // null = nunca configurado (envia tudo no backend). Array = escolha explícita
  // (inclusive vazio = só o cabeçalho com formulário/data).
  value: string[] | null;
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

// Checkboxes de "o que deve ser enviado" na notificação de lead — mesma
// preferência por formulário (LeadFormNotifySettingsDialog) e no padrão da
// conta (MetaLeadsNotifyDefaultDialog). O cabeçalho (🔔 + Formulário + Data)
// sempre vai; aqui só se escolhe o resto.
export function NotifyContentEditor({ value, onChange, disabled }: Props) {
  const selected = value ?? ALL_NOTIFY_CONTENT_SECTIONS;

  const toggle = (key: string, checked: boolean) => {
    const next = checked ? [...selected, key] : selected.filter((k) => k !== key);
    // Mantém a ordem canônica pra ficar previsível no payload.
    onChange(ALL_NOTIFY_CONTENT_SECTIONS.filter((k) => next.includes(k)));
  };

  const toggleGroup = (groupKeys: string[], checked: boolean) => {
    const next = checked
      ? [...new Set([...selected, ...groupKeys])]
      : selected.filter((k) => !groupKeys.includes(k));
    onChange(ALL_NOTIFY_CONTENT_SECTIONS.filter((k) => next.includes(k)));
  };

  const allChecked = ALL_NOTIFY_CONTENT_SECTIONS.every((k) => selected.includes(k));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">O que enviar na mensagem</Label>
        <button
          type="button"
          className="text-xs text-primary underline-offset-2 hover:underline disabled:opacity-50"
          disabled={disabled}
          onClick={() => onChange(allChecked ? [] : [...ALL_NOTIFY_CONTENT_SECTIONS])}
        >
          {allChecked ? 'Desmarcar tudo' : 'Marcar tudo'}
        </button>
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        {NOTIFY_CONTENT_GROUPS.map((group) => {
          const groupKeys = group.sections.map((s) => s.key);
          const groupChecked = groupKeys.every((k) => selected.includes(k));
          return (
            <div key={group.title} className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={groupChecked}
                  disabled={disabled}
                  onCheckedChange={(c) => toggleGroup(groupKeys, c === true)}
                />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </span>
              </label>
              <div className="ml-6 space-y-1.5">
                {group.sections.map((section) => (
                  <label key={section.key} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selected.includes(section.key)}
                      disabled={disabled}
                      onCheckedChange={(c) => toggle(section.key, c === true)}
                    />
                    <span className="text-sm">{section.label}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        O cabeçalho com o formulário e a data vai sempre. Desmarcar uma seção só remove esses dados da
        mensagem.
      </p>
    </div>
  );
}
