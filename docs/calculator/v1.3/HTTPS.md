# 内网 HTTPS 待启用配置

当前 HTTP 入口：[打开 LabNest](http://192.168.0.109:3000)。2026-09-07 11:30 UTC 从部署主机检查 `/api/health`，返回 HTTP 200、`status=ok`、`database=reachable`。这是本次网络下的地址，尚未验证手机访问，也不是已启用的 HTTPS 地址。

内网 IP 可能随网络切换或 DHCP 分配而变化。Mac 当前 Wi-Fi 地址可用 `ipconfig getifaddr en0` 核对；若该接口没有地址，在系统设置 → 网络 → 当前连接中查看 IP。以实际局域网接口为准，VPN 的默认路由不代表手机可访问的局域网地址。地址变化后应重新检查 `http://当前IP:3000/api/health`，不要继续使用旧 IP。

历史验收地址 `http://172.17.65.77:3000` 已不作为当前入口。此前该地址的实测结果为：isSecureContext=false，Clipboard/ServiceWorker 不可用；localhost 为 true。worker 本身 MIME 正确、状态200、Service-Worker-Allowed=/，没有iframe。详情 evidence/deployment-environment.json。历史证据保留原地址，不代表本次重新验证了上述浏览器功能。这不是所有缓存异常的统一解释。

用户确认没有现成域名/证书。提供 opt-in Caddy 内网 CA 配置，不创建公网隧道，不关闭浏览器安全策略。

1. 在部署主机选定固定内网IP或内部DNS名，设 `LABNEST_HTTPS_HOST` 为该名称（仅主机名或IP，不带协议和端口）。例如本次网络可设 `export LABNEST_HTTPS_HOST=192.168.0.109`；长期使用建议先固定地址。此配置值变化后须重新创建 HTTPS 容器，不能只改本文链接。
2. 从实际部署工作区执行 `docker compose -p labnest -f docker-compose.yml -f docker-compose.https.yml up -d https`。
3. 从新容器 `/data/caddy/pki/authorities/local/root.crt` 导出公开根证书；不复制其私钥。仅将此CA安装到受控实验室设备的受信任根证书中。iOS须同时在“证书信任设置”启用完全信任；由设备持有人执行。
4. 打开 `https://所设主机名/`，确认无证书警告、地址匹配，控制台 `isSecureContext===true`。验证 `/api/health` 与 worker MIME/作用域。
5. 准备主页+工具离线，关闭标签、断网、新标签重新打开该工具。按 MANUAL.md 测真机键盘和100%/≤160%。

没有执行CA安装/真机信任，不将该配置视为已部署HTTPS。HTTP仍支持草稿和经过浏览器验证的复制兼容分支；不能绕过Service Worker安全上下文限制。

技术依据：[MDN Clipboard](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)、[MDN Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)。
