export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);

    // 💡 關鍵修復：把 /api/logout 加進白名單，確保過期用戶也能順利清空 Cookie
    if (url.pathname === '/api/login' || url.pathname === '/api/init' || url.pathname === '/api/logout') {
        return next();
    }

    const cookie = request.headers.get('Cookie');
    if (!cookie) return new Response("Unauthorized: 缺少憑證", { status: 401 });

    const match = cookie.match(/session_token=([^;]+)/);
    if (!match) return new Response("Unauthorized: 憑證無效", { status: 401 });

    const user = await env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(match[1]).first();
    if (!user) return new Response("Session Expired: 登入已過期", { status: 401 });

    if (user.banned_until && (user.banned_until === 'permanent' || new Date(user.banned_until) > new Date())) {
        return new Response("Account Banned: 帳號停用中", { status: 403 });
    }

    if (url.pathname.startsWith('/api/admin/') && user.role !== 'admin') {
        return new Response("Forbidden: 僅限管理員", { status: 403 });
    }

    context.data.user = user;

    const response = await next();
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    return response;
}
