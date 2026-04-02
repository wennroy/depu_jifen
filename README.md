# 德扑记分 - Texas Hold'em Chip Tracker

朋友局线下德扑筹码管理工具。无需实体筹码，手机扫码即可加入，实时同步所有人的筹码变化。

## 功能特性

- **房间系统** — 创建房间后生成分享链接，朋友输入昵称即可加入，无需注册
- **实时同步** — 基于 WebSocket 推送，所有筹码变化实时反映到每个人的屏幕
- **下注记录** — 每位玩家自行输入下注金额，支持快捷金额和自定义输入
- **管理员结算** — 每局结束后管理员填入各玩家输赢金额（总和必须为 0），一键结算
- **玩家互转** — 玩家之间可以直接转账筹码
- **筹码调整** — 管理员可为任意玩家增减筹码（买入、补筹等场景）
- **踢人/关房** — 管理员可踢出玩家或关闭房间
- **交易记录** — 完整记录所有操作流水
- **手机优先** — 专为手机浏览器优化的触控交互和响应式布局

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.12 · FastAPI · SQLAlchemy · SQLite (WAL) |
| 前端 | React 19 · TypeScript · Vite · Ant Design Mobile · Zustand |
| 实时 | WebSocket（FastAPI 原生支持） |
| 图标 | Lucide React（SVG 矢量图标） |
| 部署 | Docker · docker-compose · Apache 反向代理 |

## 项目结构

```
depu_jifen/
├── backend/
│   ├── main.py                  # FastAPI 入口
│   ├── config.py                # 环境变量配置
│   ├── database.py              # SQLAlchemy 引擎 + Session
│   ├── models/                  # ORM 模型
│   │   ├── room.py              #   房间
│   │   ├── player.py            #   玩家
│   │   └── transaction.py       #   交易记录
│   ├── schemas/                 # Pydantic 请求/响应模型
│   │   ├── room.py
│   │   ├── player.py
│   │   └── transaction.py
│   ├── routers/                 # API 路由
│   │   ├── rooms.py             #   创建/加入/查询房间
│   │   ├── players.py           #   下注/转账
│   │   └── admin.py             #   结算/调整/踢人
│   ├── services/                # 业务逻辑
│   │   ├── room_service.py      #   房间创建与加入
│   │   ├── chip_service.py      #   筹码操作（原子事务）
│   │   └── ws_manager.py        #   WebSocket 连接管理
│   └── ws/
│       └── handler.py           # WebSocket 端点
├── frontend/
│   ├── src/
│   │   ├── pages/               # 页面
│   │   │   ├── HomePage.tsx     #   首页（创建/加入房间）
│   │   │   └── RoomPage.tsx     #   游戏房间主界面
│   │   ├── components/
│   │   │   ├── home/            #   首页表单组件
│   │   │   ├── room/            #   玩家列表/下注/转账/记录
│   │   │   └── admin/           #   管理员工具栏/结算/调整
│   │   ├── stores/
│   │   │   └── gameStore.ts     #   Zustand 全局状态管理
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts  #   WebSocket 连接 + 自动重连
│   │   ├── api/
│   │   │   └── http.ts          #   Axios 实例
│   │   └── styles/
│   │       └── global.css       #   设计系统变量 + 全局样式
│   └── vite.config.ts           # Vite 配置（含开发代理）
├── deploy/
│   └── apache-vhost.conf        # Apache 反向代理配置
├── data/                        # SQLite 数据库目录（运行时生成）
├── .env                         # 环境变量
├── Dockerfile                   # 多阶段构建（前端 + 后端）
├── docker-compose.yml           # 一键启动
└── pyproject.toml               # Python 项目配置
```

## 快速开始

### 环境要求

- Python >= 3.11
- Node.js >= 18
- Docker + Docker Compose（生产部署）

### 本地开发

**1. 安装后端依赖**

```bash
# 使用 uv（推荐）
pip install uv
uv pip install fastapi "uvicorn[standard]" sqlalchemy pydantic python-dotenv

# 或使用 pip
pip install fastapi "uvicorn[standard]" sqlalchemy pydantic python-dotenv
```

> 如遇网络问题，可添加清华镜像：`--index-url https://pypi.tuna.tsinghua.edu.cn/simple`

**2. 安装前端依赖**

```bash
cd frontend
npm install
```

**3. 启动开发服务**

打开两个终端：

```bash
# 终端 1：启动后端（端口 8000）
uvicorn backend.main:app --reload --port 8000

# 终端 2：启动前端（端口 3000，自动代理 API 和 WebSocket 到 8000）
cd frontend
npm run dev
```

浏览器打开 `http://localhost:3000` 即可使用。

### Docker 部署（生产环境）

**1. 配置环境变量**

编辑 `.env` 文件：

```env
# 对外暴露端口
EXPOSE_PORT=80

# 生产环境请务必修改此密钥
SECRET_KEY=your-random-secret-key-here

# 默认初始筹码
DEFAULT_INITIAL_CHIPS=1000
```

**2. 构建并启动**

```bash
docker-compose up -d --build
```

服务启动后访问 `http://your-server-ip` 即可使用。

**3. 查看日志**

```bash
docker-compose logs -f
```

**4. 停止服务**

```bash
docker-compose down
```

**5. 数据持久化**

SQLite 数据库文件保存在 `./data/poker.db`，已通过 Docker volume 挂载到宿主机。即使容器重建，数据也不会丢失。

### Apache 反向代理（可选）

