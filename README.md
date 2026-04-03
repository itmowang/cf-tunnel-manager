# CF Tunnel Manager

可视化管理 Cloudflare Tunnel 的桌面工具。

![screenshot](docs/screenshot.png)

## 功能

- 🔑 填入 Cloudflare API Token，自动同步所有隧道
- 🌐 可视化管理端口映射（Ingress 规则），自动推送到 Cloudflare
- 📡 自动创建 DNS CNAME 记录
- ⬇️ 内置 cloudflared 一键下载
- 🖥️ 系统托盘常驻，一键启停隧道
- 📋 实时查看隧道运行日志

## 安装

从 [Releases](../../releases) 页面下载：

- `CF-Tunnel-Manager-Setup-x.x.x.exe` — 安装版
- `CF-Tunnel-Manager-x.x.x.exe` — 便携版（免安装）

## 使用

1. 首次启动会自动检测 cloudflared，未安装可一键下载
2. 进入设置，填入 Cloudflare API Token（需要权限：Account Tunnel Read/Edit、Zone Read、DNS Edit）
3. 回到控制面板，点击「同步隧道」拉取所有隧道
4. 点击隧道卡片上的「端口映射」配置域名到本地服务的映射
5. 点击「启动」运行隧道

## API Token 权限

创建 Token 时需要以下权限：

| 资源 | 权限 |
|------|------|
| Account > Cloudflare Tunnel | Edit |
| Zone > Zone | Read |
| Zone > DNS | Edit |

## 开发

```bash
pnpm install
pnpm run electron:dev
```

## 构建

```bash
pnpm run build
```

产物在 `release/` 目录。

## License

MIT
