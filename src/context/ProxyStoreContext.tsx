import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import {
  ServiceConfig,
  UpstreamConfig,
  RouteLink,
  PersistedConfig
} from "@/types";
import { makeId, resequenceLinks } from "@/lib/utils";
import {
  loadSettings as loadSettingsCmd,
  saveSettings as saveSettingsCmd,
  startProxy,
  reloadProxy,
  stopProxy,
  updateTrayStatus,
} from "@/lib/proxy";

interface ProxyStoreContextType {
  // State
  listenPort: number;
  setListenPort: (port: number) => void;
  globalKey: string;
  setGlobalKey: (key: string) => void;
  proxyUrl: string;
  setProxyUrl: (url: string) => void;

  services: ServiceConfig[];
  setServices: React.Dispatch<React.SetStateAction<ServiceConfig[]>>;

  upstreams: UpstreamConfig[];
  setUpstreams: React.Dispatch<React.SetStateAction<UpstreamConfig[]>>;

  routes: Record<string, RouteLink[]>;
  setRoutes: React.Dispatch<React.SetStateAction<Record<string, RouteLink[]>>>;

  isRunning: boolean;
  globalBusy: boolean;
  reloadGateway: () => Promise<void>;

  // Actions
  startGateway: () => Promise<void>;
  stopGateway: () => Promise<void>;
}

const ProxyStoreContext = createContext<ProxyStoreContextType | undefined>(undefined);

export function useProxyStore() {
  const context = useContext(ProxyStoreContext);
  if (!context) {
    throw new Error("useProxyStore must be used within a ProxyStoreProvider");
  }
  return context;
}

const defaultService = (): ServiceConfig => ({
  id: makeId(),
  name: "默认服务",
  basePath: "/",
  enabled: true,
});

