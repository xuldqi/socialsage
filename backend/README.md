# SocialSage AI 后端 - Cloudflare Worker

基于 IP 的每日使用次数限制服务（每 IP 每天 10 次）。

## 🚀 一键部署（推荐）

```bash
cd backend
chmod +x deploy.sh
./deploy.sh
```

脚本会自动：
1. 安装 Wrangler CLI（如果未安装）
2. 引导你登录 Cloudflare
3. 创建 KV 命名空间
4. 部署 Worker
5. 输出 Worker URL

## 📋 手动部署

### 1. 准备工作
- 注册 [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费）
- 安装 Node.js（>=16）

### 2. 安装并登录
```bash
npm install -g wrangler
wrangler login
```

### 3. 创建 KV 存储
```bash
cd backend
wrangler kv:namespace create "QUOTA_STORE"
# 复制输出的 id 到 wrangler.toml 替换 YOUR_KV_NAMESPACE_ID
```

### 4. 部署
```bash
wrangler deploy
```

### 5. 更新前端配置
将 Worker URL 配置到以下文件的 `QUOTA_API_URL`：
- `services/geminiService.ts`
- `services/toolLLMService.ts`

```typescript
const QUOTA_API_URL = 'https://socialsage-quota-api.your-subdomain.workers.dev';
```

## API 端点

### POST /check-quota
检查当前 IP 的剩余配额。

**响应:**
```json
{
  "allowed": true,
  "remaining": 8,
  "limit": 10,
  "ip": "xxx.xxx.xxx.xxx"
}
```

### POST /use-quota
消耗一次配额。

**响应:**
```json
{
  "success": true,
  "remaining": 7
}
```
