export async function onRequestPost({ request, env }) {
    const { username, oldPassword, newPassword } = await request.json();
    
    const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND password = ?")
        .bind(username, oldPassword).first();

    if (!user) return Response.json({ success: false, message: "旧密码不正确" });

    await env.DB.prepare("UPDATE users SET password = ? WHERE username = ?")
        .bind(newPassword, username).run();

    return Response.json({ success: true });
}
