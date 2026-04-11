# 德扑记分系统 — 部署指南 (Ubuntu + Docker + Apache2 + HTTPS)

## 架构

```
用户 → https://poker.example.com
        ↓
    Apache2 (443/80)  ← SSL 终止 + 反向代理
        ↓
    Docker 容器 (127.0.0.1:8085)  ← FastAPI + 前端静态文件
        ↓
    SQLite (./data/poker.db)
```

---

## 第一步：准备服务器

```bash
# 确认 Docker 和 Apache 已安装
docker --version
docker compose version
apache2 -v
```

---

## 第二步：上传项目到服务器

```bash
# 方式1: git clone
cd /opt
git clone <你的仓库地址> depu-jifen
cd depu-jifen

# 方式2: scp 上传
# scp -r ./depu_jifen user@your-server:/opt/depu-jifen
```

---

## 第三步：配置环境变量

```bash
cd /opt/depu-jifen

# 复制并编辑 .env
cp .env .env.production
nano .env.production
```

修改以下内容：

```ini
# 对外暴露端口 — Apache 会代理到这个端口
EXPOSE_PORT=8085

# 生产环境密钥 — 务必改成随机字符串
SECRET_KEY=<用 openssl rand -hex 32 生成>

# CORS — 填你的实际域名
CORS_ORIGINS=https://poker.example.com
```

生成随机密钥：

```bash
openssl rand -hex 32
```

---

## 第四步：启动 Docker 容器

```bash
cd /opt/depu-jifen

# 构建并启动（使用生产环境配置）
docker compose --env-file .env.production up -d --build

# 检查是否启动成功
docker compose logs -f --tail=20

# 验证容器在运行
curl http://127.0.0.1:8085/api/users
# 应该返回 JSON 响应（405 或其他，说明服务在跑）
```

---

## 第五步：配置 Apache2 反向代理

### 5.1 启用所需模块

```bash
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite headers ssl
sudo systemctl restart apache2
```

### 5.2 创建站点配置

```bash
# 复制配置文件
sudo cp deploy/apache-vhost.conf /etc/apache2/sites-available/depu-jifen.conf

# 编辑，替换域名
sudo nano /etc/apache2/sites-available/depu-jifen.conf
```

把所有 `poker.example.com` 替换为你的实际域名。如果 Docker 端口不是 8085，也要替换 `127.0.0.1:8085`。

### 5.3 启用站点

```bash
# 启用站点配置
sudo a2ensite depu-jifen

# 测试配置语法
sudo apache2ctl configtest

# 重载 Apache
sudo systemctl reload apache2
```

---

## 第六步：申请 HTTPS 证书 (Let's Encrypt)

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-apache -y

# 申请证书（自动修改 Apache 配置）
sudo certbot --apache -d poker.example.com

# 测试自动续期
sudo certbot renew --dry-run
```

certbot 会自动：
- 填充 `SSLCertificateFile` 和 `SSLCertificateKeyFile` 路径
- 配置 HTTP → HTTPS 重定向
- 设置自动续期 cron job

---

## 第七步：验证部署

```bash
# 1. 检查 HTTPS 是否正常
curl -I https://poker.example.com
# 应返回 200

# 2. 检查 WebSocket
# 在浏览器中打开 https://poker.example.com，F12 Network 标签
# 过滤 WS，应看到 wss://poker.example.com/ws/... 连接

# 3. 检查 Docker 日志
docker compose logs -f
```

浏览器打开 `https://poker.example.com`，应该能看到欢迎页面。

---

## 日常运维

```bash
cd /opt/depu-jifen

# 查看日志
docker compose logs -f --tail=50

# 重启服务
docker compose restart

# 更新代码后重新部署
git pull
docker compose --env-file .env.production up -d --build

# 备份数据库
cp data/poker.db data/poker.db.bak.$(date +%Y%m%d)

# 查看 Apache 错误日志
tail -f /var/log/apache2/depu-jifen-error.log
```

---

## 故障排查

| 问题 | 检查方法 |
|------|---------|
| 502 Bad Gateway | `curl http://127.0.0.1:8085` — Docker 容器是否在运行？ |
| WebSocket 连不上 | `a2enmod proxy_wstunnel` 然后 `systemctl restart apache2` |
| HTTPS 证书过期 | `sudo certbot renew` |
| 页面白屏 | `docker compose logs` 看后端是否报错 |
| 数据库锁定 | `ls -la data/` 检查 .db-wal 和 .db-shm 文件权限 |

---

## 防火墙

如果启用了 ufw：

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# 不需要开放 8085 — 它只监听 127.0.0.1
```
