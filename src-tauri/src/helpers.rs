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
            format!(
                "{}: {}",
                name.as_str(),
                value.to_str().unwrap_or("<binary>")
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn looks_like_text(bytes: &[u8]) -> bool {
    // Allow common control chars used in text, reject other control bytes to avoid logging binary noise
    const TEXT_WHITELIST: [u8; 3] = [b'\n', b'\r', b'\t'];
    bytes
        .iter()
        .take(512)
        .all(|b| TEXT_WHITELIST.contains(b) || (*b >= 0x20 && *b != 0x7F))
}

fn is_textual_content_type(content_type: &str) -> bool {
    let ct = content_type.to_ascii_lowercase();
    ct.starts_with("text/")
        || ct.contains("json")
        || ct.contains("xml")
        || ct.contains("javascript")
        || ct.contains("x-www-form-urlencoded")
        || ct.contains("graphql")
        || ct.contains("charset=") // presence of charset hints text-like payload
}

fn extract_charset(content_type: &str) -> Option<String> {
    content_type.split(';').skip(1).find_map(|param| {
        let mut parts = param.trim().splitn(2, '=');
        let name = parts.next()?.trim();
        if !name.eq_ignore_ascii_case("charset") {
            return None;
        }
        let value = parts.next()?.trim().trim_matches(['\'', '"'].as_ref());
        if value.is_empty() {
            None
        } else {
            Some(value.to_string())
        }
    })
}

fn decode_bytes(bytes: &[u8], charset: Option<&str>) -> String {
    if let Some(label) = charset {
        if let Some(encoding) = encoding_rs::Encoding::for_label(label.trim().as_bytes()) {
            let (cow, _, _) = encoding.decode(bytes);
            return cow.into_owned();
        }
    }
    String::from_utf8_lossy(bytes).into_owned()
}

/// Convert a raw body into a printable preview, honoring charset when available and skipping obvious binary payloads.
pub fn truncate_body(bytes: &[u8], max_len: usize, content_type: Option<&str>) -> Option<String> {
    if bytes.is_empty() {
        return None;
    }

    let total_len = bytes.len();
    let truncated = &bytes[..std::cmp::min(total_len, max_len)];

    let is_text = content_type
        .map(is_textual_content_type)
        .unwrap_or_else(|| looks_like_text(truncated));

    if !is_text {
        return Some(format!("[非文本内容，已隐藏，约 {} 字节]", total_len));
    }

    let decoded = decode_bytes(truncated, content_type.and_then(extract_charset).as_deref());
    if total_len > max_len {
        Some(format!(
            "{}\n… 内容已截断，显示前 {}/{} 字节",
            decoded, max_len, total_len
        ))
    } else {
        Some(decoded)
    }
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
