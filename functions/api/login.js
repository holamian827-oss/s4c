async function hashPassword(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
    );
    const hashBuffer = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
        keyMaterial, 256
    );
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    try {
        let { username, password } = await request.json(); 
        username = username.trim();
        if (username.endsWith('_同學')) username = username.replace('_同學', '');

        if (!username.includes('_')) {
            let entry = null;
            if (!isNaN(username) && username.length > 0) {
                entry = await env.DB.prepare("SELECT username FROM users WHERE username LIKE ?").bind(username.padStart(2, '0') + '_%').first();
            } else {
                entry = await env.DB.prepare("SELECT username FROM users WHERE username LIKE ?").bind('%_' + username).first();
            }
            if (entry) username = entry.username;
        }

        const user = await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
        if (!user) return Response.json({ success: false, message: "帳號或密碼錯誤" }, { status: 401 });

        const inputHash = await hashPassword(password, user.salt);
        if (inputHash !== user.password) return Response.json({ success: false, message: "帳號或密碼錯誤" }, { status: 401 });

        if (user.banned_until) {
            if (user.banned_until === "permanent") {
                return Response.json({ success: false, message: "🚫 你的帳號已被永久停用" }, { status: 403 });
            }
            const expire = new Date(user.banned_until);
            if (expire > new Date()) {
                const timeStr = expire.toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });
                return Response.json({ success: false, message: `⏳ 停用中，解封時間：\n${timeStr}` }, { status: 403 });
            }
        }

        const token = crypto.randomUUID();
        const now = new Date().toISOString();
        
        await env.DB.prepare("UPDATE users SET last_login = ?, session_token = ?, token_created_at = ? WHERE username = ?")
            .bind(now, token, now, username).run();

        const headers = new Headers();
        headers.append("Set-Cookie", `session_token=${token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=86400`);
        headers.append("Content-Type", "application/json");

        return new Response(JSON.stringify({ success: true, user: user.username, role: user.role }), { headers });

    } catch (error) {
        return Response.json({ success: false, message: error.message }, { status: 500 });
    }
}
