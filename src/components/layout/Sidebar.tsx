import {
  Server,
  Building2,
  ScrollText,
  Settings,
  Moon,
  Sun,
  Play,
  Square,
  RefreshCw,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabKey } from "@/types";
import { useMonitoring } from "@/context/MonitoringContext";

interface SidebarProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  isBusy: boolean;
  listenPort: number;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  darkMode,
  toggleDarkMode,
  isRunning,
  onStart,
  onStop,
  isBusy,
  listenPort
}: SidebarProps) {
  const { processingCount } = useMonitoring();
  const navItems: { id: TabKey; label: string; icon: React.ElementType }[] = [
    { id: "config", label: "服务管理", icon: Server },
    { id: "providers", label: "提供商", icon: Building2 },
    { id: "logs", label: "请求详情", icon: ScrollText },
    { id: "settings", label: "全局设置", icon: Settings },
  ];

  return (
    <div className="flex h-full w-[240px] flex-col border-r bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors pt-8">
      {/* Header */}
      <div className="flex h-12 items-center px-6 mb-2">
        <div className="flex items-center gap-3 font-bold text-xl">
          <img src="/logo.svg" alt="Logo" className="h-8 w-8" />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">ApiFlow</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant={activeTab === item.id ? "secondary" : "ghost"}
            className={`w-full justify-start gap-3 text-sm font-medium h-10 ${
              activeTab === item.id 
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
            }`}
            onClick={() => setActiveTab(item.id)}
          >
            <item.icon className={`h-4 w-4 ${activeTab === item.id ? "text-blue-600 dark:text-blue-400" : "text-slate-500"}`} />
            {item.label}
          </Button>
        ))}
      </div>

      {/* Footer / Status */}
      <div className="shrink-0 p-4 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/50">
        {/* Status Indicator */}
        <div className="flex items-center justify-between px-2 h-8 mb-4">
            <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                <div
                  className="shrink-0 h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: isRunning ? '#10b981' : '#cbd5e1',
                    boxShadow: isRunning ? '0 0 8px rgba(16,185,129,0.4)' : 'none'
                  }}
                />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
                    {isRunning ? `运行中 · 端口 ${listenPort}` : "已停止"}
                </span>
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                onClick={toggleDarkMode}
            >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
        </div>

        {isRunning && processingCount > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-100 dark:ring-emerald-800">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            正在处理 {processingCount} 个请求
          </div>
        )}

        {/* Control Button - 使用固定高度容器 */}
        <div className="h-10">
          <button
            className={`w-full h-full rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
              isRunning
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
            } ${isBusy ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={isRunning ? onStop : onStart}
            disabled={isBusy}
          >
            <span className="h-4 w-4 flex items-center justify-center">
              {isBusy ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : isRunning ? (
                <Square className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
            </span>
            {isRunning ? "停止代理" : "启动代理"}
          </button>
        </div>
      </div>
    </div>
  );
}
