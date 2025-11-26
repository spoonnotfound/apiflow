import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UpstreamConfig, RouteLink } from "@/types";
import { Server } from "lucide-react";

interface SelectUpstreamModalProps {
  open: boolean;
  upstreams: UpstreamConfig[];
  links: RouteLink[];
  onSelect: (id: string) => void;
  onClose: () => void;
  onCreate: () => void;
}

export function SelectUpstreamModal({
  open,
  upstreams,
  links,
  onSelect,
  onClose,
  onCreate,
}: SelectUpstreamModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">选择提供商</h3>
          <p className="text-sm text-slate-500">选择要添加到此服务的上游提供商</p>
        </div>
        <ScrollArea className="h-[300px] pr-4 -mr-4 mb-4">
          <div className="space-y-2">
            {upstreams.map((u) => {
              const alreadyLinked = links.some((l) => l.upstreamId === u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => {
                    if (!alreadyLinked) {
                      onSelect(u.id);
                      onClose();
                    }
                  }}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
                    alreadyLinked
                      ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-50 dark:border-slate-800 dark:bg-slate-900"
                      : "cursor-pointer border-slate-200 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    <Server className="h-5 w-5 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{u.label || "未命名提供商"}</div>
                    <div className="truncate font-mono text-xs text-slate-400">{u.upstreamBase || "未设置URL"}</div>
                  </div>
                  {alreadyLinked && (
                    <div className="text-xs bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded text-slate-600">
                      已添加
                    </div>
                  )}
                </div>
              );
            })}
            {upstreams.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm text-slate-500 mb-4">暂无可用提供商</p>
                <Button variant="outline" onClick={() => { onClose(); onCreate(); }}>
                  新建提供商
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
        </div>
      </div>
    </div>
  );
}
