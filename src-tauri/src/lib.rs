use std::{
    collections::{HashMap, VecDeque},
    net::SocketAddr,
    sync::Arc,
    time::{Duration, Instant},
};

use axum::{
    body::Body, extract::{ConnectInfo, State}, http::Request, http::StatusCode, response::Response, routing::any,
    Router,
};
use bytes::{Bytes, BytesMut};
use chrono::Local;
use futures_util::StreamExt;
use http::header;
use http_body_util::BodyExt;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use tauri::State as TauriState;
use tokio::sync::{oneshot, Mutex, RwLock};
use uuid::Uuid;

mod helpers;
mod logging;
mod network;
mod persistence;
mod tray;

#[cfg(test)]
mod tests;

use crate::helpers::{
    build_upstream_url, extract_proxy_key, format_headers, normalize_base_path, strip_base_path, truncate_body,
};
use crate::logging::{finalize_inflight, MAX_LOGS};
use crate::network::NetworkInfo;
use crate::persistence::{load_config, save_config};
pub use tray::update_tray_status;

const MAX_FALLBACK_RETRIES: u32 = 10;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/ProxyConfig.ts")]
#[serde(rename_all = "camelCase")]
pub struct ProxyConfig {
    pub listen_port: u16,
    pub global_key: Option<String>,
    pub proxy_url: Option<String>,
    #[serde(default)]
    pub fallback_retries: u32,
    pub services: Vec<ServiceConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/ProxyLogEntry.ts")]
#[serde(rename_all = "camelCase")]
pub struct ProxyLogEntry {
    pub id: String,
    pub timestamp: String,
    pub method: String,
    pub path: String,
    pub upstream_url: String,
    pub listen_port: u16,
    pub route_key: Option<String>,
    pub upstream_label: Option<String>,
    pub service_name: Option<String>,
    pub base_path: Option<String>,
    pub status: Option<u16>,
    #[ts(type = "number")]
    pub duration_ms: u128,
    pub error: Option<String>,
    pub retry_action: Option<String>,
    pub request_headers: Option<String>,
    pub request_body: Option<String>,
    pub response_headers: Option<String>,
    pub response_body: Option<String>,
    pub client_ip: Option<String>,
    pub is_streaming: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/ServiceConfig.ts")]
#[serde(rename_all = "camelCase")]
pub struct ServiceConfig {
    pub id: String,
    pub name: String,
    pub base_path: String,
    pub enabled: bool,
    pub upstreams: Vec<UpstreamEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/UpstreamEntry.ts")]
#[serde(rename_all = "camelCase")]
pub struct UpstreamEntry {
    pub id: String,
    pub label: Option<String>,
    pub upstream_base: String,
    pub api_key: Option<String>,
    pub priority: u32,
    pub enabled: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/UpstreamStats.ts")]
#[serde(rename_all = "camelCase")]
pub struct UpstreamStats {
    pub upstream_id: String,
    pub upstream_label: Option<String>,
    #[ts(type = "number")]
    pub total_requests: u64,
    #[ts(type = "number")]
    pub success_count: u64,
    #[ts(type = "number")]
    pub error_count: u64,
    #[ts(type = "number")]
    pub total_duration_ms: u64,
}

#[derive(Clone)]
struct SharedState {
    config: Arc<RwLock<ProxyConfig>>,
    client: Arc<RwLock<reqwest::Client>>,
    logs: Arc<Mutex<VecDeque<ProxyLogEntry>>>,
    stats: Arc<Mutex<HashMap<String, UpstreamStats>>>,
}

struct RunningServer {
    shutdown: oneshot::Sender<()>,
    join: tauri::async_runtime::JoinHandle<()>,
    config: Arc<RwLock<ProxyConfig>>,
}

struct ProxyState {
    inner: Mutex<HashMap<u16, RunningServer>>,
    client: Arc<RwLock<reqwest::Client>>,
    logs: Arc<Mutex<VecDeque<ProxyLogEntry>>>,
    stats: Arc<Mutex<HashMap<String, UpstreamStats>>>,
    config: Arc<RwLock<Option<ProxyConfig>>>,
}

fn build_client(proxy_url: Option<&str>) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder()
        .timeout(Duration::from_secs(600));

