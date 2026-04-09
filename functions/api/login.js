export async function onRequestPost({ request, env }) {
    const { username, password, role } = await request.json();
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

    return Response.json({ success: true, user: username, role: role });
}
