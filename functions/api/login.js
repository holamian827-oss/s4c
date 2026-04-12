// functions/api/login.js
async function hashPassword(password, salt) {
    const msgBuffer = new TextEncoder().encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    let { username, password } = await request.json(); 
    username = username.trim();
    if (username.endsWith('_同學')) username = username.replace('_同學', '');

    // 智能匹配 (省略重複邏輯，但匹配完必須拿到正確的 username)
    // ... (這裡保留你原本的智能學號匹配代碼) ...
    // [假設已匹配到 username]

    // 💡 加鹽核心：先取出該用戶的鹽
    const user = await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
    if (!user) return Response.json({ success: false, message: "帳號不正確" }, { status: 401 });

    // 用拿到的鹽對輸入的密碼進行哈希
    const inputHash = await hashPassword(password, user.salt);
    if (inputHash !== user.password) {
        return Response.json({ success: false, message: "密碼錯誤" }, { status: 401 });
    }

    const token = crypto.randomUUID();
    await env.DB.prepare("UPDATE users SET last_login = ?, session_token = ? WHERE username = ?")
        .bind(new Date().toISOString(), token, username).run();

    const headers = new Headers();
    headers.append("Set-Cookie", `session_token=${token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=86400`);
    headers.append("Content-Type", "application/json");

    return new Response(JSON.stringify({ success: true, user: user.username, role: user.role }), { headers });
}
