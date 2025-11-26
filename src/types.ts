import type {
  NetworkInfo as BackendNetworkInfo,
  ProxyConfig,
  ProxyLogEntry,
} from "./types/backend";

export type LogEntry = ProxyLogEntry;

export type ServiceConfig = {
  id: string;
  name: string;
  basePath: string;
  enabled: boolean;
};

export type UpstreamConfig = {
  id: string;
  label: string;
  upstreamBase: string;
  apiKey: string;
  enabled: boolean;
};

export type RouteLink = {
  id: string;
  upstreamId: string;
  enabled: boolean;
  priority: number;
};

export type TabKey = "config" | "providers" | "settings" | "logs";

export type PersistedConfig = ProxyConfig;

export type NetworkInfo = BackendNetworkInfo;
