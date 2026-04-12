export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);

    // 1. 白名單放行：登入和初始化介面不需要檢查 Token
    if (url.pathname === '/api/login' || url.pathname === '/api/init') {
        return next();
    }

    // 2. 攔截並驗證 Cookie
    const cookie = request.headers.get('Cookie');
    if (!cookie) return new Response("Unauthorized: 缺少安全憑證", { status: 401 });

    const match = cookie.match(/session_token=([^;]+)/);
    if (!match) return new Response("Unauthorized: 憑證無效", { status: 401 });

    // 3. 核實身分
    const user = await env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(match[1]).first();
    if (!user) return new Response("Unauthorized: 登入已失效，請重新登入", { status: 401 });

    // 4. 🛡️ 全局權限隔離 (RBAC 核心)
    // 任何嘗試訪問 /api/admin/ 的請求，只要不是 admin，直接在海關擊斃！
    if (url.pathname.startsWith('/api/admin/') && user.role !== 'admin') {
        return new Response("Forbidden: 越權警告！非管理員禁止訪問", { status: 403 });
    }

    // 5. 將驗證通過的用戶資訊「掛載」到快遞包裹上，送進後面的 API
    context.data.user = user;

    // 6. 加上現代 Web 安全標頭 (防 XSS、防 Clickjacking)
    const response = await next();
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    return response;
}
