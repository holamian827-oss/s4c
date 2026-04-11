// 密碼加密函數 (SHA-256)
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    try {
        const { username } = await request.json();
        
        if (!username) {
            return Response.json({ success: false, message: "缺少使用者名稱" }, { status: 400 });
        }

        // 1. 先將預設密碼 "12345678" 進行哈希計算加密！
        const defaultHashedPassword = await hashPassword('12345678');

        // 2. 將加密後的亂碼存入數據庫，覆蓋舊密碼
        await env.DB.prepare("UPDATE users SET password = ? WHERE username = ?")
            .bind(defaultHashedPassword, username).run();

        return Response.json({ success: true, message: `密碼已重設為預設值` });
    } catch (err) {
        return Response.json({ success: false, message: err.message }, { status: 500 });
    }
}
