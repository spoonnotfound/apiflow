import React from "react";
import ReactDOM from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import App from "./App";

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-100">
      <div className="max-w-md rounded-xl border bg-white p-6 shadow-lg">
        <h2 className="mb-2 text-lg font-semibold text-red-600">应用出错了</h2>
        <p className="mb-4 text-sm text-slate-600">{error.message}</p>
        <button
          onClick={resetErrorBoundary}
          className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600"
        >
          重试
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
