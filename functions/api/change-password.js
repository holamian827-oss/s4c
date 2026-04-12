// functions/api/change-password.js
async function hashPassword(password) { /* ... 保持原樣 ... */ }

export async function onRequestPost({ request, env }) {
    const cookie = request.headers.get('Cookie');
    if (!cookie) return new Response("Unauthorized", { status: 401 });
    const match = cookie.match(/session_token=([^;]+)/);
    const currentUser = match ? await env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(match[1]).first() : null;
    
    if (!currentUser) return new Response("Unauthorized", { status: 401 });

    const { oldPassword, newPassword } = await request.json();
    const hashedOld = await hashPassword(oldPassword);
    const hashedNew = await hashPassword(newPassword);
    
    // 💡 絕對安全：無視前端傳的 username，強制只修改當前 Token 對應使用者的密碼！
    if (hashedOld !== currentUser.password) {
        return Response.json({ success: false, message: "舊密碼不正確" });
    }

    await env.DB.prepare("UPDATE users SET password = ? WHERE username = ?").bind(hashedNew, currentUser.username).run();
    return Response.json({ success: true });
}