    if let Some(url) = proxy_url {
        if !url.trim().is_empty() {
            let proxy = reqwest::Proxy::all(url)
                .map_err(|e| format!("代理配置无效: {e}"))?;
            builder = builder.proxy(proxy);
        }
    }

    builder.build().map_err(|e| format!("创建HTTP客户端失败: {e}"))
}

impl ProxyState {
    fn new() -> Self {
        let client = build_client(None).expect("reqwest client");

        Self {
            inner: Mutex::new(HashMap::new()),
            client: Arc::new(RwLock::new(client)),
            logs: Arc::new(Mutex::new(VecDeque::with_capacity(MAX_LOGS))),
            stats: Arc::new(Mutex::new(HashMap::new())),
            config: Arc::new(RwLock::new(None)),
        }
    }
}

#[tauri::command]
async fn start_proxy(config: ProxyConfig, state: TauriState<'_, ProxyState>) -> Result<(), String> {
    // 拒绝空服务，后续校验以避免运行时 crash
    if !(1..=65535).contains(&config.listen_port) {
        return Err("listen_port 无效".into());
    }

    if config.services.is_empty() {
        return Err("至少需要配置一个服务端".into());
    }

    let mut services: Vec<ServiceConfig> = config
        .services
        .into_iter()
        .map(|svc| ServiceConfig {
            id: svc.id,
            name: svc.name.trim().to_string(),
            base_path: normalize_base_path(&svc.base_path),
            enabled: svc.enabled,
            upstreams: svc
                .upstreams
                .into_iter()
                .map(|u| UpstreamEntry {
                    id: u.id,
                    label: u
                        .label
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty()),
                    upstream_base: u.upstream_base.trim().trim_end_matches('/').to_string(),
                    api_key: u.api_key.clone().filter(|s| !s.trim().is_empty()),
                    priority: u.priority,
                    enabled: u.enabled,
                })
                .filter(|u| !u.upstream_base.is_empty())
                .collect(),
        })
        .collect();

    services.retain(|svc| !svc.upstreams.is_empty());

    if services.is_empty() {
        return Err("有效的服务端配置为空".into());
    }

    for svc in services.iter_mut() {
        svc.upstreams.sort_by_key(|u| u.priority);
    }

    let proxy_url = config.proxy_url.clone().filter(|s| !s.trim().is_empty());
    let fallback_retries = config.fallback_retries.min(MAX_FALLBACK_RETRIES);

    let config = ProxyConfig {
        listen_port: config.listen_port,
        global_key: config.global_key.clone().filter(|s| !s.trim().is_empty()),
        proxy_url: proxy_url.clone(),
        fallback_retries,
        services,
    };

    let new_client = build_client(proxy_url.as_deref())?;
    {
        let mut client_guard = state.client.write().await;
        *client_guard = new_client;
    }
    {
        let mut cfg_guard = state.config.write().await;
        *cfg_guard = Some(config.clone());
    }

    if let Err(err) = save_config(&config) {
        eprintln!("配置持久化失败: {err}");
    }

    // Stop existing server if running
    {
        let mut guard = state.inner.lock().await;
        if let Some(existing) = guard.remove(&config.listen_port) {
            let _ = existing.shutdown.send(());
            let _ = existing.join.await;
            finalize_inflight(state.logs.clone(), Some(config.listen_port)).await;
        }
    }

    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    let config_arc = Arc::new(RwLock::new(config.clone()));
    let shared = SharedState {
        config: config_arc.clone(),
        client: state.client.clone(),
        logs: state.logs.clone(),
        stats: state.stats.clone(),
    };

