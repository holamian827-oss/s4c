export async function onRequestPost({ request, env }) {
    try {
        // 1. 零信任檢查：驗證管理員身分
        const cookie = request.headers.get('Cookie');
        if (!cookie) return new Response("Unauthorized", { status: 401 });
        
        const match = cookie.match(/session_token=([^;]+)/);
        const adminUser = match ? await env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(match[1]).first() : null;
        
        if (!adminUser || adminUser.role !== 'admin') {
            return new Response("Forbidden: 只有管理員可以修改帳號狀態", { status: 403 });
        }

        // 2. 執行狀態更新 (封號 / 解封)
        const { username, bannedUntil } = await request.json();
        
        await env.DB.prepare("UPDATE users SET banned_until = ? WHERE username = ?")
            .bind(bannedUntil, username).run();
            
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ success: false, message: error.message }, { status: 500 });
    }
}
