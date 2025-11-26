use crate::ProxyConfig;
use directories::ProjectDirs;
use std::fs;
use std::path::PathBuf;

pub fn config_file_path() -> Result<PathBuf, String> {
    let proj = ProjectDirs::from("com", "apiflow", "app").ok_or("无法定位配置目录")?;
    let mut path = proj.config_dir().to_path_buf();
    fs::create_dir_all(&path).map_err(|e| format!("创建配置目录失败: {e}"))?;
    path.push("config.json");
    Ok(path)
}

pub fn save_config(config: &ProxyConfig) -> Result<(), String> {
    let path = config_file_path()?;
    let json = serde_json::to_string_pretty(config).map_err(|e| format!("序列化失败: {e}"))?;
    fs::write(path, json).map_err(|e| format!("写入配置失败: {e}"))
}

pub fn load_config() -> Result<Option<ProxyConfig>, String> {
    let path = config_file_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let data = fs::read_to_string(&path).map_err(|e| format!("读取配置失败: {e}"))?;
    let cfg: ProxyConfig = serde_json::from_str(&data).map_err(|e| format!("解析配置失败: {e}"))?;
    Ok(Some(cfg))
}
