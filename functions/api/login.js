async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    try {
        let { username, password } = await request.json(); 
        const hashedPassword = await hashPassword(password);
        
        // 💡 智能匹配：如果輸入的是純數字 (如 27)，自動查找資料庫中對應學號的姓名
        if (!username.includes('_') && !isNaN(username) && username.length > 0) {
            const formattedNum = username.padStart(2, '0'); // 補足兩位數，如 1 變成 01
            const studentEntry = await env.DB.prepare("SELECT username FROM users WHERE username LIKE ? AND role = 'student'")
                .bind(formattedNum + '_%').first();
            if (studentEntry) {
                username = studentEntry.username; // 將 27 替換為 27_羅珏俊
            }
        }
        
        // 驗證帳密 (不檢查 role，以確保「學生改老師權限」依然能登入)
        const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND password = ?")
            .bind(username, hashedPassword).first();

        if (!user) return Response.json({ success: false, message: "帳號或密碼錯誤" }, { status: 401 });

        // 檢查封號狀態 (輸出中國時區)
        if (user.banned_until) {
            if (user.banned_until === "permanent") {
                return Response.json({ success: false, message: "🚫 你的帳號已被永久停用" }, { status: 403 });
            }
            const expire = new Date(user.banned_until);
            if (expire > new Date()) {
                const timeStr = expire.toLocaleString('zh-HK', { 
                    timeZone: 'Asia/Hong_Kong', 
                    year: 'numeric', month: '2-digit', day: '2-digit', 
                    hour: '2-digit', minute: '2-digit', hour12: false 
                });
                return Response.json({ success: false, message: `⏳ 帳號停用中，解封時間：\n${timeStr}` }, { status: 403 });
            }
        }

        // 登入成功，記錄最後登入時間
        const now = new Date().toISOString();
        try {
            await env.DB.prepare("UPDATE users SET last_login = ? WHERE username = ?")
                .bind(now, username).run();
        } catch (e) { console.error("Update last_login failed"); }

        return Response.json({ success: true, user: user.username, role: user.role });

    } catch (error) {
        return Response.json({ success: false, message: "伺服器報錯: " + error.message }, { status: 500 });
    }
}
