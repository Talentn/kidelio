import React from 'react'

type Props = { children: React.ReactNode }
type State = { error: Error | null }

export class RouteErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Kidelio] Page error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page-wrap py-16 text-center">
          <h1 className="font-display font-semibold text-xl mb-3">Une erreur est survenue</h1>
          <p className="text-gray-500 text-sm mb-6">La page n&apos;a pas pu se charger correctement.</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => window.location.reload()}
          >
            Recharger la page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
