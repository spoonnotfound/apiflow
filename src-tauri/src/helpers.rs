use http::header;

pub fn normalize_base_path(path: &str) -> String {
    let mut p = path.trim().to_string();
    if p.is_empty() {
        return "/".to_string();
    }
    if !p.starts_with('/') {
        p.insert(0, '/');
    }
    while p.ends_with('/') && p.len() > 1 {
        p.pop();
    }
    p
}

pub fn strip_base_path<'a>(path: &'a str, base: &str) -> &'a str {
    if base == "/" {
        return path;
    }
    path.strip_prefix(base).unwrap_or(path)
}

pub fn build_upstream_url(base: &str, path_and_query: &str) -> String {
    let mut result = base.to_string();
    if !result.ends_with('/') && !path_and_query.starts_with('/') {
        result.push('/');
    }
    if result.ends_with('/') && path_and_query.starts_with('/') {
        result.pop();
    }
    result.push_str(path_and_query);
    result
}

pub fn format_headers(headers: &http::HeaderMap) -> String {
    headers
        .iter()
        .filter(|(name, _)| {
            let n = name.as_str().to_lowercase();
            n != "authorization" && n != "x-proxy-key"
        })
        .map(|(name, value)| {
            format!("{}: {}", name.as_str(), value.to_str().unwrap_or("<binary>"))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn truncate_body(bytes: &[u8], _max_len: usize) -> Option<String> {
    if bytes.is_empty() {
        return None;
    }
    Some(String::from_utf8_lossy(bytes).into_owned())
}

pub fn extract_proxy_key(parts: &http::request::Parts) -> Option<String> {
    if let Some(v) = parts.headers.get("x-proxy-key") {
        if let Ok(s) = v.to_str() {
            let trimmed = s.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    if let Some(auth) = parts.headers.get(header::AUTHORIZATION) {
        if let Ok(text) = auth.to_str() {
            let trimmed = text.trim();
            if let Some(rest) = trimmed.strip_prefix("Bearer ") {
                if !rest.is_empty() {
                    return Some(rest.to_string());
                }
            } else if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    None
}
