#!/bin/bash
# SocialSage AI - Cloudflare Worker 一键部署脚本
# 用法：cd backend && bash deploy.sh

set -e

echo "=========================================="
echo "🚀 SocialSage AI - Worker 部署脚本"
echo "=========================================="

# 检查 wrangler 是否安装
if ! command -v wrangler &> /dev/null; then
    echo "📦 安装 Wrangler CLI..."
    npm install -g wrangler
fi

# 检查登录状态
echo "🔐 检查 Cloudflare 登录状态..."
if ! wrangler whoami &> /dev/null; then
    echo "请先登录 Cloudflare..."
    wrangler login
fi

# 检查 KV 命名空间
echo "📝 创建 KV 命名空间..."
KV_OUTPUT=$(wrangler kv:namespace create "QUOTA_STORE" 2>&1 || true)

# 从输出中提取 ID
KV_ID=$(echo "$KV_OUTPUT" | grep -oE 'id = "[^"]+"' | sed 's/id = "//' | sed 's/"//')

if [ -n "$KV_ID" ]; then
    echo "✅ KV 命名空间已创建，ID: $KV_ID"
    
    # 更新 wrangler.toml
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/YOUR_KV_NAMESPACE_ID/$KV_ID/" wrangler.toml
    else
        sed -i "s/YOUR_KV_NAMESPACE_ID/$KV_ID/" wrangler.toml
    fi
    echo "✅ 已更新 wrangler.toml"
else
    echo "⚠️ KV 命名空间可能已存在，检查 wrangler.toml 配置..."
fi

# 部署 Worker
echo "🚀 部署 Worker..."
DEPLOY_OUTPUT=$(wrangler deploy 2>&1)
echo "$DEPLOY_OUTPUT"

# 提取 Worker URL
WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev')

if [ -n "$WORKER_URL" ]; then
    echo ""
    echo "=========================================="
    echo "✅ 部署成功！"
    echo "Worker URL: $WORKER_URL"
    echo "=========================================="
    echo ""
    echo "下一步："
    echo "1. 复制上面的 Worker URL"
    echo "2. 在 geminiService.ts 和 toolLLMService.ts 中更新 QUOTA_API_URL"
    echo "   const QUOTA_API_URL = '$WORKER_URL';"
    echo ""
else
    echo "⚠️ 部署可能已完成，请检查控制台输出获取 Worker URL"
fi
