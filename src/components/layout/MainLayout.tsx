import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { UpstreamModal } from "@/components/UpstreamModal";
import { ServicesView } from "@/components/views/ServicesView";
import { ProvidersView } from "@/components/views/ProvidersView";
import { LogsView } from "@/components/views/LogsView";
import { SettingsView } from "@/components/views/SettingsView";

import { UpstreamConfig, TabKey } from "@/types";
import { makeId } from "@/lib/utils";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useProxyStore } from "@/context/ProxyStoreContext";
import { TooltipProvider } from "@/components/ui/tooltip";

export function MainLayout() {
  const {
    listenPort,
    upstreams,
    setUpstreams,
    isRunning,
    globalBusy,
    startGateway,
    stopGateway,
  } = useProxyStore();

  const [activeTab, setActiveTab] = useState<TabKey>("config");
  const [editingUpstream, setEditingUpstream] = useState<UpstreamConfig | null>(null);
  const [showUpstreamModal, setShowUpstreamModal] = useState(false);
  
  const { darkMode, toggleDarkMode } = useDarkMode();

  // Upstream Modal Logic
  const openUpstreamModal = (upstream?: UpstreamConfig) => {
    setEditingUpstream(
      upstream ?? {
        id: makeId(),
        label: "",
        upstreamBase: "",
        apiKey: "",
        enabled: true,
      }
    );
    setShowUpstreamModal(true);
  };

  const closeUpstreamModal = () => {
    setShowUpstreamModal(false);
    setEditingUpstream(null);
  };

  const saveUpstream = () => {
    if (!editingUpstream) return;
    const exists = upstreams.find((u) => u.id === editingUpstream.id);
    if (exists) {
      setUpstreams((prev) =>
        prev.map((u) => (u.id === editingUpstream.id ? editingUpstream : u))
      );
    } else {
      setUpstreams((prev) => [...prev, editingUpstream]);
    }
    closeUpstreamModal();
  };

  return (
    <TooltipProvider>
      <div className={`flex h-screen w-full overflow-hidden font-sans antialiased ${darkMode ? "dark" : ""}`}>
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          isRunning={isRunning}
          onStart={startGateway}
          onStop={stopGateway}
          isBusy={globalBusy}
          listenPort={listenPort}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 transition-colors">
          <div data-tauri-drag-region className="h-8 w-full shrink-0 bg-transparent" />

          <div className="flex-1 min-h-0 p-6 pt-0 overflow-hidden">
            {activeTab === "config" && (
              <ServicesView
                openUpstreamModal={openUpstreamModal}
              />
            )}
            
            {activeTab === "providers" && (
              <ProvidersView
                openUpstreamModal={openUpstreamModal}
              />
            )}

            {activeTab === "logs" && (
              <LogsView />
            )}

            {activeTab === "settings" && (
              <SettingsView />
            )}
          </div>
        </main>

        <UpstreamModal
          open={showUpstreamModal}
          onOpenChange={(open) => {
            if (!open) {
              closeUpstreamModal();
            } else {
              setShowUpstreamModal(true);
            }
          }}
          upstream={editingUpstream}
          isEditingExisting={Boolean(
            upstreams.find((u) => u.id === editingUpstream?.id)
          )}
          onChange={(up) => setEditingUpstream(up)}
          onSave={saveUpstream}
        />
      </div>
    </TooltipProvider>
  );
}