    let addr = SocketAddr::from(([0, 0, 0, 0], config.listen_port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("监听端口失败: {e}"))?;

    let router = Router::new()
        .fallback(any(proxy_handler))
        .with_state(shared);

    let server = axum::serve(listener, router.into_make_service_with_connect_info::<SocketAddr>()).with_graceful_shutdown(async move {
        let _ = shutdown_rx.await;
    });

    let join = tauri::async_runtime::spawn(async move {
        if let Err(err) = server.await {
            eprintln!("{err}");
        }
    });

    let mut guard = state.inner.lock().await;
    guard.insert(
        config.listen_port,
        RunningServer {
            shutdown: shutdown_tx,
            join,
            config: config_arc,
        },
    );

    Ok(())
}

#[tauri::command]
async fn stop_proxy(
    listen_port: Option<u16>,
    state: TauriState<'_, ProxyState>,
) -> Result<(), String> {
    let mut guard = state.inner.lock().await;
    if let Some(port) = listen_port {
        if let Some(running) = guard.remove(&port) {
            let _ = running.shutdown.send(());
            let _ = running.join.await;
            finalize_inflight(state.logs.clone(), Some(port)).await;
        }
    } else {
        let servers: Vec<_> = guard.drain().collect();
        for (_, running) in servers {
            let _ = running.shutdown.send(());
            let _ = running.join.await;
        }
        finalize_inflight(state.logs.clone(), None).await;
    };
    Ok(())
}

#[tauri::command]
async fn get_logs(
    limit: Option<usize>,
    listen_port: Option<u16>,
    state: TauriState<'_, ProxyState>,
) -> Result<Vec<ProxyLogEntry>, String> {
    let guard = state.logs.lock().await;
    let max = limit.unwrap_or(MAX_LOGS).min(MAX_LOGS);
    let filtered: Vec<_> = guard
        .iter()
        .filter(|entry| {
            listen_port
                .map(|lp| lp == entry.listen_port)
                .unwrap_or(true)
        })
        .cloned()
        .collect();
    let len = filtered.len();
    let start = len.saturating_sub(max);
    Ok(filtered.into_iter().skip(start).collect())
}

#[tauri::command]
async fn clear_logs(state: TauriState<'_, ProxyState>) -> Result<(), String> {
    let mut guard = state.logs.lock().await;
    guard.clear();
    Ok(())
}

#[tauri::command]
async fn get_stats(state: TauriState<'_, ProxyState>) -> Result<Vec<UpstreamStats>, String> {
    let guard = state.stats.lock().await;
    Ok(guard.values().cloned().collect())
}

#[tauri::command]
async fn clear_stats(state: TauriState<'_, ProxyState>) -> Result<(), String> {
    let mut guard = state.stats.lock().await;
    guard.clear();
    Ok(())
}

#[tauri::command]
async fn get_network_info() -> Result<NetworkInfo, String> {
    Ok(NetworkInfo {
        local_ip: network::get_local_ip(),
        hostname: network::get_local_hostname(),
        is_macos: cfg!(target_os = "macos"),
    })
}

#[tauri::command]
async fn load_settings() -> Result<Option<ProxyConfig>, String> {
    load_config().map(|cfg| {
        cfg.map(|mut c| {
            c.fallback_retries = c.fallback_retries.min(MAX_FALLBACK_RETRIES);
            c
        })
    })
}

#[tauri::command]
async fn save_settings(config: ProxyConfig, state: TauriState<'_, ProxyState>) -> Result<(), String> {
    let mut config = config;
    config.fallback_retries = config.fallback_retries.min(MAX_FALLBACK_RETRIES);

    save_config(&config)?;
    
    let guard = state.inner.lock().await;
    if let Some(server) = guard.get(&config.listen_port) {
        let mut cfg_guard = server.config.write().await;
        *cfg_guard = config.clone();
    }
    {
        let mut cfg_guard = state.config.write().await;
        *cfg_guard = Some(config.clone());
    }
    Ok(())
}

#[tauri::command]
async fn reload_proxy(config: ProxyConfig, state: TauriState<'_, ProxyState>) -> Result<(), String> {
    // 不允许热切换端口
    {
        let guard = state.config.read().await;
        if let Some(existing) = guard.as_ref() {
            if existing.listen_port != config.listen_port {
                return Err("监听端口已变更，请先停止服务后重启".into());
            }
        } else {
            return Err("未找到运行中的配置，请先启动服务".into());
        }
    }

    if config.services.is_empty() {
        return Err("至少需要配置一个服务端".into());
    }

    let mut services: Vec<ServiceConfig> = config
        .services
        .into_iter()
        .map(|svc| ServiceConfig {
            id: svc.id,
            name: svc.name.trim().to_string(),
            base_path: normalize_base_path(&svc.base_path),
            enabled: svc.enabled,
            upstreams: svc
                .upstreams
                .into_iter()
                .map(|u| UpstreamEntry {
                    id: u.id,
                    label: u
                        .label
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty()),
                    upstream_base: u.upstream_base.trim().trim_end_matches('/').to_string(),
                    api_key: u.api_key.clone().filter(|s| !s.trim().is_empty()),
                    priority: u.priority,
                    enabled: u.enabled,
                })
                .filter(|u| !u.upstream_base.is_empty())
                .collect(),
        })
        .collect();

