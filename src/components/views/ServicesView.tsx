import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { UpstreamConfig } from "@/types";
import { resequenceLinks, makeId } from "@/lib/utils";
import { useNetworkAddresses } from "@/hooks/useNetworkAddresses";
import { ServiceList } from "./services/ServiceList";
import { ServiceHeader } from "./services/ServiceHeader";
import { RouteList } from "./services/RouteList";
import { SelectUpstreamModal } from "./services/SelectUpstreamModal";
import { useProxyStore } from "@/context/ProxyStoreContext";

interface ServicesViewProps {
  openUpstreamModal: (upstream?: UpstreamConfig) => void;
}

export function ServicesView({
  openUpstreamModal,
}: ServicesViewProps) {
  const {
    services,
    setServices,
    routes,
    setRoutes,
    upstreams,
    listenPort,
  } = useProxyStore();

  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id ?? "");
  const [showServiceBasicInfo, setShowServiceBasicInfo] = useState(true);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [showSelectUpstreamModal, setShowSelectUpstreamModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const selectedService = services.find((s) => s.id === selectedServiceId) ?? services[0];

  const linksForService = useMemo(() => {
    const list = routes[selectedService?.id ?? ""] ?? [];
    return resequenceLinks(list);
  }, [routes, selectedService?.id]);

  const addressOptions = useNetworkAddresses(listenPort, selectedService?.basePath ?? "/");

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleAddService = () => {
    const svc = {
      id: makeId(),
      name: `服务 ${services.length + 1}`,
      basePath: `/api${services.length + 1}`,
      enabled: true,
    };
    setServices((prev) => [...prev, svc]);
    setRoutes((prev) => ({ ...prev, [svc.id]: [] }));
    setSelectedServiceId(svc.id);
  };

  const handleDeleteService = (id: string) => {
    if (services.length <= 1) {
      alert("至少需要保留一个服务");
      return;
    }
    setServices((prev) => prev.filter((s) => s.id !== id));
    setRoutes((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (selectedServiceId === id) {
      setSelectedServiceId(services.find((s) => s.id !== id)?.id ?? "");
    }
  };

  const handleAddLink = (upstreamId?: string) => {
    if (!selectedService) return;
    if (upstreams.length === 0) {
      openUpstreamModal();
      return;
    }
    if (!upstreamId) {
      setShowSelectUpstreamModal(true);
      return;
    }

    const nextLinks = resequenceLinks([
      ...(routes[selectedService.id] ?? []),
      {
        id: makeId(),
        upstreamId: upstreamId,
        enabled: true,
        priority: (routes[selectedService.id]?.length ?? 0) + 1,
      },
    ]);
    setRoutes((prev) => ({ ...prev, [selectedService.id]: nextLinks }));
  };

  const handleRemoveLink = (linkId: string) => {
    if (!selectedService) return;
    setRoutes((prev) => ({
      ...prev,
      [selectedService.id]: resequenceLinks(
        (prev[selectedService.id] ?? []).filter((l) => l.id !== linkId)
      ),
    }));
  };

  const handleLinkToggle = (linkId: string, enabled: boolean) => {
    if (!selectedService) return;
    setRoutes((prev) => {
      const list = prev[selectedService.id] ?? [];
      return {
        ...prev,
        [selectedService.id]: list.map((l) =>
          l.id === linkId ? { ...l, enabled } : l
        ),
      };
    });
  };

  const handleLinkSelect = (linkId: string, upstreamId: string) => {
    if (!selectedService) return;
    setRoutes((prev) => {
      const list = prev[selectedService.id] ?? [];
      return {
        ...prev,
        [selectedService.id]: list.map((l) =>
          l.id === linkId ? { ...l, upstreamId } : l
        ),
      };
    });
  };

  const handleLinkDrag = (fromIdx: number, toIdx: number) => {
    if (!selectedService || fromIdx === toIdx) return;
    const list = [...linksForService];
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    setRoutes((prev) => ({
      ...prev,
      [selectedService.id]: resequenceLinks(list),
    }));
  };

  return (
    <div className="grid h-full grid-cols-[250px_1fr] divide-x divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <ServiceList
        services={services}
        selectedServiceId={selectedService?.id ?? ""}
        onSelect={setSelectedServiceId}
        onAdd={handleAddService}
      />

      <div className="flex flex-col min-w-0 bg-white dark:bg-slate-950">
        <ServiceHeader
          service={selectedService}
          addressOptions={addressOptions}
          copiedUrl={copiedUrl}
          onCopyUrl={handleCopyUrl}
          onToggleEnabled={(checked) =>
            setServices((prev) =>
              prev.map((s) =>
                s.id === selectedService?.id
                  ? { ...s, enabled: checked }
                  : s
              )
            )
          }
          onDelete={() => handleDeleteService(selectedService?.id ?? "")}
        />

        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <div className="mx-auto max-w-3xl space-y-8">
            {/* Basic Info Section */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">基本设置</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowServiceBasicInfo(!showServiceBasicInfo)}
                  className="h-8 text-xs"
                >
                  {showServiceBasicInfo ? "收起" : "展开"}
                </Button>
              </div>

              {showServiceBasicInfo && (
                <div className="grid gap-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-5">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>服务名称</Label>
                      <Input
                        value={selectedService?.name ?? ""}
                        onChange={(e) =>
                          setServices((prev) =>
                            prev.map((s) =>
                              s.id === selectedService?.id
                                ? { ...s, name: e.target.value }
                                : s
                            )
                          )
                        }
                        placeholder="例如：OpenAI 服务"
                        className="bg-white dark:bg-slate-950"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>基路径 (Base Path)</Label>
                      <Input
                        value={selectedService?.basePath ?? ""}
                        onChange={(e) =>
                          setServices((prev) =>
                            prev.map((s) =>
                              s.id === selectedService?.id
                                ? { ...s, basePath: e.target.value }
                                : s
                            )
                          )
                        }
                        placeholder="例如：/v1"
                        className="bg-white dark:bg-slate-950"
                      />
                      <p className="text-xs text-slate-500">客户端访问此路径时将触发代理</p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <Separator />

            <RouteList
              links={linksForService}
              upstreams={upstreams}
              dragIdx={dragIdx}
              setDragIdx={setDragIdx}
              onAddLink={handleAddLink}
              onRemoveLink={handleRemoveLink}
              onLinkToggle={handleLinkToggle}
              onLinkSelect={handleLinkSelect}
              onLinkDrag={handleLinkDrag}
              openUpstreamModal={openUpstreamModal}
            />
          </div>
        </div>
      </div>

      <SelectUpstreamModal
        open={showSelectUpstreamModal}
        upstreams={upstreams}
        links={linksForService}
        onSelect={(id) => handleAddLink(id)}
        onClose={() => setShowSelectUpstreamModal(false)}
        onCreate={() => openUpstreamModal()}
      />
    </div>
  );
}
