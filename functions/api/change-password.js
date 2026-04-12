async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    try {
        const cookie = request.headers.get('Cookie');
        if (!cookie) return new Response("Unauthorized", { status: 401 });
        const match = cookie.match(/session_token=([^;]+)/);
        const currentUser = match ? await env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(match[1]).first() : null;
        
        if (!currentUser) return new Response("Unauthorized", { status: 401 });

        const { oldPassword, newPassword } = await request.json();
        const hashedOld = await hashPassword(oldPassword);
        const hashedNew = await hashPassword(newPassword);
        
        // 🔒 验证旧密码（全程哈希，对比真实数据库资料）
        if (hashedOld !== currentUser.password) {
            return Response.json({ success: false, message: "舊密碼不正確" });
        }

        await env.DB.prepare("UPDATE users SET password = ? WHERE username = ?").bind(hashedNew, currentUser.username).run();
        return Response.json({ success: true });
    } catch (e) {
        return Response.json({ success: false, message: e.message }, { status: 500 });
    }
}
