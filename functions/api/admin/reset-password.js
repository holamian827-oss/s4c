async function hashPassword(password, salt) {
    const msgBuffer = new TextEncoder().encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    try {
        const cookie = request.headers.get('Cookie');
        if (!cookie) return new Response("Unauthorized", { status: 401 });

        const match = cookie.match(/session_token=([^;]+)/);
        if (!match) return new Response("Unauthorized", { status: 401 });

        const currentUser = await env.DB.prepare("SELECT role FROM users WHERE session_token = ?").bind(match[1]).first();
        if (!currentUser || currentUser.role !== 'admin') {
            return new Response("Forbidden", { status: 403 });
        }

        const { username } = await request.json();
        if (!username) {
            return Response.json({ success: false, message: "缺少使用者名稱" }, { status: 400 });
        }
        
        // 💡 關鍵修復：重置密碼時，必須生成全新的鹽，並強制清除對方的 Token 讓其下線
        const newSalt = crypto.randomUUID();
        const newDefaultHash = await hashPassword('12345678', newSalt); 

        await env.DB.prepare("UPDATE users SET password = ?, salt = ?, session_token = NULL WHERE username = ?")
            .bind(newDefaultHash, newSalt, username).run();
            
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ success: false, message: error.message }, { status: 500 });
    }
}
