import React from 'react'
import './FileExplorer.css'

export type ExplorerToolButtonVariant = 'default' | 'close'

export interface ExplorerToolButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ExplorerToolButtonVariant
  children?: React.ReactNode
}

export const ExplorerToolButton: React.FC<ExplorerToolButtonProps> = ({
  variant = 'default',
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    className={[
      'file-explorer-tree__tool-btn',
      variant === 'close' ? 'file-explorer-tree__tool-btn--close' : '',
    ].filter(Boolean).join(' ')}
    {...rest}
  >
    {children}
  </button>
)
