async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    try {
        let { username, password } = await request.json(); 
        username = username.trim(); // 去除前後多餘空格
        const hashedPassword = await hashPassword(password);
        
        // --- 🚨 終極防彈匹配邏輯：專治各種前端舊快取與輸入格式 ---
        
        // 1. 如果舊版前端偷偷加了 "_同學"，強制把它砍掉，還原成純數字
        if (username.endsWith('_同學')) {
            username = username.replace('_同學', ''); 
        }

        // 2. 智能補全：判斷輸入的是不是純數字 (例如 "1" 或是 "27")
        if (!isNaN(username) && username.length > 0) {
            const formattedNum = username.padStart(2, '0'); // 自動補齊兩位數，1 變成 01
            // 去數據庫裡找 01_ 開頭的名字
            const studentEntry = await env.DB.prepare("SELECT username FROM users WHERE username LIKE ? AND role = 'student'")
                .bind(formattedNum + '_%').first();
            if (studentEntry) username = studentEntry.username; // 成功匹配，賦值為 "01_陳凱晴"
        } 
        // 3. 智能補全：如果輸入的是純中文名字 (例如 "羅珏俊")
        else if (!username.includes('_') && isNaN(username)) {
            // 去數據庫裡找以 _羅珏俊 結尾的名字
            const studentEntry = await env.DB.prepare("SELECT username FROM users WHERE username LIKE ? AND role = 'student'")
                .bind('%_' + username).first();
            if (studentEntry) username = studentEntry.username;
        }

        // --- 正常核對帳密 (此時 username 已經被完美修正) ---
        const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND password = ?")
            .bind(username, hashedPassword).first();

        if (!user) return Response.json({ success: false, message: "帳號或密碼錯誤" }, { status: 401 });

        // --- 檢查封號與時區 ---
        if (user.banned_until) {
            if (user.banned_until === "permanent") {
                return Response.json({ success: false, message: "🚫 帳號已被永久停用" }, { status: 403 });
            }
            const expire = new Date(user.banned_until);
            if (expire > new Date()) {
                const timeStr = expire.toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
                return Response.json({ success: false, message: `⏳ 停用中，解封時間：\n${timeStr}` }, { status: 403 });
            }
        }

        // --- 記錄登入時間 ---
        const now = new Date().toISOString();
        try { await env.DB.prepare("UPDATE users SET last_login = ? WHERE username = ?").bind(now, username).run(); } catch(e){}

        return Response.json({ success: true, user: user.username, role: user.role });
        
    } catch (error) {
        return Response.json({ success: false, message: "伺服器內部報錯: " + error.message }, { status: 500 });
    }
}
