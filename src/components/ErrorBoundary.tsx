import { Component, type ReactNode } from 'react';

/** Last-resort fallback so a render crash shows a message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[sarhad] render failed', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert" className="mx-auto flex max-w-md flex-col gap-4 p-4">
        <h1 className="sticker self-start text-2xl">Sarhad</h1>
        <p>Something went wrong. Your saved games are safe.</p>
        <button className="btn" onClick={() => location.reload()}>
          Reload
        </button>
      </main>
    );
  }
}
