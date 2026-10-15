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
        <h1 className="text-2xl font-bold text-teal-800">Sarhad</h1>
        <p>Something went wrong. Your saved games are safe.</p>
        <button className="rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white" onClick={() => location.reload()}>
          Reload
        </button>
      </main>
    );
  }
}
