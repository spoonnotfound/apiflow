import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { LogEntry } from "@/types";
import {
  clearLogs as clearLogsCommand,
  getLogs as fetchLogs,
  updateTrayStatus,
} from "@/lib/proxy";
import { useProxyStore } from "./ProxyStoreContext";

interface MonitoringContextType {
  logs: LogEntry[];
  loadLogs: () => Promise<void>;
  clearLogs: () => Promise<void>;
  processingCount: number;
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (enabled: boolean) => void;
}

const MonitoringContext = createContext<MonitoringContextType | undefined>(undefined);

export function useMonitoring() {
  const context = useContext(MonitoringContext);
  if (!context) {
    throw new Error("useMonitoring must be used within a MonitoringProvider");
  }
  return context;
}

export function MonitoringProvider({ children }: { children: ReactNode }) {
  const { listenPort, isRunning } = useProxyStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const processingCount = logs.filter((log) => log.status === null).length;

  const loadLogs = useCallback(async () => {
    try {
      const entries = await fetchLogs(listenPort);
      setLogs(entries);
    } catch (err) {
      console.error(err);
    }
  }, [listenPort]);

  const clearLogs = async () => {
    try {
      await clearLogsCommand();
      setLogs([]);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (autoRefreshEnabled) {
      loadLogs();
    }
    const timer = setInterval(() => {
      if (isRunning && autoRefreshEnabled) {
        loadLogs();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [listenPort, isRunning, loadLogs, autoRefreshEnabled]);

  useEffect(() => {
    if (isRunning) {
      updateTrayStatus(true, listenPort, processingCount).catch(() => {});
    }
  }, [processingCount, isRunning, listenPort]);

  return (
    <MonitoringContext.Provider
      value={{
        logs,
        loadLogs,
        clearLogs,
        processingCount,
        autoRefreshEnabled,
        setAutoRefreshEnabled,
      }}
    >
      {children}
    </MonitoringContext.Provider>
  );
}