    services.retain(|svc| !svc.upstreams.is_empty());

    if services.is_empty() {
        return Err("有效的服务端配置为空".into());
    }

    for svc in services.iter_mut() {
        svc.upstreams.sort_by_key(|u| u.priority);
    }

    let proxy_url = config.proxy_url.clone().filter(|s| !s.trim().is_empty());
    let new_client = build_client(proxy_url.as_deref())?;

    {
        let mut client_guard = state.client.write().await;
        *client_guard = new_client;
    }

    let new_cfg = ProxyConfig {
        listen_port: config.listen_port,
        global_key: config.global_key.clone().filter(|s| !s.trim().is_empty()),
        proxy_url: proxy_url.clone(),
        fallback_retries: config.fallback_retries.min(MAX_FALLBACK_RETRIES),
        services,
    };

    {
        let mut guard = state.config.write().await;
        *guard = Some(new_cfg.clone());
    }

    if let Err(err) = save_config(&new_cfg) {
        eprintln!("配置持久化失败: {err}");
    }

    Ok(())
}

async fn proxy_handler(
    ConnectInfo(client_addr): ConnectInfo<SocketAddr>,
    State(shared): State<SharedState>,
    req: Request<Body>,
) -> Result<Response<Body>, StatusCode> {
    let started_at = Instant::now();
    let request_id = Uuid::new_v4();
    let client_ip = client_addr.ip().to_string();
    let (parts, body) = req.into_parts();
    let path = parts
        .uri
        .path_and_query()
        .map(|p| p.as_str())
        .unwrap_or("/");

    let config = shared.config.read().await.clone();

    // 1. Authentication
    if let Err((status, msg)) = check_auth(&config, &parts) {
        let entry = ProxyLogEntry {
            id: request_id.to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            method: parts.method.to_string(),
            path: path.to_string(),
            upstream_url: "".to_string(),
            status: Some(status.as_u16()),
            duration_ms: started_at.elapsed().as_millis(),
            error: Some(msg.to_string()),
            listen_port: config.listen_port,
            route_key: None,
            upstream_label: None,
            service_name: None,
            base_path: None,
            retry_action: None,
            request_headers: None,
            request_body: None,
            response_headers: None,
            response_body: None,
            client_ip: Some(client_ip),
            is_streaming: false,
        };
        logging::upsert_log(shared.logs.clone(), entry).await;
        return Ok(error_response(status, msg));
    }

    // 2. Routing
    let route = match resolve_route(&config, path) {
        Some(r) => r,
        None => return Err(StatusCode::SERVICE_UNAVAILABLE),
    };

    let RouteInfo {
        service_name,
        service_base,
        upstreams,
    } = route;

    let mut entry = ProxyLogEntry {
        id: request_id.to_string(),
        timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        method: parts.method.to_string(),
        path: path.to_string(),
        upstream_url: upstreams
            .first()
            .map(|u| u.upstream_url.clone())
            .unwrap_or_default(),
        status: None,
        duration_ms: 0,
        error: None,
        listen_port: config.listen_port,
        route_key: upstreams
            .first()
            .and_then(|u| u.upstream_label.clone()),
        upstream_label: upstreams
            .first()
            .and_then(|u| u.upstream_label.clone()),
        service_name: Some(service_name),
        base_path: Some(service_base),
        retry_action: None,
        request_headers: None, // 稍后在 prepare_upstream_request 后设置
        request_body: None,
        response_headers: None,
        response_body: None,
        client_ip: Some(client_ip),
        is_streaming: false,
    };

    // Read Body
    let body_bytes = match body.collect().await {
        Ok(collected) => collected.to_bytes(),
        Err(err) => {
            entry.error = Some(format!("读取请求体失败: {err}"));
            entry.duration_ms = started_at.elapsed().as_millis();
            logging::upsert_log(shared.logs.clone(), entry).await;
            return Ok(error_response(StatusCode::BAD_REQUEST, "读取请求体失败"));
        }
    };

    entry.request_body = truncate_body(&body_bytes, 8000);

    let allowed_retries = config.fallback_retries.min(MAX_FALLBACK_RETRIES);
    let retries_per_upstream = allowed_retries.saturating_sub(1); // 0->no retry,1->no retry but allow fallback,2->retry once then fallback
    let allow_fallback = allowed_retries >= 1;
    let mut attempt_errors: Vec<String> = Vec::new();

    for (up_idx, upstream) in upstreams.iter().enumerate() {
        for attempt in 0..=retries_per_upstream {
            let attempt_started = Instant::now();

            entry.upstream_url = upstream.upstream_url.clone();
            entry.route_key = upstream.upstream_label.clone();
            entry.upstream_label = upstream.upstream_label.clone();

            // 3. Prepare Request for this attempt
            let client_guard = shared.client.read().await;
            let (upstream_req, upstream_headers_str) = prepare_upstream_request(
                &client_guard,
                &parts.method,
                &upstream.upstream_url,
                &parts.headers,
                upstream.api_key.as_deref(),
                body_bytes.clone(),
            );
            drop(client_guard); // Release lock before await

            // 记录发给上游的请求头（而不是客户端的原始请求头）
            entry.request_headers = Some(upstream_headers_str);

            // 将“处理中”日志写入队列，便于前端立即展示/更新当前尝试的上游
            logging::upsert_log(shared.logs.clone(), entry.clone()).await;

            // 4. Execute & Handle Response
            let upstream_resp = upstream_req.send().await;

            match upstream_resp {
                Ok(resp) => {
                    let status = resp.status();
                    if should_retry_status(status) && attempt < retries_per_upstream {
                        let mut failed_entry = entry.clone();
                        failed_entry.id = format!("{}-{}-{}", entry.id, up_idx + 1, attempt + 1);
                        failed_entry.status = Some(status.as_u16());
                        failed_entry.duration_ms = attempt_started.elapsed().as_millis();
                        failed_entry.error = Some(format!("上游返回 {status}，已自动重试"));
                        failed_entry.retry_action = Some("retry".into());
                        logging::upsert_log(shared.logs.clone(), failed_entry).await;
                        logging::update_stats(
                            shared.stats.clone(),
                            &upstream.upstream_id,
                            upstream.upstream_label.clone(),
                            attempt_started.elapsed().as_millis() as u64,
                            false,
                        )
                        .await;
                        attempt_errors.push(format!("上游返回 {status}"));
                        continue;
                    }

                    if up_idx > 0 {
                        entry.retry_action = Some("fallback".into());
                    } else if attempt > 0 {
                        entry.retry_action = Some("retry".into());
                    }

                    return handle_upstream_response(
                        resp,
                        entry,
                        started_at,
                        attempt_started,
                        shared.logs.clone(),
                        shared.stats.clone(),
                        upstream.upstream_id.clone(),
                        upstream.upstream_label.clone(),
                    )
                    .await;
                }
                Err(err) => {
                logging::update_stats(
                    shared.stats.clone(),
                    &upstream.upstream_id,
                    upstream.upstream_label.clone(),
                    attempt_started.elapsed().as_millis() as u64,
                    false,
                )
                .await;

                    let mut failed_entry = entry.clone();
                    failed_entry.id = format!("{}-{}-{}", entry.id, up_idx + 1, attempt + 1);
                    failed_entry.status = Some(StatusCode::BAD_GATEWAY.as_u16());
                    failed_entry.duration_ms = attempt_started.elapsed().as_millis();
                    let has_retry_left = attempt < retries_per_upstream;
                    let has_next_upstream = allow_fallback && up_idx + 1 < upstreams.len();
                    failed_entry.error = Some(match () {
                        _ if has_retry_left => format!("{}，已自动重试", err),
                        _ if has_next_upstream => format!("{}，已自动切换上游", err),
                        _ => err.to_string(),
                    });
                    failed_entry.retry_action = if has_retry_left {
                        Some("retry".into())
                    } else if has_next_upstream {
                        Some("fallback".into())
                    } else {
                        None
                    };
                logging::upsert_log(shared.logs.clone(), failed_entry).await;
                attempt_errors.push(err.to_string());

                if has_retry_left {
                    continue;
                }

                // Exhausted retries for this upstream; try next if available
                if allow_fallback && up_idx + 1 < upstreams.len() {
                    break; // move to next upstream
                }

                    // No upstreams left
                    entry.error = Some(format!(
                        "上游请求失败: {}",
                        attempt_errors.join("; ")
                    ));
                    entry.status = Some(StatusCode::BAD_GATEWAY.as_u16());
                    entry.duration_ms = started_at.elapsed().as_millis();
                    logging::upsert_log(shared.logs.clone(), entry).await;
                    return Ok(error_response(
                        StatusCode::BAD_GATEWAY,
                        "上游请求失败，请检查配置",
                    ));
                }
            }
        }
    }

    Err(StatusCode::BAD_GATEWAY)
}

// --- Helper Functions ---

fn check_auth(config: &ProxyConfig, parts: &http::request::Parts) -> Result<(), (StatusCode, &'static str)> {
    let provided_key = extract_proxy_key(parts);
    if let Some(global_key) = &config.global_key {
        if provided_key.as_deref() != Some(global_key.as_str()) {
            return Err((StatusCode::UNAUTHORIZED, "未授权"));
        }
    }
    Ok(())
}

struct RouteInfo {
    service_name: String,
    service_base: String,
    upstreams: Vec<ResolvedUpstream>,
}

#[derive(Clone)]
struct ResolvedUpstream {
    upstream_url: String,
    upstream_id: String,
    upstream_label: Option<String>,
    api_key: Option<String>,
}

fn enabled_upstreams_sorted<'a>(upstreams: &'a [UpstreamEntry]) -> Vec<&'a UpstreamEntry> {
    let mut enabled: Vec<&UpstreamEntry> = upstreams.iter().filter(|u| u.enabled).collect();
    enabled.sort_by_key(|u| u.priority);
    enabled
}

