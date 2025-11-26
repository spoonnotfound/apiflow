import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus } from "lucide-react";
import { ServiceConfig } from "@/types";

interface ServiceListProps {
  services: ServiceConfig[];
  selectedServiceId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function ServiceList({ services, selectedServiceId, onSelect, onAdd }: ServiceListProps) {
  return (
    <div className="flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
      <div className="py-3 px-4 shrink-0 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between h-14">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">服务列表</h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAdd}>
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>添加服务</TooltipContent>
        </Tooltip>
      </div>
      <div className="min-h-0 flex-1 p-2 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-1 pr-3">
            {services.map((svc) => (
              <div
                key={svc.id}
                onClick={() => onSelect(svc.id)}
                className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-all border ${
                  svc.id === selectedServiceId
                    ? "bg-white dark:bg-slate-800 shadow-sm border-slate-200 dark:border-slate-700"
                    : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400"
                } ${!svc.enabled ? "opacity-60 grayscale" : ""}`}
              >
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div
                    className={`truncate text-sm font-medium ${svc.id === selectedServiceId ? "text-slate-900 dark:text-slate-100" : ""}`}
                  >
                    {svc.name || "未命名"}
                  </div>
                  <div className="truncate font-mono text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {svc.basePath || "/"}
                  </div>
                </div>
                <div
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    svc.enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
