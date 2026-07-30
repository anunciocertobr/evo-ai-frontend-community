interface AgentToggleProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * Toggle do detalhe do agente: trilho 42×24 + knob 18px deslocado por `left`
 * (3px → 21px), conforme o protótipo.
 *
 * NÃO usa o `Switch` do design-system: ele é 32×18.4 com o root em `rem`, e o
 * `Thumb` tem className HARDCODED (não aceita override), então knob e
 * deslocamento seriam inalcançáveis por fora. O caminho é o sancionado pela
 * spec — checkbox nativo oculto (mantém estado de form e teclado) com todo o
 * estilo no <label> que o envolve, sem `appearance` no checkbox.
 *
 * Medidas em px arbitrário de propósito: as escalas do Tailwind (h-6) compilam
 * para rem, e o toggle não deve escalar com a tipografia.
 */
const AgentToggle = ({
  id,
  checked,
  onCheckedChange,
  disabled = false,
  'aria-label': ariaLabel,
}: AgentToggleProps) => (
  <label
    className={`relative block h-[24px] w-[42px] flex-[0_0_42px] rounded-full transition-colors duration-[160ms] ${
      checked ? 'bg-[#359558]' : 'bg-[#D4D9DF]'
    } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
  >
    <input
      id={id}
      type="checkbox"
      role="switch"
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      onChange={event => onCheckedChange(event.target.checked)}
      className="pointer-events-none absolute h-0 w-0 opacity-0"
    />
    <span
      aria-hidden="true"
      className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[left] duration-[160ms] ${
        checked ? 'left-[21px]' : 'left-[3px]'
      }`}
    />
  </label>
);

export default AgentToggle;
