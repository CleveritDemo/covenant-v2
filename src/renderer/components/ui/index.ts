/**
 * Design system UI kit.
 * Contrato: sin `className` ni estilos inline en props públicas.
 * Personalizar solo con props tipadas (variant, size, pressed, etc.).
 *
 * Button / Input / etc. cubren patrones estándar. Si un control es
 * visualmente distinto (p. ej. botón circular), crear un componente
 * nuevo con su CSS y props — no forzar Button ni parchear con className.
 */
export { Icon } from './Icon'
export type { IconName } from './Icon'

export { Button } from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button'

export { Toggle } from './Toggle'
export type { ToggleProps } from './Toggle'

export { Tooltip } from './Tooltip'
export type { TooltipProps } from './Tooltip'

export { Badge } from './Badge'
export type { BadgeProps, BadgeVariant } from './Badge'

export { Spinner } from './Spinner'
export type { SpinnerProps } from './Spinner'

export { Select } from './Select'
export type { SelectProps, SelectSize } from './Select'

export { Input } from './Input'
export type { InputProps, InputSize, InputVariant } from './Input'

export { TextArea } from './TextArea'
export type { TextAreaProps, TextAreaSize, TextAreaVariant } from './TextArea'

export { ChoiceCard } from './ChoiceCard'
export type { ChoiceCardProps } from './ChoiceCard'