fn resolve_route(config: &ProxyConfig, path: &str) -> Option<RouteInfo> {
    let service = select_service(config, path)?;
    let trimmed_path = strip_base_path(path, &service.base_path);

    let enabled_upstreams = enabled_upstreams_sorted(&service.upstreams);

    if enabled_upstreams.is_empty() {
        return None;
    }

    let upstreams: Vec<ResolvedUpstream> = enabled_upstreams
        .into_iter()
        .map(|u| ResolvedUpstream {
            upstream_url: build_upstream_url(&u.upstream_base, &trimmed_path),
            upstream_id: u.id.clone(),
            upstream_label: u.label.clone(),
            api_key: u.api_key.clone(),
        })
        .collect();

    Some(RouteInfo {
        service_name: service.name.clone(),
        service_base: service.base_path.clone(),
        upstreams,
    })
}

fn should_retry_status(status: StatusCode) -> bool {
    status.is_server_error()
        || status == StatusCode::TOO_MANY_REQUESTS
        || status == StatusCode::REQUEST_TIMEOUT
}

/// 返回 (RequestBuilder, 上游请求头字符串用于日志)
fn prepare_upstream_request(
    client: &reqwest::Client,
    method: &http::Method,
    url: &str,
    headers: &header::HeaderMap,
    api_key: Option<&str>,
    body: Bytes,
) -> (reqwest::RequestBuilder, String) {
    let mut builder = client.request(method.clone(), url);
    let mut upstream_headers: Vec<(String, String)> = Vec::new();

    // Detect which auth header the client is using to pass it through correctly or adapt it
    let mut client_auth_header: Option<header::HeaderValue> = None;
    let mut client_goog_key: Option<header::HeaderValue> = None;
    let uses_goog_api_key = headers
        .keys()
        .any(|name| name.as_str().eq_ignore_ascii_case("x-goog-api-key"));

    for (name, value) in headers.iter() {
        if name == header::HOST || name == header::CONTENT_LENGTH {
            continue;
        }
        // Auth header处理：记录原值，稍后根据配置决定覆盖或回填
        if name == header::AUTHORIZATION {
            client_auth_header = Some(value.clone());
            continue;
        }
        if name.as_str().eq_ignore_ascii_case("x-goog-api-key") {
            client_goog_key = Some(value.clone());
            continue;
        }
        if name.as_str().eq_ignore_ascii_case("x-proxy-key") {
            continue;
        }
        builder = builder.header(name.clone(), value.clone());
        upstream_headers.push((name.to_string(), value.to_str().unwrap_or("<binary>").to_string()));
    }

    // 优先使用配置的上游 key，否则回填客户端提供的 auth
    match api_key {
        Some(key) => {
            if uses_goog_api_key {
                builder = builder.header("x-goog-api-key", key);
                upstream_headers.push(("x-goog-api-key".to_string(), key.to_string()));
            } else {
                builder = builder.bearer_auth(key);
                upstream_headers.push(("authorization".to_string(), format!("Bearer {}", key)));
            }
        }
        None => {
            if let Some(v) = client_goog_key.clone() {
                builder = builder.header("x-goog-api-key", v.clone());
                upstream_headers.push(("x-goog-api-key".to_string(), v.to_str().unwrap_or("<binary>").to_string()));
            }
            if let Some(v) = client_auth_header.clone() {
                builder = builder.header(header::AUTHORIZATION, v.clone());
                upstream_headers.push(("authorization".to_string(), v.to_str().unwrap_or("<binary>").to_string()));
            }
        }
    }

    let headers_str = upstream_headers
        .iter()
        .map(|(k, v)| format!("{}: {}", k, v))
        .collect::<Vec<_>>()
        .join("\n");

    (builder.body(body), headers_str)
}

