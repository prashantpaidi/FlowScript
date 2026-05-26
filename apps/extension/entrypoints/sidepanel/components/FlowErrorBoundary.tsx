import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class FlowErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('FlowErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 text-center">
          <div className="bg-red-50 p-4 rounded-full mb-4">
            <AlertTriangle className="text-red-500" size={48} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-md">
            The flow canvas crashed, possibly due to corrupted node data.
            You can try to reset the view or switch to Code mode to fix the issue.
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-md"
            >
              <RefreshCcw size={16} />
              Reset Canvas
            </button>
          </div>
          {this.state.error && (
            <details className="mt-8 text-left max-w-2xl w-full">
              <summary className="text-[10px] text-gray-400 cursor-pointer uppercase tracking-widest font-bold">Error Details</summary>
              <pre className="mt-2 p-3 bg-gray-100 border border-gray-200 rounded text-[10px] text-red-600 overflow-auto max-h-40 font-mono">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
