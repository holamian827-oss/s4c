// 密碼加密函數 (SHA-256)
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    try {
        const { username, password } = await request.json(); 
        
        // 1. 將輸入的密碼轉為哈希
        const hashedPassword = await hashPassword(password);
        
        // 2. 驗證帳密
        const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND password = ?")
            .bind(username, hashedPassword).first();

        if (!user) return Response.json({ success: false, message: "帳號或密碼錯誤" }, { status: 401 });

        // 3. 檢查封號狀態與時區
        if (user.banned_until) {
            if (user.banned_until === "permanent") {
                return Response.json({ success: false, message: "🚫 您的帳號已被永久停用，請聯繫系統管理員。" }, { status: 403 });
            }
            const expire = new Date(user.banned_until);
            if (expire > new Date()) {
                // 使用 Asia/Hong_Kong 確保 V8 引擎絕對兼容澳門時間
                const timeStr = expire.toLocaleString('zh-HK', { 
                    timeZone: 'Asia/Hong_Kong', 
                    year: 'numeric', month: '2-digit', day: '2-digit', 
                    hour: '2-digit', minute: '2-digit', hour12: false 
                });
                return Response.json({ success: false, message: `⏳ 預計解除時間：\n${timeStr}` }, { status: 403 });
            }
        }

        // 4. 登入成功，記錄時間 (加了防護，萬一沒 init 也不會當機)
        const now = new Date().toISOString();
        try {
            await env.DB.prepare("UPDATE users SET last_login = ? WHERE username = ?")
                .bind(now, username).run();
        } catch (dbErr) {
            console.log("⚠️ 忘記執行 init.js，缺少 last_login 欄位，但不影響登入");
        }

        return Response.json({ success: true, user: user.username, role: user.role });

    } catch (error) {
        // 💡 終極防爆盾：一旦代碼崩潰，直接把真正的報錯原因拋給前端！
        return Response.json({ success: false, message: "伺服器內部報錯: " + error.message }, { status: 500 });
    }
}
