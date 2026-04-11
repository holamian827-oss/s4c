async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    try {
        let { username, password } = await request.json(); 
        const hashedPassword = await hashPassword(password); // 💡 關鍵：對輸入進行加密
        
        // 智能匹配學號
        if (!username.includes('_') && !isNaN(username) && username.length > 0) {
            const formattedNum = username.padStart(2, '0');
            const entry = await env.DB.prepare("SELECT username FROM users WHERE username LIKE ? AND role = 'student'")
                .bind(formattedNum + '_%').first();
            if (entry) username = entry.username;
        }
        
        const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND password = ?")
            .bind(username, hashedPassword).first();

        if (!user) return Response.json({ success: false, message: "帳號或密碼錯誤" }, { status: 401 });

        // 檢查封號
        if (user.banned_until) {
            if (user.banned_until === "permanent") return Response.json({ success: false, message: "🚫 帳號永久停用" }, { status: 403 });
            const expire = new Date(user.banned_until);
            if (expire > new Date()) {
                const timeStr = expire.toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', hour12: false });
                return Response.json({ success: false, message: `⏳ 停用中，解封時間：\n${timeStr}` }, { status: 403 });
            }
        }

        const now = new Date().toISOString();
        await env.DB.prepare("UPDATE users SET last_login = ? WHERE username = ?").bind(now, username).run();

        return Response.json({ success: true, user: user.username, role: user.role });
    } catch (e) {
        return Response.json({ success: false, message: e.message }, { status: 500 });
    }
}
