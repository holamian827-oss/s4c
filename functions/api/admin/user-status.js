export async function onRequestPost({ request, env }) {
    try {
        // 1. 提取並驗證 Cookie 中的 session_token
        const cookie = request.headers.get('Cookie');
        if (!cookie) return new Response("Unauthorized", { status: 401 });
        
        const match = cookie.match(/session_token=([^;]+)/);
        if (!match) return new Response("Unauthorized", { status: 401 });

        // 2. 去資料庫核對這個 Token 的主人是誰，以及他的權限
        const user = await env.DB.prepare("SELECT role FROM users WHERE session_token = ?").bind(match[1]).first();
        
        // 🔒 3. 終極防禦：如果沒登入，或者登入了但不是 admin，直接踢走！
        if (!user || user.role !== 'admin') {
            return new Response("Forbidden: 權限不足，只有管理員可以修改帳號狀態", { status: 403 });
        }

        // 4. 驗證通過，執行封號/解封操作
        const { username, bannedUntil } = await request.json();
        
        await env.DB.prepare("UPDATE users SET banned_until = ? WHERE username = ?")
            .bind(bannedUntil, username).run();
            
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ success: false, message: error.message }, { status: 500 });
    }
}
