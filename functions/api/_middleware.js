export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);

    // 1. 白名单放行
    if (url.pathname === '/api/login' || url.pathname === '/api/init' || url.pathname === '/api/logout') {
        return next();
    }

    try {
        // 2. 拦截 Cookie
        const cookie = request.headers.get('Cookie');
        if (!cookie) return new Response("Unauthorized: 缺少凭证", { status: 401 });

        const match = cookie.match(/session_token=([^;]+)/);
        if (!match) return new Response("Unauthorized: 凭证无效", { status: 401 });

        const token = match[1];
        
        // 🛡️ 加入 try...catch 防爆盾，防止数据库查询意外崩溃泄露底层信息
        const user = await env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(token).first();
        
        if (!user || !user.token_created_at) return new Response("Session Expired: 登录已过期", { status: 401 });

        const tokenCreatedTime = new Date(user.token_created_at).getTime();
        const currentTime = new Date().getTime();
        const sessionDuration = 24 * 60 * 60 * 1000; 
        const tokenAge = currentTime - tokenCreatedTime;

        // 3. 绝对过期拦截
        if (tokenAge > sessionDuration) {
            await env.DB.prepare("UPDATE users SET session_token = NULL, token_created_at = NULL WHERE session_token = ?")
                .bind(token).run();
            return new Response("Session Expired: 凭证已过期并清理", { status: 401 });
        }

        // 4. 封号拦截
        if (user.banned_until && (user.banned_until === 'permanent' || new Date(user.banned_until) > new Date())) {
            return new Response("Account Banned: 账号已被停用", { status: 403 });
        }

        // 💡 5. 关键修复：去掉末尾斜杠，彻底封死路径绕过漏洞
        if (url.pathname.startsWith('/api/admin') && user.role !== 'admin') {
            return new Response("Forbidden: 越权警告！仅限管理员操作", { status: 403 });
        }

        // 6. 智能续期核心
        let shouldRenew = false;
        if (tokenAge > 60 * 60 * 1000) { 
            await env.DB.prepare("UPDATE users SET token_created_at = ? WHERE session_token = ?")
                .bind(new Date().toISOString(), token).run();
            shouldRenew = true;
        }

        context.data.user = user;

        // 🛡️ 捕获下游 API 的报错，防止子模块崩溃影响全局
        const response = await next();
        
        // 添加安全标头
        response.headers.set('X-Content-Type-Options', 'nosniff');
        response.headers.set('X-Frame-Options', 'DENY');

        if (shouldRenew) {
            response.headers.append('Set-Cookie', `session_token=${token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=86400`);
        }

        return response;

    } catch (error) {
        // 终极异常拦截：如果发生任何未知的代码或数据库错误，统一返回 500，绝不给黑客任何信息
        console.error("Middleware Error:", error.message);
        return new Response("Internal Server Error: 核心安全模块拦截到异常", { status: 500 });
    }
}
