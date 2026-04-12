// functions/api/login.js
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    try {
        let { username, password } = await request.json(); 
        username = username.trim();
        const hashedPassword = await hashPassword(password);
        
        if (!username.includes('_')) {
            let entry = null;
            if (!isNaN(username) && username.length > 0) {
                entry = await env.DB.prepare("SELECT username FROM users WHERE username LIKE ? AND role = 'student'").bind(username.padStart(2, '0') + '_%').first();
            } else {
                entry = await env.DB.prepare("SELECT username FROM users WHERE username LIKE ? AND role = 'student'").bind('%_' + username).first();
            }
            if (entry) username = entry.username;
        }
        
        const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND password = ?").bind(username, hashedPassword).first();
        if (!user) return Response.json({ success: false, message: "帳號或密碼錯誤" }, { status: 401 });

        if (user.banned_until) {
            if (user.banned_until === "permanent") return Response.json({ success: false, message: "🚫 帳號永久停用" }, { status: 403 });
            if (new Date(user.banned_until) > new Date()) return Response.json({ success: false, message: `⏳ 停用中` }, { status: 403 });
        }

        // 💡 零信任核心：生成隨機 Token，存入資料庫
        const token = crypto.randomUUID();
        const now = new Date().toISOString();
        await env.DB.prepare("UPDATE users SET last_login = ?, session_token = ? WHERE username = ?").bind(now, token, username).run();

        // 💡 設置 HttpOnly Cookie (防止 XSS 攻擊，前端無法篡改)
        const headers = new Headers();
        headers.append("Set-Cookie", `session_token=${token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=86400`);
        headers.append("Content-Type", "application/json");

        return new Response(JSON.stringify({ success: true, user: user.username, role: user.role }), { headers });
    } catch (error) {
        return Response.json({ success: false, message: error.message }, { status: 500 });
    }
}
