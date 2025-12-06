import { Plus, Unlink, GripVertical, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RouteLink, UpstreamConfig } from "@/types";

interface RouteListProps {
  links: RouteLink[];
  upstreams: UpstreamConfig[];
  dragIdx: number | null;
  setDragIdx: (idx: number | null) => void;
  onAddLink: (upstreamId?: string) => void;
  onRemoveLink: (linkId: string) => void;
  onLinkToggle: (linkId: string, enabled: boolean) => void;
  onLinkSelect: (linkId: string, upstreamId: string) => void;
  onLinkDrag: (fromIdx: number, toIdx: number) => void;
  openUpstreamModal: (upstream?: UpstreamConfig) => void;
}

export function RouteList({
  links,
  upstreams,
  dragIdx,
  setDragIdx,
  onAddLink,
  onRemoveLink,
  onLinkToggle,
  onLinkSelect,
  onLinkDrag,
  openUpstreamModal,
}: RouteListProps) {
  return (
    <section className="space-y-4 min-h-0">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">提供商路由</h3>
          <p className="text-xs text-slate-500 mt-1">
            配置请求转发的目标提供商
          </p>
        </div>
        <Button size="sm" onClick={() => onAddLink()} className="gap-1">
          <Plus className="h-4 w-4" />
          添加提供商
        </Button>
      </div>

      <div className="space-y-3 max-h-[420px] min-h-[240px] overflow-y-auto pr-1 scrollbar-thin">
        {links.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <Unlink className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">暂无路由配置</h3>
            <p className="mb-4 text-xs text-slate-500 max-w-xs mx-auto">
              添加一个提供商，请求将被转发到该提供商的 API 地址
            </p>
            <Button variant="outline" size="sm" onClick={() => onAddLink()}>
              添加第一个提供商
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {links.map((link, idx) => {
              const upstream = upstreams.find((u) => u.id === link.upstreamId);
              return (
                <div
                  key={link.id}
                  draggable
                  data-index={idx}
                  onDragStart={(e) => {
                    setDragIdx(idx);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(idx));
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = e.dataTransfer.getData("text/plain");
                    const fromIdx = from ? Number(from) : dragIdx;
                    const toIdx = Number(e.currentTarget.getAttribute("data-index"));
                    if (fromIdx !== null && !Number.isNaN(fromIdx)) {
                      onLinkDrag(fromIdx, Number.isNaN(toIdx) ? idx : toIdx);
                    }
                    setDragIdx(null);
                  }}
                  onDragEnd={() => setDragIdx(null)}
                  className={`group flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-2 transition-all hover:shadow-md ${
                    !link.enabled ? "opacity-60 grayscale" : ""
                  } ${dragIdx === idx ? "scale-[1.02] shadow-lg ring-2 ring-blue-500/20" : ""}`}
                >
                  <div className="flex w-8 cursor-grab items-center justify-center self-stretch rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 active:cursor-grabbing">
                    <GripVertical className="h-4 w-4" />
                  </div>

                  <div className="flex-1 flex items-center gap-4 p-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          {idx + 1}
                        </span>
                        <Select
                          value={link.upstreamId}
                          onValueChange={(v) => onLinkSelect(link.id, v)}
                        >
                          <SelectTrigger className="h-8 border-0 bg-transparent p-0 text-sm font-semibold shadow-none focus:ring-0 hover:bg-slate-50 dark:hover:bg-slate-900 px-2 rounded -ml-2 w-fit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {upstreams.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.label || "未命名"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono bg-slate-50 dark:bg-slate-900/50 px-2 py-1 rounded w-fit">
                        <span className="truncate max-w-[300px]">{upstream?.upstreamBase || "未设置URL"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 pr-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 mr-2">
                          <Switch
                            checked={link.enabled}
                            onCheckedChange={(checked) => onLinkToggle(link.id, checked)}
                            className="scale-75"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>启用/禁用路由</TooltipContent>
                    </Tooltip>

                    <div className="h-8 w-px bg-slate-100 dark:bg-slate-800 mx-1" />

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-blue-600"
                          onClick={() => upstream && openUpstreamModal(upstream)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>编辑提供商详情</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                          onClick={() => onRemoveLink(link.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>移除路由</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
