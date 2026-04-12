async function hashPassword(password, salt) {
    const msgBuffer = new TextEncoder().encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    try {
        const { username } = await request.json();
        
        // 💡 關鍵修復：重置密碼時，必須生成全新的鹽，並強制清除對方的 Token 讓其下線
        const newSalt = crypto.randomUUID();
        const newDefaultHash = await hashPassword('12345678', newSalt); 

        await env.DB.prepare("UPDATE users SET password = ?, salt = ?, session_token = NULL WHERE username = ?")
            .bind(newDefaultHash, newSalt, username).run();
            
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ success: false, message: error.message }, { status: 500 });
    }
}
