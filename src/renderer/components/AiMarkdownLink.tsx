import React, { useState } from 'react'
import { useT } from '@i18n/useT'
import { Tooltip } from './ui/Tooltip'

interface AiMarkdownLinkProps {
  href: string
  label: React.ReactNode
}

function openMarkdownExternalUrl(e: React.MouseEvent<HTMLAnchorElement>, href: string): void {
  e.preventDefault()
  e.stopPropagation()
  void window.api?.openExternalUrl(href).then(r => {
    if (r && !r.ok) console.warn('[openExternalUrl]', r.error)
  })
}

export const AiMarkdownLink: React.FC<AiMarkdownLinkProps> = ({ href, label }) => {
  const { t } = useT()
  const [copied, setCopied] = useState(false)

  function handleCopy(event: React.MouseEvent<HTMLButtonElement>): void {
    event.preventDefault()
    event.stopPropagation()
    void navigator.clipboard.writeText(href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <span className="ai-md__link-wrap">
      <a
        className="ai-md__link"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => openMarkdownExternalUrl(e, href)}
        onAuxClick={e => {
          if (e.button === 1) openMarkdownExternalUrl(e, href)
        }}
      >
        {label}
      </a>
      <Tooltip content={href}>
        <button
          type="button"
          className="ai-md__link-copy"
          aria-label={t('aiCodeBlock.copyLinkLabel')}
          onClick={handleCopy}
        >
          {copied ? '✓' : '⧉'}
        </button>
      </Tooltip>
    </span>
  )
}
