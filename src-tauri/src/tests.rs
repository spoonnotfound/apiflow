use super::*;
use crate::{ProxyConfig, ServiceConfig, UpstreamEntry};
use crate::helpers::{build_upstream_url, normalize_base_path, strip_base_path};

fn create_test_config() -> ProxyConfig {
    ProxyConfig {
        listen_port: 8080,
        global_key: None,
        proxy_url: None,
        services: vec![
            ServiceConfig {
                id: "svc1".into(),
                name: "Test Service".into(),
                base_path: "/api".into(),
                enabled: true,
                upstreams: vec![
                    UpstreamEntry {
                        id: "up1".into(),
                        label: Some("Upstream 1".into()),
                        upstream_base: "http://localhost:9999".into(),
                        api_key: None,
                        priority: 1,
                        enabled: true,
                    }
                ],
            }
        ],
    }
}

#[test]
fn normalize_base_path_handles_empty_and_slashes() {
    assert_eq!(normalize_base_path(""), "/");
    assert_eq!(normalize_base_path("api"), "/api");
    assert_eq!(normalize_base_path("/api/"), "/api");
}

#[test]
fn strip_base_path_removes_prefix() {
    assert_eq!(strip_base_path("/api/v1/chat", "/api"), "/v1/chat");
    assert_eq!(strip_base_path("/any", "/"), "/any");
}

#[test]
fn build_upstream_url_respects_separators() {
    assert_eq!(build_upstream_url("https://a.com", "/v1"), "https://a.com/v1");
    assert_eq!(build_upstream_url("https://a.com/", "v1"), "https://a.com/v1");
}

#[test]
fn select_service_prefers_longest_prefix() {
    let services = vec![
        ServiceConfig {
            id: "1".into(),
            name: "root".into(),
            base_path: "/".into(),
            enabled: true,
            upstreams: vec![],
        },
        ServiceConfig {
            id: "2".into(),
            name: "api".into(),
            base_path: "/api".into(),
            enabled: true,
            upstreams: vec![],
        },
    ];
    let cfg = ProxyConfig {
        listen_port: 1,
        global_key: None,
        proxy_url: None,
        services,
    };

    let svc = select_service(&cfg, "/api/v1").expect("service");
    assert_eq!(svc.name, "api");
}

#[test]
fn select_upstream_respects_priority_and_enabled() {
    let upstreams = vec![
        UpstreamEntry {
            id: "a".into(),
            label: None,
            upstream_base: "http://a".into(),
            api_key: None,
            priority: 5,
            enabled: true,
        },
        UpstreamEntry {
            id: "b".into(),
            label: None,
            upstream_base: "http://b".into(),
            api_key: None,
            priority: 1,
            enabled: false,
            },
            UpstreamEntry {
                id: "c".into(),
                label: None,
                upstream_base: "http://c".into(),
                api_key: None,
                priority: 2,
                enabled: true,
            },
        ];

        let chosen = select_upstream(&upstreams).expect("upstream");
        assert_eq!(chosen.id, "c");
    }

#[test]
fn test_check_auth_no_key() {
    let config = create_test_config();
    let parts = http::Request::builder()
        .uri("http://localhost:8080/api/test")
        .body(())
        .unwrap()
        .into_parts()
        .0;
    
    assert!(check_auth(&config, &parts).is_ok());
}

#[test]
fn test_check_auth_with_global_key_success() {
    let mut config = create_test_config();
    config.global_key = Some("secret123".into());

    let parts = http::Request::builder()
        .uri("http://localhost:8080/api/test")
        .header("Authorization", "Bearer secret123")
        .body(())
        .unwrap()
        .into_parts()
        .0;
    
    assert!(check_auth(&config, &parts).is_ok());
}

#[test]
fn test_check_auth_with_global_key_failure() {
    let mut config = create_test_config();
    config.global_key = Some("secret123".into());

    let parts = http::Request::builder()
        .uri("http://localhost:8080/api/test")
        .header("Authorization", "Bearer wrong")
        .body(())
        .unwrap()
        .into_parts()
        .0;
    
    assert!(check_auth(&config, &parts).is_err());
}

#[test]
fn test_resolve_route_success() {
    let config = create_test_config();
    let route = resolve_route(&config, "/api/users/1");
    
    assert!(route.is_some());
    let r = route.unwrap();
    assert_eq!(r.service_name, "Test Service");
    assert_eq!(r.upstream_url, "http://localhost:9999/users/1");
}

#[test]
fn test_resolve_route_no_match() {
    let config = create_test_config();
    let route = resolve_route(&config, "/other/path");
    assert!(route.is_none());
}

#[tokio::test]
async fn test_prepare_upstream_request() {
    let client = reqwest::Client::new();
    let method = http::Method::POST;
    let url = "http://example.com/v1/chat";
    
    let mut headers = http::HeaderMap::new();
    headers.insert("content-type", "application/json".parse().unwrap());
    headers.insert("x-custom", "foo".parse().unwrap());
    // Should be filtered out
    headers.insert("host", "original.com".parse().unwrap());
    headers.insert("authorization", "Bearer original".parse().unwrap());

    let api_key = Some("new-key");
    let body = Bytes::from("test body");

    let (req_builder, _headers_str) = prepare_upstream_request(
        &client,
        &method,
        url,
        &headers,
        api_key,
        body
    );
    let req = req_builder.build().unwrap();

    assert_eq!(req.method(), http::Method::POST);
    assert_eq!(req.url().as_str(), "http://example.com/v1/chat");
    
    // Check headers
    assert_eq!(req.headers().get("content-type").unwrap(), "application/json");
    assert_eq!(req.headers().get("x-custom").unwrap(), "foo");
    assert!(req.headers().get("host").is_none()); // filtered
    
    // Check auth replacement
    let auth = req.headers().get("authorization").unwrap().to_str().unwrap();
    assert_eq!(auth, "Bearer new-key");
}