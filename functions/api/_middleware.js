// functions/api/_middleware.js
export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);

    // 1. 白名單：登入和初始化不檢查 Token
    if (url.pathname === '/api/login' || url.pathname === '/api/init') {
        return next();
    }

    // 2. 攔截 Cookie
    const cookie = request.headers.get('Cookie');
    if (!cookie) return new Response("Unauthorized", { status: 401 });

    const match = cookie.match(/session_token=([^;]+)/);
    if (!match) return new Response("Unauthorized", { status: 401 });

    // 3. 查驗 Token 與狀態
    const user = await env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(match[1]).first();
    if (!user) return new Response("Session Expired", { status: 401 });

    if (user.banned_until && (user.banned_until === 'permanent' || new Date(user.banned_until) > new Date())) {
        return new Response("Account Banned", { status: 403 });
    }

    // 4. 🛡️ 權限硬隔離：非 admin 禁入 /admin/ 資料夾
    if (url.pathname.startsWith('/api/admin/') && user.role !== 'admin') {
        return new Response("Forbidden: Admin Only", { status: 403 });
    }

    // 5. 注入身分供後續使用
    context.data.user = user;

    // 6. 安全標頭加固
    const response = await next();
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    return response;
}
