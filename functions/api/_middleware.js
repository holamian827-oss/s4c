export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);

    if (url.pathname === '/api/login' || url.pathname === '/api/init' || url.pathname === '/api/logout') {
        return next();
    }

    const cookie = request.headers.get('Cookie');
    if (!cookie) return new Response("Unauthorized", { status: 401 });

    const match = cookie.match(/session_token=([^;]+)/);
    if (!match) return new Response("Unauthorized", { status: 401 });

    const token = match[1];
    const user = await env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(token).first();
    
    if (!user || !user.token_created_at) return new Response("Session Expired", { status: 401 });

    // 💡 伺服器端 Token 過期判定 (設定為 24 小時)
    const tokenCreatedTime = new Date(user.token_created_at).getTime();
    const currentTime = new Date().getTime();
    const sessionDuration = 24 * 60 * 60 * 1000; // 24小時的毫秒數

    if (currentTime - tokenCreatedTime > sessionDuration) {
        // 🔒 自動清理：如果發現 Token 已過期，主動將資料庫中的 session_token 抹除
        await env.DB.prepare("UPDATE users SET session_token = NULL, token_created_at = NULL WHERE session_token = ?")
            .bind(token).run();
        return new Response("Session Expired (Server-side)", { status: 401 });
    }

    if (user.banned_until && (user.banned_until === 'permanent' || new Date(user.banned_until) > new Date())) {
        return new Response("Account Banned", { status: 403 });
    }

    if (url.pathname.startsWith('/api/admin/') && user.role !== 'admin') {
        return new Response("Forbidden", { status: 403 });
    }

    context.data.user = user;

    const response = await next();
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    return response;
}
