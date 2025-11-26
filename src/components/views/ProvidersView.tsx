import { 
  Building2, 
  Plus, 
  Pencil, 
  Trash2, 
  Server 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UpstreamConfig } from "@/types";
import { useProxyStore } from "@/context/ProxyStoreContext";

interface ProvidersViewProps {
  openUpstreamModal: (upstream?: UpstreamConfig) => void;
}

export function ProvidersView({
  openUpstreamModal,
}: ProvidersViewProps) {
  const {
    upstreams,
    setUpstreams,
    services,
    routes,
  } = useProxyStore();

  const handleDeleteUpstream = (id: string) => {
    const inUse = Object.values(routes).some((links) =>
      links.some((l) => l.upstreamId === id)
    );
    if (inUse) {
      alert("该提供商正在被使用，请先移除引用");
      return;
    }
    setUpstreams((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden h-full border-none shadow-none bg-transparent">
      <CardHeader className="shrink-0 pb-6 px-0 pt-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100">提供商管理</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              管理所有上游 API 服务提供商配置
            </p>
          </div>
          <Button onClick={() => openUpstreamModal()} className="shadow-sm">
            <Plus className="mr-1 h-4 w-4" />
            新建提供商
          </Button>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-auto p-0 pr-2">
        {upstreams.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm">
              <Building2 className="h-7 w-7 text-slate-400" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              还没有提供商
            </h3>
            <p className="mb-6 text-sm text-slate-500 max-w-sm mx-auto">
              配置上游服务的 Base URL 和 API Key，以便在服务路由中使用
            </p>
            <Button onClick={() => openUpstreamModal()} variant="outline">
              <Plus className="mr-1 h-4 w-4" />
              新建第一个提供商
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upstreams.map((u) => {
              const usedByServices = services.filter((svc) =>
                (routes[svc.id] ?? []).some((l) => l.upstreamId === u.id)
              );
              return (
                <div
                  key={u.id}
                  className="group relative flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 transition-all hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md"
                >
                  <div>
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={() => openUpstreamModal(u)}
                        >
                          <Pencil className="h-3.5 w-3.5 text-slate-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => handleDeleteUpstream(u.id)}
                          disabled={usedByServices.length > 0}
                        >
                          <Trash2 className={`h-3.5 w-3.5 ${usedByServices.length > 0 ? "text-slate-300" : "text-red-500"}`} />
                        </Button>
                      </div>
                    </div>
                    <h5 className="mb-1 font-semibold text-slate-900 dark:text-slate-100 truncate pr-8">
                      {u.label || "未命名提供商"}
                    </h5>
                    <div className="mb-4 flex items-center gap-1 rounded bg-slate-50 dark:bg-slate-900 px-2 py-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                        <Server className="h-3 w-3" />
                        <span className="truncate" title={u.upstreamBase}>
                            {u.upstreamBase || "未设置URL"}
                        </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-900">
                    {!u.apiKey ? (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900 dark:text-amber-500">
                        无 API Key
                      </Badge>
                    ) : (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-900 dark:text-emerald-500">
                        API Key 已配置
                      </Badge>
                    )}
                    {usedByServices.length > 0 ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {usedByServices.length} 个服务使用
                      </Badge>
                    ) : (
                        <span className="text-[10px] text-slate-400">未使用</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}