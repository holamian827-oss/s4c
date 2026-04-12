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
        
        // 1. 強制砍掉舊快取偷偷加的 "_同學"
        if (username.endsWith('_同學')) {
            username = username.replace('_同學', ''); 
        }

        // 2. 💡 智能補全 (修復：移除 role = 'student' 限制，允許同學升級為老師後依然能自動補全)
        if (!username.includes('_')) {
            let entry = null;
            if (!isNaN(username) && username.length > 0) {
                // 輸入純數字 (如 27)
                entry = await env.DB.prepare("SELECT username FROM users WHERE username LIKE ?")
                    .bind(username.padStart(2, '0') + '_%').first();
            } else {
                // 輸入純中文 (如 羅珏俊)
                entry = await env.DB.prepare("SELECT username FROM users WHERE username LIKE ?")
                    .bind('%_' + username).first();
            }
            if (entry) username = entry.username; // 成功匹配
        }
        
        // 3. 正常核對帳密
        const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND password = ?")
            .bind(username, hashedPassword).first();

        if (!user) return Response.json({ success: false, message: "帳號或密碼錯誤" }, { status: 401 });

        // 4. 檢查封號狀態
        if (user.banned_until) {
            if (user.banned_until === "permanent") return Response.json({ success: false, message: "🚫 帳號已被永久停用" }, { status: 403 });
            const expire = new Date(user.banned_until);
            if (expire > new Date()) {
                const timeStr = expire.toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
                return Response.json({ success: false, message: `⏳ 停用中，解封時間：\n${timeStr}` }, { status: 403 });
            }
        }

        // 5. 🛡️ 零信任核心：生成 Token 並設置 HttpOnly Cookie
        const token = crypto.randomUUID();
        const now = new Date().toISOString();
        
        await env.DB.prepare("UPDATE users SET last_login = ?, session_token = ? WHERE username = ?")
            .bind(now, token, username).run();

        const headers = new Headers();
        headers.append("Set-Cookie", `session_token=${token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=86400`);
        headers.append("Content-Type", "application/json");

        return new Response(JSON.stringify({ success: true, user: user.username, role: user.role }), { headers });

    } catch (error) {
        return Response.json({ success: false, message: "伺服器內部報錯: " + error.message }, { status: 500 });
    }
}