async fn handle_upstream_response(
    resp: reqwest::Response,
    mut entry: ProxyLogEntry,
    request_started: Instant,
    attempt_started: Instant,
    logs: Arc<Mutex<VecDeque<ProxyLogEntry>>>,
    stats: Arc<Mutex<HashMap<String, UpstreamStats>>>,
    upstream_id: String,
    upstream_label: Option<String>,
) -> Result<Response<Body>, StatusCode> {
    let status = resp.status();
    entry.status = Some(status.as_u16());

    let headers = resp.headers().clone();
    entry.response_headers = Some(format_headers(&headers));

    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let is_streaming = content_type.contains("text/event-stream")
        || content_type.contains("application/x-ndjson")
        || content_type.contains("text/plain");

    entry.is_streaming = is_streaming;

    if is_streaming {
        handle_streaming_body(
            resp,
            entry,
            request_started,
            attempt_started,
            logs,
            stats,
            upstream_id,
            upstream_label,
            status,
            headers,
        )
    } else {
        handle_regular_body(
            resp,
            entry,
            request_started,
            attempt_started,
            logs,
            stats,
            upstream_id,
            upstream_label,
            status,
            headers,
        )
        .await
    }
}

fn handle_streaming_body(
    resp: reqwest::Response,
    entry: ProxyLogEntry,
    request_started: Instant,
    attempt_started: Instant,
    logs: Arc<Mutex<VecDeque<ProxyLogEntry>>>,
    stats: Arc<Mutex<HashMap<String, UpstreamStats>>>,
    upstream_id: String,
    upstream_label: Option<String>,
    status: StatusCode,
    headers: header::HeaderMap,
) -> Result<Response<Body>, StatusCode> {
    let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<Result<Bytes, std::io::Error>>();
    let mut byte_stream = resp.bytes_stream();

    let entry_clone = entry.clone();
    
    tokio::spawn(async move {
        let mut collected = BytesMut::new();

        while let Some(chunk) = byte_stream.next().await {
            match chunk {
                Ok(bytes) => {
                    collected.extend_from_slice(&bytes);
                    if tx.send(Ok(bytes)).is_err() {
                        break;
                    }
                }
                Err(e) => {
                    let _ = tx.send(Err(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())));
                    break;
                }
            }
        }

        let response_body = if collected.is_empty() {
            Some("[流式响应]".to_string())
        } else {
            truncate_body(&collected, 64000)
        };

        let mut final_entry = entry_clone;
        final_entry.response_body = response_body;
        final_entry.duration_ms = request_started.elapsed().as_millis();

        logging::upsert_log(logs, final_entry).await;
        logging::update_stats(
            stats,
            &upstream_id,
            upstream_label,
            attempt_started.elapsed().as_millis() as u64,
            !status.is_client_error() && !status.is_server_error(),
        )
        .await;
    });

    let stream = tokio_stream::wrappers::UnboundedReceiverStream::new(rx);
    let body = Body::from_stream(stream);
    build_response(status, headers, body)
}

