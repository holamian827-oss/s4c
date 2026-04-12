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

    const tokenCreatedTime = new Date(user.token_created_at).getTime();
    const currentTime = new Date().getTime();
    const sessionDuration = 24 * 60 * 60 * 1000; // 24小時的毫秒數
    const tokenAge = currentTime - tokenCreatedTime;

    // 1. 絕對過期攔截
    if (tokenAge > sessionDuration) {
        await env.DB.prepare("UPDATE users SET session_token = NULL, token_created_at = NULL WHERE session_token = ?")
            .bind(token).run();
        return new Response("Session Expired (Server-side)", { status: 401 });
    }

    // 2. 封號攔截
    if (user.banned_until && (user.banned_until === 'permanent' || new Date(user.banned_until) > new Date())) {
        return new Response("Account Banned", { status: 403 });
    }

    // 3. 越權攔截
    if (url.pathname.startsWith('/api/admin/') && user.role !== 'admin') {
        return new Response("Forbidden", { status: 403 });
    }

    // 💡 4. 智能續期核心：如果 Token 已經用了超過 1 小時，幫他刷新壽命
    let shouldRenew = false;
    if (tokenAge > 60 * 60 * 1000) { 
        await env.DB.prepare("UPDATE users SET token_created_at = ? WHERE session_token = ?")
            .bind(new Date().toISOString(), token).run();
        shouldRenew = true;
    }

    context.data.user = user;

    const response = await next();
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');

    // 💡 5. 如果觸發了續期，同時把前端瀏覽器的 Cookie 也續命 24 小時
    if (shouldRenew) {
        response.headers.append('Set-Cookie', `session_token=${token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=86400`);
    }

    return response;
}
