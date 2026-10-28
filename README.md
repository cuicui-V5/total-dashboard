# TotalDashboard 🚀

一款设计极其精美、优雅、轻量且数据丰富的多源基础设施监控看板（Fleet & Infrastructure Dashboard）。

采用 **现代浅色优雅设计风格（Clean & Elegant Light Aesthetic）**，完美聚合自建内网设备、公网云服务器、Uptime 监控链路及海外 VPS 流量配额。

![Dashboard Preview](https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80)

---

## ✨ 核心特性

- **🖥️ 6 台设备全维度指标监控 (Glances v4 REST API)**
  - 内网设备：PC (工作站), PVE Ubuntu (家庭虚拟化服务器)
  - 海外云主机：甲骨文云 1, 甲骨文云 2
  - 高性能 VPS：搬瓦工 DC9 CN2GIA, 搬瓦工 传家宝
  - 核心指标：实时 CPU % / 核心数 / 频率 / 系统负载 (1m/5m/15m)、物理内存 / 缓存 / Swap、磁盘分区挂载占用、网卡实时收发速率 (KB/s, MB/s) 与累计流量、活跃进程 Top 榜、Docker 容器健康状态。
- **🌐 全链路与服务健康监控 (Uptime Kuma Prometheus Metrics)**
  - 实时采集各节点 Ping 响应延迟 (ms)、公网网站 (百度/联通DNS) HTTP 可用性、本地路由器 (ERX) 状态。
  - SSL 证书剩余有效天数预警（如自动提示证书到期倒计时）。
- **🚀 搬瓦工 (KiwiVM) VPS 流量周期监控**
  - 直连 KiwiVM 官方 API (`getLiveServiceInfo`)。
  - 精准监控当前计费周期的流量消耗进度、剩余可用流量 (GB)。
  - 下次流量重置日期与倒计时（天数）。
- **🎨 极致优雅的浅色界面 (Light Modern Aesthetic)**
  - 柔和极简的背景搭配微质感半透明磨砂玻璃卡片（Backdrop Blur）。
  - 精准的色彩指示阶梯（翡翠绿 UP/正常，天蓝，琥珀橙 Warning，绯红 Critical/DOWN）。
  - 支持节点搜索、分类筛选（全部、局域网 LAN、云端 Cloud、VPS）、自动轮询刷新（5s / 10s / 30s）与手动即时刷新。
  - 节点详情抽屉弹窗：一键查看各分区挂载明细、网卡流量明细、Top 8 活跃进程与 Docker 容器清单。

---

## 🛠️ 技术栈

- **Frontend**: React 18, Vite 6, Tailwind CSS 3, Lucide Icons
- **Backend**: Node.js, Express, Axios, Prometheus Metrics Parser
- **Deployment**: Docker, Docker Compose, Alpine Linux

---

## 🚀 快速启动

### 1. 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

填入各节点的连接信息与 API 凭据：

```ini
PORT=3344
NODE_ENV=production

# Glances 统一鉴权
GLANCES_USERNAME=your_username
GLANCES_PASSWORD=your_password

# 监控设备列表: ID|显示名称|地址|分类标签
GLANCES_NODES=pc|PC|http://192.168.2.133:61208|LAN,pve-ubuntu|PVE Ubuntu|http://192.168.2.250:61208|LAN,oracle1|甲骨文 1|http://oracle1.cuijunyu.win:61208|Cloud,oracle2|甲骨文 2|http://oracle2.cuijunyu.win:61208|Cloud,bwh|搬瓦工 DC9|http://bwh.cuijunyu.win:61208|VPS,chuanjiabao|搬瓦工 传家宝|http://chuanjiabao.cuijunyu.win:61208|VPS

# Uptime Kuma 基础配置
UPTIME_KUMA_URL=http://192.168.2.250:3001
UPTIME_KUMA_API_KEY=uk1_your_api_key_here

# 搬瓦工 KiwiVM 配置: ID|显示名称|VEID|API_KEY
BWH_INSTANCES=bwh1|搬瓦工 DC9 CN2GIA|1323594|private_xxx,bwh2|搬瓦工 传家宝|1946349|private_yyy
```

> ⚠️ **安全警告**：`.env` 文件已被 `.gitignore` 排除，**切勿将真实凭据推送到公开代码仓库**。

### 2. 本地开发运行

```bash
# 安装依赖
npm install

# 编译前端
npm run build

# 启动服务
npm start
```

访问 `http://localhost:3344` 即可查看。

### 3. Docker 容器化一键部署

```bash
docker compose up -d --build
```

---

## 📊 数据源类型与映射分析

| 数据源 | 接口路径 | 鉴权方式 | 采集指标 |
| :--- | :--- | :--- | :--- |
| **Glances** | `/api/4/all` | HTTP Basic Auth | CPU负载、内存占用、Swap、磁盘分区、网卡速率、容器与进程 |
| **Uptime Kuma** | `/metrics` | HTTP Basic Auth (API Key) | 链路状态 (UP/DOWN)、Ping延迟 (ms)、SSL证书天数 |
| **KiwiVM** | `/v1/getLiveServiceInfo` | Query Token (VEID + Key) | 每月流量配额、已用流量、重置日期倒计时、硬盘配额、主机负载 |

---

## 📄 License

MIT License
