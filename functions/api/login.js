async function hashPassword(password, salt) {
    const msgBuffer = new TextEncoder().encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    try {
        let { username, password } = await request.json(); 
        username = username.trim();
        
        if (username.endsWith('_同學')) {
            username = username.replace('_同學', ''); 
        }

        // 💡 完整找回智能匹配邏輯
        if (!username.includes('_')) {
            let entry = null;
            if (!isNaN(username) && username.length > 0) {
                entry = await env.DB.prepare("SELECT username FROM users WHERE username LIKE ?").bind(username.padStart(2, '0') + '_%').first();
            } else {
                entry = await env.DB.prepare("SELECT username FROM users WHERE username LIKE ?").bind('%_' + username).first();
            }
            if (entry) username = entry.username;
        }

        // 取出該用戶專屬的鹽
        const user = await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
        if (!user) return Response.json({ success: false, message: "帳號或密碼錯誤" }, { status: 401 });

        // 加鹽比對
        const inputHash = await hashPassword(password, user.salt);
        if (inputHash !== user.password) {
            return Response.json({ success: false, message: "帳號或密碼錯誤" }, { status: 401 });
        }

        const token = crypto.randomUUID();
        await env.DB.prepare("UPDATE users SET last_login = ?, session_token = ? WHERE username = ?")
            .bind(new Date().toISOString(), token, username).run();

        const headers = new Headers();
        headers.append("Set-Cookie", `session_token=${token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=86400`);
        headers.append("Content-Type", "application/json");

        return new Response(JSON.stringify({ success: true, user: user.username, role: user.role }), { headers });

    } catch (error) {
        return Response.json({ success: false, message: "伺服器內部報錯: " + error.message }, { status: 500 });
    }
}
