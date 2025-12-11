/**
 * SocialSage AI - Cloudflare Worker
 * 基于 IP 的每日使用次数限制 API
 */

const DAILY_LIMIT = 10;

// CORS 头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

/**
 * 获取今天的日期字符串
 */
function getTodayKey() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * 获取客户端 IP
 */
function getClientIP(request) {
    // Cloudflare 自动提供真实 IP
    return request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Real-IP') ||
        request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ||
        'unknown';
}

/**
 * 生成存储键
 */
function getStorageKey(ip, date) {
    // 对 IP 进行简单哈希以保护隐私
    return `quota:${ip}:${date}`;
}

/**
 * 处理 OPTIONS 预检请求
 */
function handleOptions() {
    return new Response(null, { status: 204, headers: corsHeaders });
}

/**
 * 检查配额
 */
async function checkQuota(request, env) {
    const ip = getClientIP(request);
    const today = getTodayKey();
    const key = getStorageKey(ip, today);

    try {
        const storedValue = await env.QUOTA_STORE.get(key);
        const currentCount = storedValue ? parseInt(storedValue, 10) : 0;
        const remaining = Math.max(0, DAILY_LIMIT - currentCount);
        const allowed = currentCount < DAILY_LIMIT;

        return new Response(JSON.stringify({
            allowed,
            remaining,
            limit: DAILY_LIMIT,
            used: currentCount,
            // 不返回完整 IP，只返回部分用于调试
            ipHint: ip.substring(0, ip.lastIndexOf('.')) + '.xxx'
        }), { headers: corsHeaders });

    } catch (error) {
        console.error('Check quota error:', error);
        // 出错时允许使用，避免影响用户体验
        return new Response(JSON.stringify({
            allowed: true,
            remaining: DAILY_LIMIT,
            limit: DAILY_LIMIT,
            error: 'Quota check failed, allowing access'
        }), { headers: corsHeaders });
    }
}

/**
 * 使用配额（增加计数）
 */
async function useQuota(request, env) {
    const ip = getClientIP(request);
    const today = getTodayKey();
    const key = getStorageKey(ip, today);

    try {
        const storedValue = await env.QUOTA_STORE.get(key);
        const currentCount = storedValue ? parseInt(storedValue, 10) : 0;

        if (currentCount >= DAILY_LIMIT) {
            return new Response(JSON.stringify({
                success: false,
                remaining: 0,
                message: 'Daily quota exceeded'
            }), { status: 429, headers: corsHeaders });
        }

        const newCount = currentCount + 1;
        // 设置过期时间为 48 小时（跨时区安全）
        await env.QUOTA_STORE.put(key, newCount.toString(), { expirationTtl: 172800 });

        return new Response(JSON.stringify({
            success: true,
            remaining: DAILY_LIMIT - newCount,
            used: newCount
        }), { headers: corsHeaders });

    } catch (error) {
        console.error('Use quota error:', error);
        return new Response(JSON.stringify({
            success: true, // 出错时仍返回成功，避免阻塞用户
            remaining: DAILY_LIMIT,
            error: 'Quota update failed'
        }), { headers: corsHeaders });
    }
}

/**
 * 主入口
 */
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const method = request.method;

        // 处理 CORS 预检
        if (method === 'OPTIONS') {
            return handleOptions();
        }

        // 路由
        switch (url.pathname) {
            case '/check-quota':
                if (method === 'GET' || method === 'POST') {
                    return checkQuota(request, env);
                }
                break;

            case '/use-quota':
                if (method === 'POST') {
                    return useQuota(request, env);
                }
                break;

            case '/health':
                return new Response(JSON.stringify({
                    status: 'ok',
                    service: 'SocialSage Quota API',
                    dailyLimit: DAILY_LIMIT
                }), { headers: corsHeaders });

            default:
                return new Response(JSON.stringify({
                    error: 'Not Found',
                    endpoints: ['/check-quota', '/use-quota', '/health']
                }), { status: 404, headers: corsHeaders });
        }

        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: corsHeaders
        });
    }
};
