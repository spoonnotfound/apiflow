import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Copy, Check, Trash2 } from "lucide-react";
import { ServiceConfig } from "@/types";

interface ServiceHeaderProps {
  service?: ServiceConfig;
  addressOptions: { label: string; url: string }[];
  copiedUrl: string | null;
  onCopyUrl: (url: string) => void;
  onToggleEnabled: (checked: boolean) => void;
  onDelete: () => void;
}

export function ServiceHeader({
  service,
  addressOptions,
  copiedUrl,
  onCopyUrl,
  onToggleEnabled,
  onDelete,
}: ServiceHeaderProps) {
  return (
    <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-6 h-14 flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
          {service?.name || "服务配置"}
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 rounded-md bg-slate-100 dark:bg-slate-900 px-2 py-1 shrink-0 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
              <code className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                {service?.basePath || "/"}
              </code>
              <Copy className="h-3 w-3 text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[280px]">
            {addressOptions.map((option) => (
              <DropdownMenuItem
                key={option.label}
                onClick={() => onCopyUrl(option.url)}
                className="flex items-center justify-between gap-4 cursor-pointer"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-medium">{option.label}</span>
                  <code className="text-[10px] text-slate-500 truncate">{option.url}</code>
                </div>
                {copiedUrl === option.url ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-slate-500 dark:text-slate-400 font-normal">启用</Label>
          <Switch
            checked={service?.enabled ?? false}
            onCheckedChange={onToggleEnabled}
            className="scale-75 origin-right"
          />
        </div>
        <Separator orientation="vertical" className="h-4" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
