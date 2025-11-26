use criterion::{black_box, criterion_group, criterion_main, Criterion};
use mlua::{Lua, LuaSerdeExt, Result as LuaResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RequestContext {
    url: String,
    method: String,
    headers: std::collections::HashMap<String, String>,
    body: serde_json::Value,
}

fn create_lua_vm() -> Lua {
    Lua::new()
}

fn simple_transform(lua: &Lua, ctx: &RequestContext) -> LuaResult<RequestContext> {
    let script = r#"
        function transform(ctx)
            ctx.url = ctx.url:gsub("/v1/", "/v2/")
            return ctx
        end
    "#;
    lua.load(script).exec()?;

    let transform: mlua::Function = lua.globals().get("transform")?;
    let lua_ctx = lua.to_value(ctx)?;
    let result: mlua::Value = transform.call(lua_ctx)?;
    lua.from_value(result)
}

fn complex_transform(lua: &Lua, ctx: &RequestContext) -> LuaResult<RequestContext> {
    let script = r#"
        function transform(ctx)
            -- URL 替换
            ctx.url = ctx.url:gsub("/v1/", "/v2/")

            -- Header 修改
            ctx.headers["x-transformed"] = "true"
            ctx.headers["x-timestamp"] = tostring(os.time())

            -- Body 修改
            if ctx.body and ctx.body.model then
                if ctx.body.model == "gpt-3.5-turbo" then
                    ctx.body.model = "gpt-4o"
                end
            end

            -- 添加额外字段
            if ctx.body then
                ctx.body.transformed = true
            end

            return ctx
        end
    "#;
    lua.load(script).exec()?;

    let transform: mlua::Function = lua.globals().get("transform")?;
    let lua_ctx = lua.to_value(ctx)?;
    let result: mlua::Value = transform.call(lua_ctx)?;
    lua.from_value(result)
}

fn precompiled_transform(lua: &Lua, transform_fn: &mlua::Function, ctx: &RequestContext) -> LuaResult<RequestContext> {
    let lua_ctx = lua.to_value(ctx)?;
    let result: mlua::Value = transform_fn.call(lua_ctx)?;
    lua.from_value(result)
}

fn benchmark_lua(c: &mut Criterion) {
    let mut headers = std::collections::HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());
    headers.insert("authorization".to_string(), "Bearer sk-xxx".to_string());

    let ctx = RequestContext {
        url: "/v1/chat/completions".to_string(),
        method: "POST".to_string(),
        headers,
        body: json!({
            "model": "gpt-3.5-turbo",
            "messages": [
                {"role": "user", "content": "Hello!"}
            ],
            "temperature": 0.7
        }),
    };

    // Benchmark 1: 创建 Lua VM
    c.bench_function("lua_vm_create", |b| {
        b.iter(|| {
            black_box(create_lua_vm());
        });
    });

    // Benchmark 2: 简单转换（每次重新加载脚本）
    c.bench_function("lua_simple_transform", |b| {
        let lua = create_lua_vm();
        b.iter(|| {
            black_box(simple_transform(&lua, &ctx).unwrap());
        });
    });

    // Benchmark 3: 复杂转换
    c.bench_function("lua_complex_transform", |b| {
        let lua = create_lua_vm();
        b.iter(|| {
            black_box(complex_transform(&lua, &ctx).unwrap());
        });
    });

    // Benchmark 4: 预编译脚本（推荐方式）
    c.bench_function("lua_precompiled_transform", |b| {
        let lua = create_lua_vm();
        let script = r#"
            function transform(ctx)
                ctx.url = ctx.url:gsub("/v1/", "/v2/")
                if ctx.body and ctx.body.model == "gpt-3.5-turbo" then
                    ctx.body.model = "gpt-4o"
                end
                return ctx
            end
        "#;
        lua.load(script).exec().unwrap();
        let transform_fn: mlua::Function = lua.globals().get("transform").unwrap();

        b.iter(|| {
            black_box(precompiled_transform(&lua, &transform_fn, &ctx).unwrap());
        });
    });

    // Benchmark 5: 纯 Rust 字符串替换（对比基准）
    c.bench_function("rust_string_replace", |b| {
        b.iter(|| {
            let mut ctx = ctx.clone();
            ctx.url = ctx.url.replace("/v1/", "/v2/");
            if let Some(model) = ctx.body.get("model").and_then(|v| v.as_str()) {
                if model == "gpt-3.5-turbo" {
                    ctx.body["model"] = json!("gpt-4o");
                }
            }
            black_box(ctx);
        });
    });
}

criterion_group!(benches, benchmark_lua);
criterion_main!(benches);
