import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { UpstreamConfig } from "@/types";

interface UpstreamModalProps {
  open: boolean;
  upstream: UpstreamConfig | null;
  isEditingExisting: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (upstream: UpstreamConfig) => void;
  onSave: () => void;
}

export function UpstreamModal({
  open,
  upstream,
  isEditingExisting,
  onOpenChange,
  onChange,
  onSave,
}: UpstreamModalProps) {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) setShowApiKey(false); // 关闭时重置显示状态
      onOpenChange(v);
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditingExisting ? "编辑提供商" : "新建提供商"}</DialogTitle>
        </DialogHeader>
        {upstream && (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                value={upstream.label}
                onChange={(e) => onChange({ ...upstream, label: e.target.value })}
                placeholder="例如：OpenAI API"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="baseurl">Base URL</Label>
              <Input
                id="baseurl"
                value={upstream.upstreamBase}
                onChange={(e) =>
                  onChange({
                    ...upstream,
                    upstreamBase: e.target.value,
                  })
                }
                placeholder="https://api.openai.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="apikey">API Key</Label>
              <div className="relative">
                <Input
                  id="apikey"
                  value={upstream.apiKey}
                  onChange={(e) => onChange({ ...upstream, apiKey: e.target.value })}
                  placeholder="sk-..."
                  type={showApiKey ? "text" : "password"}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4 text-slate-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-400" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
