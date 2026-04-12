async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    try {
        const { username, oldPassword, newPassword } = await request.json();
        
        // 🔒 雙重哈希加密，絕不讓明文接觸資料庫
        const hashedOld = await hashPassword(oldPassword);
        const hashedNew = await hashPassword(newPassword);
        
        const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND password = ?")
            .bind(username, hashedOld).first();

        if (!user) return Response.json({ success: false, message: "舊密碼不正確" });

        await env.DB.prepare("UPDATE users SET password = ? WHERE username = ?")
            .bind(hashedNew, username).run();

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ success: false, message: "系統錯誤" }, { status: 500 });
    }
}
