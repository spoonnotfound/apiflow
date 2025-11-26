import { useEffect, useState } from "react";
import { 
  Settings, 
  Shield, 
  Network, 
  Globe,
  Lock,
  DownloadCloud,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProxyStore } from "@/context/ProxyStoreContext";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type UpdateProgressEvent = {
  event: string;
  downloadedBytes?: number;
  contentLength?: number;
};

export function SettingsView() {
  const {
    listenPort,
    setListenPort,
    globalKey,
    setGlobalKey,
    proxyUrl,
    setProxyUrl,
    isRunning
  } = useProxyStore();

  const [appVersion, setAppVersion] = useState<string>("");
  const [updateStatus, setUpdateStatus] = useState<string>("");
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  useEffect(() => {
    getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion("获取失败"));
  }, []);

  const handleCheckUpdate = async () => {
    if (checkingUpdate || isUpdating) return;
    setCheckingUpdate(true);
    setIsUpdating(false);
    setDownloadProgress(null);
    setUpdateStatus("正在检查更新...");
    try {
      const update = await check();
      if (update?.available) {
        setIsUpdating(true);
        setUpdateStatus(`发现新版本 ${update.version}，正在下载...`);
        await update.downloadAndInstall((event: UpdateProgressEvent) => {
          if (event.event === "DownloadProgress") {
            const pct =
              event.contentLength && typeof event.downloadedBytes === "number"
                ? Math.min(100, Math.floor((event.downloadedBytes / event.contentLength) * 100))
                : undefined;
            if (pct !== undefined) {
              setDownloadProgress(pct);
              setUpdateStatus(`下载中... ${pct}%`);
            } else {
              setUpdateStatus("下载中...");
            }
          } else if (event.event === "Started") {
            setUpdateStatus("开始下载更新...");
          } else if (event.event === "Finished") {
            setUpdateStatus("下载完成，正在安装...");
          }
        });
        setUpdateStatus("下载完成，正在重启应用...");
        await relaunch();
      } else {
        setUpdateStatus("当前已是最新版本");
      }
    } catch (err) {
      setUpdateStatus(`检查更新失败：${String(err)}`);
    } finally {
      setCheckingUpdate(false);
      setIsUpdating(false);
    }
  };

  const isUpdateBusy = checkingUpdate || isUpdating;

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden h-full border-none shadow-none bg-transparent">
      <CardHeader className="shrink-0 pb-6 px-0 pt-0">
        <div className="flex items-center gap-3">
            <CardTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100">全局设置</CardTitle>
        </div>
        <p className="text-sm text-slate-500 mt-1">
            配置代理服务器的监听端口、安全认证及网络选项
        </p>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-0 max-w-3xl scrollbar-thin">
        <div className="space-y-8 pb-8">
            {/* Network Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <Network className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">网络配置</h3>
                </div>
                
                <div className={`relative ${isRunning ? "opacity-60" : ""}`}>
                    {isRunning && (
                        <>
                            <div className="pointer-events-auto absolute inset-0 z-10" />
                            <div className="absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
                                <Lock className="h-3.5 w-3.5" />
                                运行中已锁定
                            </div>
                        </>
                    )}
                    <div className="grid gap-6 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                    <div className="space-y-3">
                        <Label className="text-base">监听端口</Label>
                        <div className="flex items-center gap-4">
                            <Input
                                type="number"
                                min={1}
                                max={65535}
                                value={listenPort}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (val >= 1 && val <= 65535) {
                                    setListenPort(val);
                                    }
                                }}
                                onBlur={(e) => {
                                    const val = Number(e.target.value);
                                    setListenPort(Math.min(65535, Math.max(1, val || 23333)));
                                }}
                                disabled={isRunning}
                                placeholder="23333"
                                className="w-40 font-mono"
                            />
                            <span className="text-sm text-slate-500">默认: 23333</span>
                        </div>
                        <p className="text-sm text-slate-500">
                            本地代理服务将在此端口接收请求。请确保端口未被占用。
                        </p>
                    </div>
                    </div>
                </div>
            </section>

            {/* Security Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">安全认证</h3>
                </div>

                <div className={`relative ${isRunning ? "opacity-60" : ""}`}>
                    {isRunning && (
                        <>
                            <div className="pointer-events-auto absolute inset-0 z-10" />
                            <div className="absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
                                <Lock className="h-3.5 w-3.5" />
                                运行中已锁定
                            </div>
                        </>
                    )}
                    <div className="grid gap-6 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                     <div className="space-y-3">
                        <Label className="text-base">全局鉴权 Key</Label>
                        <Input
                            value={globalKey}
                            onChange={(e) => setGlobalKey(e.target.value)}
                            disabled={isRunning}
                            placeholder="留空则允许匿名访问"
                            className="font-mono"
                            type="password"
                        />
                        <p className="text-sm text-slate-500">
                            若设置，客户端请求必须在 Header 中携带 <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs">x-api-key</code> 或 <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs">Authorization: Bearer</code>。
                        </p>
                    </div>
                    </div>
                </div>
            </section>

            {/* Proxy Section */}
            <section className="space-y-4">
                 <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <Globe className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">上游代理</h3>
                </div>

                <div className={`relative ${isRunning ? "opacity-60" : ""}`}>
                    {isRunning && (
                        <>
                            <div className="pointer-events-auto absolute inset-0 z-10" />
                            <div className="absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
                                <Lock className="h-3.5 w-3.5" />
                                运行中已锁定
                            </div>
                        </>
                    )}
                    <div className="grid gap-6 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                    <div className="space-y-3">
                        <Label className="text-base">代理服务器地址</Label>
                        <Input
                            value={proxyUrl}
                            onChange={(e) => setProxyUrl(e.target.value)}
                            disabled={isRunning}
                            placeholder="例如: socks5://127.0.0.1:1080 或 http://127.0.0.1:7890"
                            className="font-mono"
                        />
                        <p className="text-sm text-slate-500">
                            访问外部 API 时使用的代理。支持 HTTP, HTTPS, SOCKS5。留空则直连。
                        </p>
                    </div>
                    </div>
                </div>
            </section>

            {/* Version & Updates */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <Settings className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">版本与更新</h3>
                </div>

                <div className="grid gap-6 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                当前版本
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {appVersion || "获取中..."}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-2"
                                onClick={handleCheckUpdate}
                                disabled={isUpdateBusy}
                            >
                                {isUpdateBusy ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                    <DownloadCloud className="h-4 w-4" />
                                )}
                                {isUpdateBusy ? "处理中..." : "检查更新"}
                            </Button>
                        </div>
                    </div>
                    {(updateStatus || downloadProgress !== null || isUpdateBusy) && (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3 space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                                {isUpdateBusy ? (
                                    <RefreshCw className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                                ) : updateStatus === "当前已是最新版本" ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                ) : (
                                    <AlertCircle className="h-4 w-4 text-amber-500" />
                                )}
                                <span>{updateStatus || "准备中..."}</span>
                            </div>
                            {downloadProgress !== null && (
                                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
                                        style={{ width: `${downloadProgress}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>
        </div>
      </CardContent>
    </Card>
  );
}
