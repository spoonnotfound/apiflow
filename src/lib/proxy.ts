import { invoke } from "@tauri-apps/api/core";
import { LogEntry, PersistedConfig, NetworkInfo } from "@/types";

export async function loadSettings() {
  return invoke<PersistedConfig | null>("load_settings");
}

export async function saveSettings(config: PersistedConfig) {
  return invoke("save_settings", { config });
}

export async function startProxy(config: PersistedConfig) {
  return invoke("start_proxy", { config });
}

export async function reloadProxy(config: PersistedConfig) {
  return invoke("reload_proxy", { config });
}

export async function stopProxy(listenPort: number) {
  return invoke("stop_proxy", { listen_port: listenPort });
}

export async function updateTrayStatus(
  running: boolean,
  port: number,
  processingCount?: number
) {
  return invoke("update_tray_status", {
    running,
    port,
    processing_count: processingCount ?? 0,
  });
}

export async function getLogs(listenPort: number, limit = 180) {
  return invoke<LogEntry[]>("get_logs", { listen_port: listenPort, limit });
}

export async function clearLogs() {
  return invoke("clear_logs");
}

export async function getNetworkInfo() {
  return invoke<NetworkInfo>("get_network_info");
}
