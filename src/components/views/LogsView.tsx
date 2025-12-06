import { useEffect, useMemo, useState, MouseEvent, memo, useCallback } from "react";
import {
  ScrollText,
  Trash2,
  RefreshCw,
  ArrowRight,
  Radio,
  Clock,
  ChevronDown,
  Search,
  Zap,
  Eye,
  EyeOff,
  Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMonitoring } from "@/context/MonitoringContext";
import { LogEntry } from "@/types";

const BODY_PREVIEW_LIMIT = 2000;

const getMethodVariant = (method: string) => {
  const m = method.toLowerCase();
  if (m === "get") return "default";
  if (m === "post") return "secondary";
  if (m === "put" || m === "patch") return "outline";
  if (m === "delete") return "destructive";
  return "default"; // fallback
};

const extractDomain = (url: string) => {
  try {
    const u = new URL(url);
    return u.host;
  } catch {
    return url;
  }
};

const maskSensitiveHeaders = (headers: string | null | undefined, reveal: boolean): string => {
  if (!headers) return "(无)";
  if (reveal) return headers;

  return headers
    .split("\n")
    .map((line) => {
      const lower = line.toLowerCase();
      if (lower.startsWith("authorization:") || lower.startsWith("x-goog-api-key:")) {
        const colonIndex = line.indexOf(":");
        const key = line.substring(0, colonIndex + 1);
        return `${key} ********`;
      }
      return line;
    })
    .join("\n");
};

const buildBodyPreview = (body: string | null | undefined, showFull: boolean) => {
  if (!body) {
    return { text: "(无)", truncated: false };
  }
  if (showFull || body.length <= BODY_PREVIEW_LIMIT) {
    return { text: body, truncated: false };
  }
  return {
    text: `${body.slice(0, BODY_PREVIEW_LIMIT)}\n… 内容已截断，点击“展开全文”查看完整内容`,
    truncated: true,
  };
};

type LogItemProps = {
  log: LogEntry;
  isExpanded: boolean;
  onToggle: () => void;
  showSecrets: boolean;
  onToggleSecrets: () => void;
  copyToClipboard: (event: MouseEvent, value?: string | null) => void;
};

