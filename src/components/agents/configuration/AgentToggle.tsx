interface AgentToggleProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * Não usa o `Switch` do design-system: ele é 32×18.4 e o `Thumb` tem className
 * hardcoded, então o tamanho do knob seria inalcançável por fora. Aqui é checkbox
 * nativo oculto (mantém estado de form e teclado) com o estilo todo no <label>.
 *
 * Medidas em px arbitrário: as escalas do Tailwind compilam para rem e o toggle
 * escalaria com a tipografia. O anel de foco fica no <label> via `focus-within`
 * porque o checkbox é invisível.
 */
const AgentToggle = ({
  id,
  checked,
  onCheckedChange,
  disabled = false,
  'aria-label': ariaLabel,
}: AgentToggleProps) => (
  <label
    className={`relative block h-[24px] w-[42px] flex-[0_0_42px] rounded-full transition-colors duration-[160ms] focus-within:ring-[3px] focus-within:ring-[#359558]/[.35] ${
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
