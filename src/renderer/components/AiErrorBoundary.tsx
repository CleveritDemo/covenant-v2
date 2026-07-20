import React from 'react'

interface State { error: Error | null }

/**
 * ErrorBoundary alrededor del contenido del panel IA.
 * Sin esto, cualquier error de render en AiAssistantContent / AiAgentActionSegment
 * propaga hasta la raíz de React y desmonta toda la app (pantalla negra).
 */
export class AiErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[AiErrorBoundary] render error:', error, info.componentStack)
  }

  override render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="ai-error" role="alert">
          <span aria-hidden="true">!</span>
          <span>Error al renderizar la respuesta: {this.state.error.message}</span>
        </div>
      )
    }
    return this.props.children
  }
}