async fn handle_regular_body(
    resp: reqwest::Response,
    mut entry: ProxyLogEntry,
    request_started: Instant,
    attempt_started: Instant,
    logs: Arc<Mutex<VecDeque<ProxyLogEntry>>>,
    stats: Arc<Mutex<HashMap<String, UpstreamStats>>>,
    upstream_id: String,
    upstream_label: Option<String>,
    status: StatusCode,
    headers: header::HeaderMap,
) -> Result<Response<Body>, StatusCode> {
    let body_bytes = match resp.bytes().await {
        Ok(bytes) => bytes,
        Err(err) => {
            entry.error = Some(format!("读取上游响应失败: {err}"));
            entry.duration_ms = request_started.elapsed().as_millis();
            logging::upsert_log(logs, entry).await;
            return Ok(error_response(StatusCode::BAD_GATEWAY, "上游响应读取失败"));
        }
    };

    entry.duration_ms = request_started.elapsed().as_millis();
    entry.response_body = truncate_body(&body_bytes, 8000);

    if status.is_client_error() || status.is_server_error() {
        let text = String::from_utf8_lossy(&body_bytes);
        let snippet: String = text.chars().take(2000).collect();
        entry.error = Some(format!("上游返回 {status}: {snippet}"));
    }

    logging::update_stats(
        stats,
        &upstream_id,
        upstream_label,
        attempt_started.elapsed().as_millis() as u64,
        !status.is_client_error() && !status.is_server_error(),
    )
    .await;

    logging::upsert_log(logs, entry).await;

    build_response(status, headers, Body::from(body_bytes))
}

