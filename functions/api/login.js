// 密碼加密函數 (SHA-256)
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    const { username, password } = await request.json(); 
    
    // 1. 哈希加密驗證
    const hashedPassword = await hashPassword(password);
    const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND password = ?")
        .bind(username, hashedPassword).first();

    if (!user) return Response.json({ success: false, message: "帳號或密碼錯誤" }, { status: 401 });

    // 2. 檢查封號狀態
    if (user.banned_until) {
        if (user.banned_until === "permanent") {
            return Response.json({ success: false, message: "🚫 你的帳號已被永久停用" }, { status: 403 });
        }
        const expire = new Date(user.banned_until);
        if (expire > new Date()) {
            // 💡 關鍵修復：強制轉換為中國/澳門時區 (UTC+8) 格式輸出
            const timeStr = expire.toLocaleString('zh-HK', { 
                timeZone: 'Asia/Macau', // 強制使用澳門時區
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false // 使用 24 小時制
            });
            return Response.json({ success: false, message: `⏳ 帳號停用中，解封時間：\n${timeStr}` }, { status: 403 });
        }
    }

    // 3. 登入成功，記錄當下時間
    const now = new Date().toISOString();
    await env.DB.prepare("UPDATE users SET last_login = ? WHERE username = ?")
        .bind(now, username).run();

    return Response.json({ success: true, user: user.username, role: user.role });
}
