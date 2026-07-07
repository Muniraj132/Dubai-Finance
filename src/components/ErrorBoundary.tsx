import { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Catches render/lazy-chunk-load errors that would otherwise leave the user
// staring at a blank white screen — most commonly a stale tab hitting a
// deleted chunk right after a new deploy.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    console.error('Unhandled error in app:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-main flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <AlertTriangle size={32} className="text-red-500 mx-auto mb-3" />
            <div className="text-primary font-semibold mb-1">Something went wrong</div>
            <div className="text-sm text-muted mb-4">
              Try reloading the page. If a new version was just deployed, this usually fixes it.
            </div>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
