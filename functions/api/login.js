// 密碼加密函數 (SHA-256)
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    const { username, password } = await request.json(); 
    
    // 1. 將使用者輸入的密碼進行哈希加密
    const hashedPassword = await hashPassword(password);
    
    // 2. 不驗證前端傳來的 role，以資料庫真實身分為準 (解決學生掛老師權限的問題)
    const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND password = ?")
        .bind(username, hashedPassword).first();

    if (!user) return Response.json({ success: false, message: "帳號或密碼錯誤" }, { status: 401 });

    // 3. 檢查封號狀態
    if (user.banned_until) {
        if (user.banned_until === "permanent") {
            return Response.json({ success: false, message: "🚫 您的帳號已被永久停用，請聯繫系統管理員。" }, { status: 403 });
        }
        const expire = new Date(user.banned_until);
        if (expire > new Date()) {
            // 💡 強制轉換為中國/澳門時區 (UTC+8)
            const timeStr = expire.toLocaleString('zh-HK', { 
                timeZone: 'Asia/Macau', 
                year: 'numeric', month: '2-digit', day: '2-digit', 
                hour: '2-digit', minute: '2-digit', hour12: false 
            });
            return Response.json({ success: false, message: `⏳ 預計解除時間：\n${timeStr}` }, { status: 403 });
        }
    }

    // 4. 登入成功，記錄當下登入時間
    const now = new Date().toISOString();
    await env.DB.prepare("UPDATE users SET last_login = ? WHERE username = ?")
        .bind(now, username).run();

    return Response.json({ success: true, user: user.username, role: user.role });
}