const LogItem = memo(function LogItem({
  log,
  isExpanded,
  onToggle,
  showSecrets,
  onToggleSecrets,
  copyToClipboard,
}: LogItemProps) {
  const [showFullRequestBody, setShowFullRequestBody] = useState(false);
  const [showFullResponseBody, setShowFullResponseBody] = useState(false);

  const maskedRequestHeaders = useMemo(
    () => maskSensitiveHeaders(log.requestHeaders, showSecrets),
    [log.requestHeaders, showSecrets]
  );
  const responseHeaders = useMemo(() => log.responseHeaders || "(无)", [log.responseHeaders]);

  const requestBody = useMemo(
    () => buildBodyPreview(log.requestBody, showFullRequestBody),
    [log.requestBody, showFullRequestBody]
  );
  const responseBody = useMemo(
    () => buildBodyPreview(log.responseBody, showFullResponseBody),
    [log.responseBody, showFullResponseBody]
  );

  useEffect(() => {
    if (!isExpanded) {
      setShowFullRequestBody(false);
      setShowFullResponseBody(false);
    }
  }, [isExpanded]);

  return (
    <div className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
      <div
        className="flex items-start gap-4 px-5 py-3.5 cursor-pointer"
        onClick={onToggle}
      >
        <Badge
            variant={getMethodVariant(log.method) as "default" | "secondary" | "destructive" | "outline"}
            className="mt-0.5 font-mono uppercase px-2 py-0.5 h-6"
        >
          {log.method}
        </Badge>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 mb-1">
              <div className="break-all font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {log.path}
              </div>
              {log.isStreaming && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-purple-600 border-purple-200 dark:text-purple-400 dark:border-purple-800">
                  <Zap className="h-2.5 w-2.5 mr-0.5" />
                  流式
                </Badge>
              )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 cursor-help">
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-mono truncate max-w-[180px]">{extractDomain(log.upstreamUrl)}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-md">
                <code className="text-xs break-all">{log.upstreamUrl}</code>
              </TooltipContent>
            </Tooltip>
            {log.durationMs > 0 && (
              <span className="flex items-center gap-1" title="Duration">
                  <Clock className="h-3 w-3" />
                  <span className={`${log.durationMs > 30000 ? "text-amber-600 dark:text-amber-400 font-bold" : ""}`}>
                      {log.durationMs >= 1000 ? `${(log.durationMs / 1000).toFixed(1)}s` : `${log.durationMs}ms`}
                  </span>
              </span>
            )}
             {log.serviceName && (
              <span className="flex items-center gap-1 hidden sm:flex">
                <Radio className="h-3 w-3" />
                {log.serviceName}
              </span>
            )}
            <span className="text-slate-400 dark:text-slate-600 ml-auto text-[10px]">
               {log.timestamp}
            </span>
          </div>
          {log.error && (
            <div className="mt-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-2 font-mono text-xs text-red-600 dark:text-red-400 break-all">
              {log.error}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {log.retryAction && (
              <Badge
                variant="outline"
                className="text-amber-700 border-amber-200 dark:text-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 font-normal"
              >
                {log.retryAction === "fallback" ? "自动切换" : "自动重试"}
              </Badge>
            )}
            <Badge
                variant={
                log.status == null
                    ? "secondary"
                    : log.status < 400
                      ? "outline"
                      : "destructive"
                }
                className={`font-mono ${
                  log.status == null
                    ? "text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    : log.status < 400
                      ? "text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-900"
                      : ""
                }`}
            >
                {log.status ?? "处理中"}
            </Badge>
          </div>

          <div className={`text-slate-300 dark:text-slate-600 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
              <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </div>
          {isExpanded && (
            <div className="border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 px-5 py-4 space-y-6 animate-in slide-in-from-top-2 duration-200">
              {/* General Info */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">基本信息</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-white dark:bg-slate-950 rounded-lg border dark:border-slate-800">
              <div>
                <span className="text-[10px] font-medium text-slate-400 uppercase block">请求方法</span>
                <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{log.method}</span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-slate-400 uppercase block">状态码</span>
                <span className={`text-xs font-mono ${log.status == null ? 'text-slate-600 dark:text-slate-300' : log.status < 400 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {log.status ?? '处理中'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-slate-400 uppercase block">耗时</span>
                <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
                  {log.durationMs >= 1000 ? `${(log.durationMs / 1000).toFixed(2)}s` : `${log.durationMs}ms`}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-slate-400 uppercase block">时间</span>
                <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{log.timestamp}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-medium text-slate-400 uppercase block">请求路径</span>
                <span className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all">{log.path}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-medium text-slate-400 uppercase block">上游地址</span>
                <span className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all">{log.upstreamUrl}</span>
              </div>
              {log.clientIp && (
                <div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase block">客户端 IP</span>
                  <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{log.clientIp}</span>
                </div>
              )}
              {log.serviceName && (
                <div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase block">服务</span>
                  <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{log.serviceName}</span>
                </div>
              )}
              {log.upstreamLabel && (
                <div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase block">提供商</span>
                  <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{log.upstreamLabel}</span>
                </div>
              )}
              {log.isStreaming && (
                <div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase block">类型</span>
                  <span className="text-xs font-mono text-purple-600 dark:text-purple-400">流式响应</span>
                </div>
              )}
            </div>
          </div>

          {/* Request */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Request</h4>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-400 uppercase">Headers</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      onClick={(e) => copyToClipboard(e, maskedRequestHeaders)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      复制
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSecrets();
                      }}
                    >
                      {showSecrets ? (
                        <>
                          <EyeOff className="h-3 w-3 mr-1" />
                          隐藏密钥
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3 mr-1" />
                          显示密钥
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <pre className="p-3 bg-white dark:bg-slate-950 rounded-lg border dark:border-slate-800 text-xs font-mono whitespace-pre-wrap break-all max-h-60 overflow-auto text-slate-600 dark:text-slate-300">
                  {maskedRequestHeaders}
                </pre>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-400 uppercase">Body</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      onClick={(e) => copyToClipboard(e, log.requestBody || "(无)")}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      复制
                    </Button>
                    {requestBody.truncated ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowFullRequestBody(true);
                        }}
                      >
                        展开全文
                      </Button>
                    ) : (
                      log.requestBody && log.requestBody.length > BODY_PREVIEW_LIMIT && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowFullRequestBody(false);
                          }}
                        >
                          折叠
                        </Button>
                      )
                    )}
                  </div>
                </div>
                <pre className="p-3 bg-white dark:bg-slate-950 rounded-lg border dark:border-slate-800 text-xs font-mono whitespace-pre-wrap break-all max-h-80 overflow-auto text-slate-600 dark:text-slate-300">
                  {requestBody.text}
                </pre>
              </div>
            </div>
          </div>

          {/* Response */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Response</h4>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-400 uppercase">Headers</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    onClick={(e) => copyToClipboard(e, responseHeaders)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    复制
                  </Button>
                </div>
                <pre className="p-3 bg-white dark:bg-slate-950 rounded-lg border dark:border-slate-800 text-xs font-mono whitespace-pre-wrap break-all max-h-60 overflow-auto text-slate-600 dark:text-slate-300">
                  {responseHeaders}
                </pre>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-400 uppercase">Body</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      onClick={(e) => copyToClipboard(e, log.responseBody || "(无)")}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      复制
                    </Button>
                    {responseBody.truncated ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowFullResponseBody(true);
                        }}
                      >
                        展开全文
                      </Button>
                    ) : (
                      log.responseBody && log.responseBody.length > BODY_PREVIEW_LIMIT && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowFullResponseBody(false);
                          }}
                        >
                          折叠
                        </Button>
                      )
                    )}
                  </div>
                </div>
                <pre className="p-3 bg-white dark:bg-slate-950 rounded-lg border dark:border-slate-800 text-xs font-mono whitespace-pre-wrap break-all max-h-80 overflow-auto text-slate-600 dark:text-slate-300">
                  {responseBody.text}
                </pre>
              </div>
            </div>
          </div>

          {/* Error */}
          {log.error && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-red-500 dark:text-red-400">Error</h4>
              <pre className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900 text-xs font-mono whitespace-pre-wrap break-all max-h-40 overflow-auto text-red-600 dark:text-red-400">
                {log.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
export function LogsView() {
  const { logs, loadLogs, clearLogs, setAutoRefreshEnabled } = useMonitoring();

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showSecrets, setShowSecrets] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // 按时间降序排列
  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      // 按 timestamp 降序
      return b.timestamp.localeCompare(a.timestamp);
    });
  }, [logs]);

  const displayedLogs = sortedLogs.filter(log =>
    !filter ||
    log.path.includes(filter) ||
    log.method.toLowerCase().includes(filter.toLowerCase()) ||
    (log.status?.toString() ?? "").includes(filter) ||
    (log.upstreamUrl ?? "").includes(filter)
  );
  const totalPages = Math.max(1, Math.ceil(displayedLogs.length / pageSize));
  const paginatedLogs = displayedLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, logs.length]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(displayedLogs.length / pageSize));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [displayedLogs.length, currentPage, pageSize]);

  useEffect(() => {
    setAutoRefreshEnabled(!expandedLogId);
    return () => setAutoRefreshEnabled(true);
  }, [expandedLogId, setAutoRefreshEnabled]);

  const copyToClipboard = useCallback(async (event: MouseEvent, value?: string | null) => {
    event.stopPropagation();
    if (value === undefined || value === null) return;
    if (!("clipboard" in navigator)) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  }, []);

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden h-full border-none shadow-none bg-transparent">
      <CardHeader className="shrink-0 pb-4 px-0 pt-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100">请求详情</CardTitle>
          </div>
          <div className="flex gap-2">
             <Button variant="outline" size="sm" onClick={loadLogs} className="bg-white dark:bg-slate-950">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              刷新
            </Button>
            <Button variant="ghost" size="sm" onClick={clearLogs} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              清空
            </Button>
          </div>
        </div>
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
                placeholder="搜索路径、方法、状态码或域名..."
                className="pl-9 bg-white dark:bg-slate-950"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
            />
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 p-0 border rounded-xl bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
        <div className="flex h-full flex-col">
          <ScrollArea className="flex-1 min-h-0">
            {displayedLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900">
                  <ScrollText className="h-6 w-6 text-slate-400" />
                </div>
                <h3 className="mb-1 font-medium text-slate-600 dark:text-slate-400">暂无日志</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  {logs.length > 0 ? "没有匹配的日志记录" : "启动代理后，请求日志将显示在这里"}
                </p>
              </div>
            ) : (
              <div className="divide-y dark:divide-slate-800">
                {paginatedLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <LogItem
                      key={log.id}
                      log={log}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedLogId(isExpanded ? null : log.id)}
                      showSecrets={showSecrets}
                      onToggleSecrets={() => setShowSecrets((prev) => !prev)}
                      copyToClipboard={copyToClipboard}
                    />
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {displayedLogs.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-5 py-3 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <span>
                  第 {currentPage} / {totalPages} 页 · 共 {displayedLogs.length} 条
                </span>
                <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  每页
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const next = Number(e.target.value) || 15;
                      setPageSize(next);
                      setCurrentPage(1);
                    }}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none ring-0 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-blue-400 dark:focus:ring-blue-900/40"
                  >
                    {[10, 15, 20, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
