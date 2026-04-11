export async function onRequestPost({ request, env }) {
    // 从前端接收请求数据（前端依然会传 role 过来，但我们在验证时不使用它）
    const { username, password } = await request.json();
    
    // 💡 修复点 1：SQL 查询中去掉了 "AND role = ?"，现在只验证账号和密码是否匹配
    const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND password = ?")
        .bind(username, password).first();

    // 如果找不到匹配的账号密码，返回错误
    if (!user) return Response.json({ success: false, message: "帐号或密码错误" }, { status: 401 });

    // 检查封号状态 (保持你原来的逻辑不变)
    if (user.banned_until) {
        if (user.banned_until === "permanent") {
            return Response.json({ success: false, message: "🚫 你的帳號已被永久封禁" }, { status: 403 });
        }
        const expire = new Date(user.banned_until);
        if (expire > new Date()) {
            return Response.json({ success: false, message: `⏳ 帳號封禁中，解封時間：${expire.toLocaleString()}` }, { status: 403 });
        }
    }

    // 💡 修复点 2：登入成功后，把数据库里真实的 user.role 返回给前端
    return Response.json({ success: true, user: user.username, role: user.role });
}