fn build_response(
    status: StatusCode,
    headers: header::HeaderMap,
    body: Body,
) -> Result<Response<Body>, StatusCode> {
    let mut builder = Response::builder().status(status);
    for (name, value) in headers.iter() {
        if name == header::TRANSFER_ENCODING
            || name == header::CONTENT_LENGTH
            || name == header::CONNECTION
        {
            continue;
        }
        builder = builder.header(name, value);
    }
    builder.body(body).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[cfg(test)]
fn select_upstream<'a>(upstreams: &'a [UpstreamEntry]) -> Option<&'a UpstreamEntry> {
    let enabled = enabled_upstreams_sorted(upstreams);
    if enabled.is_empty() {
        return None;
    }

    enabled.into_iter().next()
}

fn select_service<'a>(config: &'a ProxyConfig, path: &str) -> Option<&'a ServiceConfig> {
    let enabled: Vec<&ServiceConfig> = config.services.iter().filter(|s| s.enabled).collect();
    if enabled.is_empty() {
        return None;
    }

    let mut candidates: Vec<&ServiceConfig> = enabled
        .into_iter()
        .filter(|svc| {
            if svc.base_path == "/" {
                return true;
            }
            path.starts_with(&svc.base_path)
        })
        .collect();

    candidates.sort_by_key(|svc| std::cmp::Reverse(svc.base_path.len()));
    candidates.into_iter().next()
}



fn error_response(status: StatusCode, msg: &str) -> Response<Body> {
    let payload = serde_json::json!({ "error": msg }).to_string();
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(payload))
        .unwrap_or_else(|_| {
            Response::builder()
                .status(status)
                .body(Body::empty())
                .unwrap()
        })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(ProxyState::new())
        .invoke_handler(tauri::generate_handler![
            start_proxy,
            stop_proxy,
            get_logs,
            clear_logs,
            get_stats,
            clear_stats,
            load_settings,
            save_settings,
            reload_proxy,
            update_tray_status,
            get_network_info
        ])
        .setup(|app| {
            tray::setup_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
