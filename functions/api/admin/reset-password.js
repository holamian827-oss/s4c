// 密碼加密函數
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    try {
        // 1. 零信任檢查：驗證管理員身分
        const cookie = request.headers.get('Cookie');
        if (!cookie) return new Response("Unauthorized", { status: 401 });
        
        const match = cookie.match(/session_token=([^;]+)/);
        const adminUser = match ? await env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(match[1]).first() : null;
        
        if (!adminUser || adminUser.role !== 'admin') {
            return new Response("Forbidden: 只有管理員可以重置密碼", { status: 403 });
        }

        // 2. 執行重置 (必須轉換為哈希值！)
        const { username } = await request.json();
        const defaultHash = await hashPassword('12345678'); // 💡 確保重置的也是加密亂碼
        
        await env.DB.prepare("UPDATE users SET password = ? WHERE username = ?")
            .bind(defaultHash, username).run();
            
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ success: false, message: error.message }, { status: 500 });
    }
}