export function ProxyStoreProvider({ children }: { children: ReactNode }) {
  const [listenPort, setListenPort] = useState(23333);
  const [globalKey, setGlobalKey] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  
  const [services, setServices] = useState<ServiceConfig[]>([defaultService()]);
  const [upstreams, setUpstreams] = useState<UpstreamConfig[]>([]);
  const [routes, setRoutes] = useState<Record<string, RouteLink[]>>({
    [services[0].id]: [],
  });
  
  const [isRunning, setIsRunning] = useState(false);
  const [globalBusy, setGlobalBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const skipNextAutoReload = useRef(true);
  const autoReloadTimer = useRef<number | null>(null);
  const autoReloadInFlight = useRef(false);
  const queuedAutoReload = useRef(false);
  const reloadGatewayRef = useRef<() => Promise<void>>(async () => {});

  const hydrateFromPersisted = (cfg: PersistedConfig) => {
    setListenPort(cfg.listenPort);
    setGlobalKey(cfg.globalKey ?? "");
    setProxyUrl(cfg.proxyUrl ?? "");
    
    const svcList: ServiceConfig[] = cfg.services.map((svc) => ({
      id: svc.id,
      name: svc.name || "未命名服务",
      basePath: svc.basePath || "/",
      enabled: svc.enabled,
    }));
    if (svcList.length === 0) {
      svcList.push(defaultService());
    }
    setServices(svcList);

    const upstreamMap = new Map<string, UpstreamConfig>();
    const routeMap: Record<string, RouteLink[]> = {};

    svcList.forEach((svc) => {
      routeMap[svc.id] = [];
    });

    cfg.services.forEach((svc) => {
      svc.upstreams.forEach((up) => {
        if (!upstreamMap.has(up.id)) {
          upstreamMap.set(up.id, {
            id: up.id,
            label: up.label || "未命名提供商",
            upstreamBase: up.upstreamBase,
            apiKey: up.apiKey || "",
            enabled: up.enabled,
          });
        }
        routeMap[svc.id] = [
          ...(routeMap[svc.id] ?? []),
          {
            id: makeId(),
            upstreamId: up.id,
            enabled: up.enabled,
            priority: typeof up.priority === "number" ? up.priority : 0,
          },
        ];
      });
    });

    setUpstreams(Array.from(upstreamMap.values()));
    setRoutes(routeMap);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const saved = await loadSettingsCmd();
        if (saved) {
          hydrateFromPersisted(saved);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setHydrated(true);
      }
    };
    load();
  }, []);

  useEffect(() => {
    reloadGatewayRef.current = reloadGateway;
  });

  useEffect(() => {
    // Auto-save and hot-reload whenever configuration changes (debounced)
    if (!hydrated) return;

    if (skipNextAutoReload.current) {
      skipNextAutoReload.current = false;
      return;
    }

    if (autoReloadTimer.current !== null) {
      window.clearTimeout(autoReloadTimer.current);
    }

    autoReloadTimer.current = window.setTimeout(() => {
      const trigger = async () => {
        if (autoReloadInFlight.current) {
          queuedAutoReload.current = true;
          return;
        }

        autoReloadInFlight.current = true;
        try {
          await reloadGatewayRef.current();
        } catch (err) {
          console.error(`自动热更新失败：${String(err)}`);
        } finally {
          autoReloadInFlight.current = false;
          if (queuedAutoReload.current) {
            queuedAutoReload.current = false;
            trigger();
          }
        }
      };

      trigger();
    }, 500);

    return () => {
      if (autoReloadTimer.current !== null) {
        window.clearTimeout(autoReloadTimer.current);
      }
    };
  }, [listenPort, globalKey, proxyUrl, services, upstreams, routes, hydrated]);

  const startGateway = async () => {
    setGlobalBusy(true);

    const payloadServices = services
      .filter((s) => s.enabled)
      .map((svc) => {
        const serviceLinks = resequenceLinks(routes[svc.id] ?? []);
        const upstreamEntries = serviceLinks
          .filter((link) => link.enabled)
          .map((link) => {
            const upstream = upstreams.find((u) => u.id === link.upstreamId);
            if (!upstream) return null;
            return {
              id: upstream.id,
              label: upstream.label.trim() || null,
              upstreamBase: upstream.upstreamBase.trim(),
              apiKey: upstream.apiKey.trim() || null,
              priority: link.priority,
              enabled: upstream.enabled && link.enabled,
            };
          })
          .filter((v) => v && v.upstreamBase) as {
          id: string;
          label: string | null;
          upstreamBase: string;
          apiKey: string | null;
          priority: number;
          enabled: boolean;
        }[];

        return {
          id: svc.id,
          name: svc.name.trim() || "未命名服务",
          basePath: svc.basePath.trim() || "/",
          enabled: svc.enabled,
          upstreams: upstreamEntries,
        };
      })
      .filter((svc) => (svc.upstreams?.length ?? 0) > 0);

    if (payloadServices.length === 0) {
      setGlobalBusy(false);
      setIsRunning(false);
      console.error("没有可用的服务或提供商配置");
      return;
    }

    try {
      const cfg: PersistedConfig = {
        listenPort,
        globalKey: globalKey.trim() || null,
        proxyUrl: proxyUrl.trim() || null,
        services: payloadServices,
      };

      await saveSettingsCmd(cfg);
      await startProxy(cfg);
      await updateTrayStatus(true, listenPort, 0);
      setIsRunning(true);
    } catch (err) {
      setIsRunning(false);
      await updateTrayStatus(false, listenPort).catch(() => {});
      console.error(`启动失败：${String(err)}`);
    } finally {
      setGlobalBusy(false);
    }
  };

  const reloadGateway = async () => {
    if (!isRunning) {
      await startGateway();
      return;
    }

    setGlobalBusy(true);

    const payloadServices = services
      .filter((s) => s.enabled)
      .map((svc) => {
        const serviceLinks = resequenceLinks(routes[svc.id] ?? []);
        const upstreamEntries = serviceLinks
          .filter((link) => link.enabled)
          .map((link) => {
            const upstream = upstreams.find((u) => u.id === link.upstreamId);
            if (!upstream) return null;
            return {
              id: upstream.id,
              label: upstream.label.trim() || null,
              upstreamBase: upstream.upstreamBase.trim(),
              apiKey: upstream.apiKey.trim() || null,
              priority: link.priority,
              enabled: upstream.enabled && link.enabled,
            };
          })
          .filter((v) => v && v.upstreamBase) as {
          id: string;
          label: string | null;
          upstreamBase: string;
          apiKey: string | null;
          priority: number;
          enabled: boolean;
        }[];

        return {
          id: svc.id,
          name: svc.name.trim() || "未命名服务",
          basePath: svc.basePath.trim() || "/",
          enabled: svc.enabled,
          upstreams: upstreamEntries,
        };
      })
      .filter((svc) => (svc.upstreams?.length ?? 0) > 0);

    if (payloadServices.length === 0) {
      setGlobalBusy(false);
      console.error("没有可用的服务或提供商配置");
      return;
    }

    try {
      const cfg: PersistedConfig = {
        listenPort,
        globalKey: globalKey.trim() || null,
        proxyUrl: proxyUrl.trim() || null,
        services: payloadServices,
      };

      await saveSettingsCmd(cfg);
      await reloadProxy(cfg);
      await updateTrayStatus(true, listenPort, 0);
      setIsRunning(true);
    } catch (err) {
      console.error(`热更新失败：${String(err)}`);
    } finally {
      setGlobalBusy(false);
    }
  };

  const stopGateway = async () => {
    setGlobalBusy(true);
    try {
      await stopProxy(listenPort);
      await updateTrayStatus(false, listenPort, 0);
      setIsRunning(false);
    } catch (err) {
      console.error(`停止失败：${String(err)}`);
    } finally {
      setGlobalBusy(false);
    }
  };

  return (
    <ProxyStoreContext.Provider
      value={{
        listenPort,
        setListenPort,
        globalKey,
        setGlobalKey,
        proxyUrl,
        setProxyUrl,
        services,
        setServices,
        upstreams,
        setUpstreams,
        routes,
        setRoutes,
        isRunning,
        globalBusy,
        reloadGateway,
        startGateway,
        stopGateway,
      }}
    >
      {children}
    </ProxyStoreContext.Provider>
  );
}
