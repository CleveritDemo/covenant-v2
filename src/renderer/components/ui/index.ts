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

export { BrandIcon } from './BrandIcon'

export { AgentFace } from './AgentFace'
export type { AgentFaceProps } from './AgentFace'

export { CoordinationBadge, COORDINATION_ICON } from './CoordinationBadge'
export type { CoordinationBadgeProps } from './CoordinationBadge'

export { Button } from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button'

export { Toggle } from './Toggle'
export type { ToggleProps } from './Toggle'

export { Tooltip } from './Tooltip'
export type { TooltipProps } from './Tooltip'

export { Badge } from './Badge'
export type { BadgeProps, BadgeVariant } from './Badge'

export { IssueSourceBadge } from './IssueSourceBadge'
export type { IssueSourceBadgeProps } from './IssueSourceBadge'

export { Spinner } from './Spinner'
export type { SpinnerProps } from './Spinner'

export { Skeleton } from './Skeleton'
export type { SkeletonProps } from './Skeleton'

export { Select } from './Select'
export type { SelectProps, SelectSize } from './Select'

export { Input } from './Input'
export type { InputProps, InputSize, InputVariant } from './Input'

export { TextArea } from './TextArea'
export type { TextAreaProps, TextAreaSize, TextAreaVariant } from './TextArea'

export { ChoiceCard } from './ChoiceCard'
export type { ChoiceCardProps } from './ChoiceCard'

export { OptionRow } from './OptionRow'
export type { OptionRowProps } from './OptionRow'

export { SegmentedControl } from './SegmentedControl'
export type {
  SegmentedControlProps,
  SegmentedControlOption,
} from './SegmentedControl'

export { SettingToggle } from './SettingToggle'
export type { SettingToggleProps } from './SettingToggle'

export { ContextCheckOption } from './ContextCheckOption'
export type { ContextCheckOptionProps } from './ContextCheckOption'

export { WindowControls } from './WindowControls'
export type { WindowControlsProps, WindowControlsSize } from './WindowControls'

export { PlaneBusyDot } from './PlaneBusyDot'
export type {
  PlaneBusyDotProps,
  PlaneBusyDotPlacement,
  PlaneBusyDotSize,
  PlaneBusyDotVariant,
} from './PlaneBusyDot'

export { JumpToLatestButton } from './JumpToLatestButton'
export type {
  JumpToLatestButtonProps,
  JumpToLatestButtonShape,
} from './JumpToLatestButton'
