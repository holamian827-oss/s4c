// 密码加密函数 (SHA-256)
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    const { username, oldPassword, newPassword } = await request.json();
    
    // 把用户输入的旧密码和新密码都转换成乱码
    const hashedOld = await hashPassword(oldPassword);
    const hashedNew = await hashPassword(newPassword);
    
    // 用转换后的旧密码去数据库核对
    const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND password = ?")
        .bind(username, hashedOld).first();

    if (!user) return Response.json({ success: false, message: "旧密码不正确" });

    // 验证成功，把加密后的新密码存入数据库
    await env.DB.prepare("UPDATE users SET password = ? WHERE username = ?")
        .bind(hashedNew, username).run();

    return Response.json({ success: true });
}
