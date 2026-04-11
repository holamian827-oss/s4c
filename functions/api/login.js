export async function onRequestPost({ request, env }) {
    const { username, password, role } = await request.json();
    
    // 验证账号密码
    const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND password = ? AND role = ?")
        .bind(username, password, role).first();

    if (!user) return Response.json({ success: false, message: "帐号或密码错误" }, { status: 401 });

    // 检查封号状态
    if (user.banned_until) {
        if (user.banned_until === "permanent") {
            return Response.json({ success: false, message: "🚫 你的帳號已被永久封禁" }, { status: 403 });
        }
        const expire = new Date(user.banned_until);
        if (expire > new Date()) {
            return Response.json({ success: false, message: `⏳ 帳號封禁中，解封時間：${expire.toLocaleString()}` }, { status: 403 });
        }
    }

    // 💡 登入成功！将现在的标准时间写进用户的 last_login 栏位
    const now = new Date().toISOString();
    await env.DB.prepare("UPDATE users SET last_login = ? WHERE username = ?")
        .bind(now, username).run();

    return Response.json({ success: true, user: username, role: role });
}
