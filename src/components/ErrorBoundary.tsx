import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  componentDidMount() {
    window.addEventListener('error', this.handleGlobalError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.handleGlobalError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  handleGlobalError = (event: ErrorEvent) => {
    // Ignore benign Vite/WebSocket errors
    const message = event.message || (event.error && event.error.message) || "";
    if (message.includes('[vite]') || message.includes('WebSocket')) {
      return;
    }
    this.setState({ hasError: true, error: event.error });
  };

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    // Ignore benign Vite/WebSocket rejections
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    if (message.includes('[vite]') || message.includes('WebSocket')) {
      return;
    }
    this.setState({ hasError: true, error: event.reason instanceof Error ? event.reason : new Error(String(event.reason)) });
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Произошла непредвиденная ошибка.";
      let isPermissionError = false;

      if (this.state.error?.message) {
        try {
          const errorInfo = JSON.parse(this.state.error.message);
          if (errorInfo.error && errorInfo.error.includes("Missing or insufficient permissions")) {
            isPermissionError = true;
            if (!errorInfo.authInfo.userId) {
              // User is logged out, this is a benign error from a stale listener
              window.location.href = '/login';
              return null;
            } else {
              errorMessage = "У вас нет прав для выполнения этой операции. Пожалуйста, обратитесь к администратору.";
            }
          } else if (errorInfo.error) {
            errorMessage = errorInfo.error;
          }
        } catch (e) {
          errorMessage = this.state.error.message;
        }
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-brand-black p-4">
          <div className="bg-[#111] p-8 rounded-3xl shadow-sm border border-zinc-800/50 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-brand-white mb-2">Упс, что-то пошло не так</h2>
            <p className="text-zinc-400 mb-6">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-brand-white text-brand-black py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