如需通过域名访问，参考 `deploy/apache-vhost.conf` 配置 Apache。

**前置条件：**

```bash
# 启用必要的 Apache 模块
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite
```

**配置示例：**

```apache
<VirtualHost *:80>
    ServerName poker.yourdomain.com

    ProxyPreserveHost On

    # WebSocket 代理
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/ws/(.*) ws://127.0.0.1:80/ws/$1 [P,L]

    # HTTP 代理
    ProxyPass / http://127.0.0.1:80/
    ProxyPassReverse / http://127.0.0.1:80/
</VirtualHost>
```

将 `poker.yourdomain.com` 替换为你的域名，端口号与 `.env` 中的 `EXPOSE_PORT` 保持一致。

## 使用流程

### 创建房间

1. 打开首页，选择「创建房间」
2. 输入房间名称、你的昵称、初始筹码数
3. 点击「创建房间」，自动进入游戏界面

### 邀请朋友

1. 进入房间后点击右上角「分享」按钮
2. 分享链接或房间号给朋友
3. 朋友打开链接 → 输入昵称 → 加入房间

### 游戏中

| 操作 | 谁可以用 | 说明 |
|------|----------|------|
| 下注 | 所有玩家 | 输入金额或点击快捷按钮，从自己的筹码中扣除 |
| 转账 | 所有玩家 | 点击其他玩家的卡片，输入金额直接转账 |
| 下一局 | 管理员 | 推进局数计数器 |
| 结算 | 管理员 | 为每位玩家填入 +/- 金额（总和必须 = 0），一键结算 |
| 调整筹码 | 管理员 | 点击玩家卡片上的设置图标，增减筹码（买入/补筹） |
| 踢人 | 管理员 | 将玩家移出房间 |

### 核心规则

- **结算零和**：每局结算时，所有玩家的筹码变化总和必须为 0（赢家所得 = 输家所失）
- **调整不受限**：管理员可通过「调整筹码」为系统注入或移除筹码（适用于买入、补筹场景）
- **无注册**：身份通过浏览器本地存储的 token 识别。清除浏览器数据会丢失身份

## API 文档

启动后端后，访问 `http://localhost:8000/docs` 查看自动生成的 Swagger API 文档。

### 主要接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/rooms` | 创建房间 |
| `GET` | `/api/rooms/{code}` | 获取房间信息 |
| `POST` | `/api/rooms/{code}/join` | 加入房间 |
| `GET` | `/api/rooms/{code}/state` | 获取房间完整状态 |
| `POST` | `/api/rooms/{code}/bet` | 下注 |
| `POST` | `/api/rooms/{code}/transfer` | 玩家间转账 |
| `POST` | `/api/rooms/{code}/rounds/next` | 下一局（管理员） |
| `POST` | `/api/rooms/{code}/settle` | 结算（管理员） |
| `POST` | `/api/rooms/{code}/adjust` | 调整筹码（管理员） |
| `POST` | `/api/rooms/{code}/kick` | 踢人（管理员） |
| `POST` | `/api/rooms/{code}/close` | 关闭房间（管理员） |
| `WebSocket` | `/ws/{code}?token=xxx` | 实时推送 |

### 认证方式

- **玩家接口**：请求头 `X-Player-Token: {token}`
- **管理员接口**：请求头 `X-Admin-Token: {token}`
- Token 在创建/加入房间时返回，前端自动存入 `localStorage`

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `BACKEND_PORT` | `8000` | 后端服务端口 |
| `FRONTEND_PORT` | `3000` | 前端开发服务端口 |
| `EXPOSE_PORT` | `80` | Docker 对外暴露端口 |
| `DB_PATH` | `data/poker.db` | SQLite 数据库文件路径 |
| `DEFAULT_INITIAL_CHIPS` | `1000` | 默认初始筹码数 |
| `SECRET_KEY` | `change-me-...` | 安全密钥（生产环境必须修改） |

## 设计系统

UI 采用 **Modern Dark Cinema + Luxury Gold** 风格：

- **背景**：电影级深黑 `#050506`，带环境光晕（金色 + 翠绿色径向渐变）
- **卡片**：Glassmorphism — `backdrop-filter: blur(20px)` + `rgba(255,255,255,0.04)` 底色
- **强调色**：暖金 `#E2B050`，满足 WCAG 3:1 对比度
- **显示字体**：[Chakra Petch](https://fonts.google.com/specimen/Chakra+Petch) — 电竞/竞技感
- **正文字体**：[Inter](https://fonts.google.com/specimen/Inter) — 清晰易读
- **图标**：[Lucide](https://lucide.dev/) SVG 矢量图标
- **动画**：弹性曲线 `cubic-bezier(0.16, 1, 0.3, 1)`，支持 `prefers-reduced-motion`
- **交互**：按下缩放 (scale 0.97)、shimmer 光泽、glow 辉光

## 开发说明

### 前端构建

```bash
cd frontend
npm run build      # 构建到 frontend/dist/
npm run dev        # 开发模式（HMR）
npx tsc --noEmit   # 类型检查
```

### 数据库

- 使用 SQLite + WAL 模式，无需额外安装数据库服务
- 首次启动时自动建表
- 数据文件位于 `data/poker.db`

### WebSocket 设计

- 所有数据变更通过 REST API 发起（统一认证和校验逻辑）
- WebSocket 仅用于服务端向客户端推送状态更新（只读管道）
- 客户端自动重连（指数退避，最大 30 秒间隔）
- 心跳保活：客户端每 30 秒发送 `ping`

## License

MIT
