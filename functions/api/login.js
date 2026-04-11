// 密碼加密函數 (SHA-256)
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    // 💡 這裡前端雖然傳了 role，但我們不再用它來做驗證，以防跨權限登入失敗
    const { username, password } = await request.json(); 
    
    // 1. 將使用者輸入的明文密碼，轉換為安全的哈希亂碼
    const hashedPassword = await hashPassword(password);
    
    // 2. 拿轉換後的密碼去數據庫核對 (注意：這裡已經移除了 AND role = ?)
    const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND password = ?")
        .bind(username, hashedPassword).first();

    if (!user) return Response.json({ success: false, message: "帳號或密碼錯誤" }, { status: 401 });

    // 3. 檢查封號狀態
    if (user.banned_until) {
        if (user.banned_until === "permanent") {
            return Response.json({ success: false, message: "🚫 你的帳號已被永久停用" }, { status: 403 });
        }
        const expire = new Date(user.banned_until);
        if (expire > new Date()) {
            return Response.json({ success: false, message: `⏳ 帳號停用中，解封時間：${expire.toLocaleString()}` }, { status: 403 });
        }
    }

    // 4. 登入成功，將數據庫裡真實的 user.role 派發給前端 (這樣你的開掛帳號才能生效！)
    return Response.json({ success: true, user: user.username, role: user.role });
}
