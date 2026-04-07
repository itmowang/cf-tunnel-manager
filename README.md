# CF Tunnel Manager

可视化管理 Cloudflare Tunnel 的 Windows 桌面工具。告别命令行，一键管理隧道、端口映射、DNS 记录。

## 下载

👉 [tun.loli.wang](https://tun.loli.wang) 或 [GitHub Releases](https://github.com/itmowang/cf-tunnel-manager/releases)

- **安装版** `CF-Tunnel-Manager-Setup-x.x.x.exe` — 标准安装，支持自动更新
- **便携版** `CF-Tunnel-Manager-Portable-x.x.x.exe` — 免安装，下载即用

## 快速开始

### 1. 创建 Cloudflare API Token

进入 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) 页面，点击 **Create Token**，选择 **Create Custom Token**，配置以下权限：

| 资源 | 权限 |
|------|------|
| Account > Cloudflare Tunnel | Edit |
| Zone > Zone | Read |
| Zone > DNS | Edit |

Zone Resources 选择 **All zones**（或指定你需要的域名）。

创建后复制 Token 备用。

### 2. 首次启动

1. 打开应用，首次会检测 `cloudflared` 是否已安装
2. 如果未安装，点击 **一键下载 cloudflared**，等待下载完成
3. 检测通过后自动进入主界面

### 3. 配置 API Token

1. 点击左侧 **设置**
2. 在 **Cloudflare API Token** 区域粘贴你的 Token
3. 点击 **验证**，显示 ✅ 已验证 即可

### 4. 同步隧道

回到 **控制面板**，应用会自动从 Cloudflare 同步你所有的隧道。也可以点击 **同步隧道** 手动刷新。

### 5. 创建新隧道

1. 点击 **添加隧道**
2. 从列表选择已有隧道，或点击 **创建新隧道** 输入名称直接创建
3. 隧道会自动添加到控制面板

### 6. 配置端口映射

1. 在隧道卡片上点击 **端口映射**（🌐 图标）
2. 点击 **添加规则**
3. 填写子域名（如 `app`），从下拉列表选择主域名（如 `example.com`）
4. 填写本地服务地址（如 `http://localhost:3000`）
5. 点击 **保存并启动**

保存时会自动：
- 将路由规则推送到 Cloudflare
- 创建对应的 DNS CNAME 记录
- 启动隧道

### 7. 启动 / 停止隧道

- 点击隧道卡片上的 ▶️ **启动** 或 ⏹ **停止**
- 点击 ⚡ 电源图标开启 **自动启动**，下次打开应用时自动运行该隧道

## 功能一览

- 🔑 API Token 集成，自动同步所有隧道
- ➕ 直接在应用内创建新隧道
- 🌐 可视化端口映射，下拉选择域名
- 📡 自动创建 / 删除 DNS CNAME 记录
- ⬇️ 内置 cloudflared 一键下载
- ⚡ 隧道自动启动
- 🖥️ 系统托盘常驻
- 📋 实时运行日志
- 🔄 应用内自动更新

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

---

Made by [魔王](https://github.com/itmowang)
