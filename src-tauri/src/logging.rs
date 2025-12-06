use std::collections::{HashMap, VecDeque};
use std::sync::Arc;

use tokio::sync::Mutex;

use crate::{ProxyLogEntry, UpstreamStats};

pub const MAX_LOGS: usize = 200;

pub async fn upsert_log(logs: Arc<Mutex<VecDeque<ProxyLogEntry>>>, entry: ProxyLogEntry) {
    let mut guard = logs.lock().await;
    if let Some(pos) = guard.iter().position(|e| e.id == entry.id) {
        guard[pos] = entry;
    } else {
        guard.push_back(entry);
        if guard.len() > MAX_LOGS {
            guard.pop_front();
        }
    }
}

pub async fn update_stats(
    stats: Arc<Mutex<HashMap<String, UpstreamStats>>>,
    upstream_id: &str,
    upstream_label: Option<String>,
    duration_ms: u64,
    success: bool,
) {
    let mut guard = stats.lock().await;
    let entry = guard.entry(upstream_id.to_string()).or_insert_with(|| UpstreamStats {
        upstream_id: upstream_id.to_string(),
        upstream_label: upstream_label.clone(),
        ..Default::default()
    });
    entry.total_requests += 1;
    entry.total_duration_ms += duration_ms;
    if success {
        entry.success_count += 1;
    } else {
        entry.error_count += 1;
    }
    if entry.upstream_label.is_none() && upstream_label.is_some() {
        entry.upstream_label = upstream_label;
    }
}

/// Mark in-flight log entries (status == None) as terminated when the proxy stops.
pub async fn finalize_inflight(
    logs: Arc<Mutex<VecDeque<ProxyLogEntry>>>,
    listen_port: Option<u16>,
) {
    let mut guard = logs.lock().await;
    for entry in guard.iter_mut() {
        let port_matches = listen_port
            .map(|p| p == entry.listen_port)
            .unwrap_or(true);

        if port_matches && entry.status.is_none() {
            entry.status = Some(499); // Client Closed Request semantics
            entry.error = Some("代理已停止，处理中请求已终止".to_string());
            if entry.duration_ms == 0 {
                entry.duration_ms = 0;
            }
        }
    }
}
