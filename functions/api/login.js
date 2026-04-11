// 密码加密函数 (SHA-256)
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    const { username, password } = await request.json();
    
    // 将用户登录时输入的密码转成乱码
    const hashedPassword = await hashPassword(password);
    
    // 拿加密后的密码去数据库比对
    const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND password = ?")
        .bind(username, hashedPassword).first();

    if (!user) return Response.json({ success: false, message: "帐号或密码错误" }, { status: 401 });

    if (user.banned_until) {
        if (user.banned_until === "permanent") {
            return Response.json({ success: false, message: "🚫 你的帐号已被永久封禁" }, { status: 403 });
        }
        const expire = new Date(user.banned_until);
        if (expire > new Date()) {
            return Response.json({ success: false, message: `⏳ 帐号封禁中，解封时间：${expire.toLocaleString()}` }, { status: 403 });
        }
    }

    return Response.json({ success: true, user: user.username, role: user.role });
}
