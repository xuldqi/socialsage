/**
 * SocialSage AI - Express Server
 * 基于 IP 的每日使用次数限制 API（自托管版本）
 * 用于 Dokploy / Docker 部署
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || '10', 10);

// 数据存储路径
const DATA_DIR = process.env.DATA_DIR || './data';
const QUOTA_FILE = path.join(DATA_DIR, 'quota.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 中间件
app.use(cors());
app.use(express.json());

// 信任代理（用于获取真实 IP）
app.set('trust proxy', true);

/**
 * 获取今天的日期字符串
 */
function getTodayKey() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * 获取客户端 IP
 */
function getClientIP(req) {
    return req.headers['cf-connecting-ip'] ||
        req.headers['x-real-ip'] ||
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.ip ||
        req.connection?.remoteAddress ||
        'unknown';
}

/**
 * 加载配额数据
 */
function loadQuotaData() {
    try {
        if (fs.existsSync(QUOTA_FILE)) {
            return JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading quota data:', e);
    }
    return {};
}

/**
 * 保存配额数据
 */
function saveQuotaData(data) {
    try {
        fs.writeFileSync(QUOTA_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error saving quota data:', e);
    }
}

/**
 * 清理过期数据（只保留今天和昨天的数据）
 */
function cleanupOldData(data) {
    const today = getTodayKey();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const cleaned = {};
    for (const key in data) {
        const date = key.split(':')[1]; // quota:DATE:IP
        if (date === today || date === yesterday) {
            cleaned[key] = data[key];
        }
    }
    return cleaned;
}

/**
 * 生成存储键
 */
function getStorageKey(ip, date) {
    return `quota:${date}:${ip}`;
}

// ============================================
// API 端点
// ============================================

/**
 * 健康检查
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'SocialSage Quota API',
        dailyLimit: DAILY_LIMIT,
        timestamp: new Date().toISOString()
    });
});

/**
 * 检查配额
 */
app.all('/check-quota', (req, res) => {
    const ip = getClientIP(req);
    const today = getTodayKey();
    const key = getStorageKey(ip, today);

    try {
        const data = loadQuotaData();
        const currentCount = data[key] || 0;
        const remaining = Math.max(0, DAILY_LIMIT - currentCount);
        const allowed = currentCount < DAILY_LIMIT;

        res.json({
            allowed,
            remaining,
            limit: DAILY_LIMIT,
            used: currentCount,
            // 不返回完整 IP，只返回部分用于调试
            ipHint: ip.includes('.')
                ? ip.substring(0, ip.lastIndexOf('.')) + '.xxx'
                : ip.substring(0, 8) + '...'
        });
    } catch (error) {
        console.error('Check quota error:', error);
        // 出错时允许使用，避免影响用户体验
        res.json({
            allowed: true,
            remaining: DAILY_LIMIT,
            limit: DAILY_LIMIT,
            error: 'Quota check failed, allowing access'
        });
    }
});

/**
 * 使用配额（增加计数）
 */
app.post('/use-quota', (req, res) => {
    const ip = getClientIP(req);
    const today = getTodayKey();
    const key = getStorageKey(ip, today);

    try {
        let data = loadQuotaData();

        // 定期清理过期数据
        data = cleanupOldData(data);

        const currentCount = data[key] || 0;

        if (currentCount >= DAILY_LIMIT) {
            return res.status(429).json({
                success: false,
                remaining: 0,
                message: 'Daily quota exceeded'
            });
        }

        const newCount = currentCount + 1;
        data[key] = newCount;
        saveQuotaData(data);

        res.json({
            success: true,
            remaining: DAILY_LIMIT - newCount,
            used: newCount
        });
    } catch (error) {
        console.error('Use quota error:', error);
        res.json({
            success: true, // 出错时仍返回成功，避免阻塞用户
            remaining: DAILY_LIMIT,
            error: 'Quota update failed'
        });
    }
});

/**
 * 404 处理
 */
app.use((req, res, next) => {
    if (req.path.startsWith('/v1beta/')) {
        return next(); // Pass to proxy handler
    }
    res.status(404).json({
        error: 'Not Found',
        endpoints: ['/check-quota', '/use-quota', '/health', '/v1beta/*']
    });
});

/**
 * Gemini API Proxy
 * Forwards requests to Google, injecting the System API Key
 */
app.all('/v1beta/*', async (req, res) => {
    const ip = getClientIP(req);
    const today = getTodayKey();
    const key = getStorageKey(ip, today);

    // 1. Check Quota
    try {
        let data = loadQuotaData();
        data = cleanupOldData(data);
        const currentCount = data[key] || 0;

        if (currentCount >= DAILY_LIMIT) {
            return res.status(429).json({
                error: {
                    code: 429,
                    message: 'QUOTA_EXCEEDED: Daily limit reached for this IP.',
                    status: 'RESOURCE_EXHAUSTED'
                }
            });
        }

        // Increment Quota (optimistic)
        data[key] = currentCount + 1;
        saveQuotaData(data);

    } catch (error) {
        console.error('Quota check failed:', error);
        // Continue despite error to prevent blocking service
    }

    // 2. Prepare Proxy Request
    const SYSTEM_API_KEY = process.env.SYSTEM_API_KEY;
    if (!SYSTEM_API_KEY) {
        return res.status(500).json({ error: { message: 'NO_SYSTEM_KEYS_CONFIGURED: Backend missing API Key.' } });
    }

    const targetUrl = `https://generativelanguage.googleapis.com${req.originalUrl}${req.originalUrl.includes('?') ? '&' : '?'}key=${SYSTEM_API_KEY}`;

    try {
        // Requires Node 18+ specific simple fetch, or standard https request
        // Using dynamic import for node-fetch if needed, or native fetch if available
        const fetch = global.fetch || require('node-fetch');

        // Remove host header to avoid confusion
        const headers = { ...req.headers };
        delete headers['host'];
        delete headers['content-length'];

        const proxyRes = await fetch(targetUrl, {
            method: req.method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body)
        });

        // Handle Stream
        if (proxyRes.headers.get('content-type')?.includes('text/event-stream')) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            if (proxyRes.body && proxyRes.body.pipe) {
                proxyRes.body.pipe(res);
            } else {
                // Node 18 fetch returns a stream
                const reader = proxyRes.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(value);
                }
                res.end();
            }
            return;
        }

        const data = await proxyRes.text();
        res.status(proxyRes.status);
        res.set('Content-Type', proxyRes.headers.get('content-type'));
        res.send(data);

    } catch (proxyError) {
        console.error('Proxy Error:', proxyError);
        res.status(500).json({ error: { message: `Proxy Error: ${proxyError.message}` } });
    }
});

// 启动服务器 - 绑定到 0.0.0.0 以接受外部连接
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SocialSage Quota API running on port ${PORT}`);
    console.log(`📊 Daily limit: ${DAILY_LIMIT} requests per IP`);
    console.log(`📁 Data directory: ${DATA_DIR}`);
});
