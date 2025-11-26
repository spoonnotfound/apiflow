use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/NetworkInfo.ts")]
#[serde(rename_all = "camelCase")]
pub struct NetworkInfo {
    pub local_ip: Option<String>,
    pub hostname: Option<String>,
    pub is_macos: bool,
}

pub fn get_local_ip() -> Option<String> {
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    socket.local_addr().ok().map(|addr| addr.ip().to_string())
}

pub fn get_local_hostname() -> Option<String> {
    hostname::get().ok()?.into_string().ok()
}
