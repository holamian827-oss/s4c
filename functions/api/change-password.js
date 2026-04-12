// functions/api/change-password.js
async function hashPassword(password, salt) {
    const msgBuffer = new TextEncoder().encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, data, env }) {
    const user = data.user; // 從海關拿到當前用戶
    const { oldPassword, newPassword } = await request.json();

    const oldHash = await hashPassword(oldPassword, user.salt);
    if (oldHash !== user.password) return Response.json({ success: false, message: "舊密碼錯誤" });

    // 💡 升級：改密碼時順便換個新鹽
    const newSalt = crypto.randomUUID();
    const newHash = await hashPassword(newPassword, newSalt);

    await env.DB.prepare("UPDATE users SET password = ?, salt = ?, session_token = NULL WHERE username = ?")
        .bind(newHash, newSalt, user.username).run();
        
    return Response.json({ success: true });
}
