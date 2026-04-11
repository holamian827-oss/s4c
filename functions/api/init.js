async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet({ env }) {
    try {
        // 1. 建立用戶表 (確保有 5 個欄位)
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                banned_until TEXT,
                last_login TEXT
            )
        `).run();

        // 2. 建立任務表
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY, title TEXT, date TEXT, type TEXT, subject TEXT, 
                remarks TEXT, url TEXT, color TEXT, completed INTEGER, createdBy TEXT
            )
        `).run();

        // 3. 準備數據
        const students = [
            "01_陳凱晴", "02_陳凱琳", "03_陳映彤", "04_陳柏揚", "05_陳玄楓",
            "06_周晉賢", "07_周博熙", "08_陳佶弢", "09_鍾震峰", "10_鄧名傑",
            "11_高梓博", "12_許德懿", "13_胡峻源", "14_黃啟琨", "15_黃旖旎",
            "16_郭藹霖", "17_林子軒", "18_林浩信", "19_林依澄", "20_林嘉怡",
            "21_李卓喬", "22_李嘉宏", "23_李釨凝", "24_梁紫菱", "25_羅康裕",
            "26_呂凱豐", "27_羅珏俊", "28_唐梓航", "29_唐廉皓", "30_黃梓浩",
            "31_葉希蕾", "32_黃美琦", "33_黃思穎", "34_葉黌鵬", "35_張騰文"
        ];

        let stmts = [];
        const adminHash = await hashPassword('Admin1234');
        const defaultHash = await hashPassword('12345678');

        // 💡 關鍵：先清空所有舊的學生帳號，避免舊的 "XX_同學" 殘留
        stmts.push(env.DB.prepare("DELETE FROM users WHERE role = 'student'"));

        // 插入管理員
        stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users (username, password, role, banned_until, last_login) VALUES (?,?,?,?,?)").bind('admin', adminHash, 'admin', '', null));
        
        // 插入老師
        const teachers = ['班主任', '中文老師', '英文老師', '物理老師', '化學老師', '生物老師', '資訊科技老師', '歷史老師', '地理老師', '音樂老師', '視藝老師', '宗教老師'];
        teachers.forEach(t => {
            stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users (username, password, role, banned_until, last_login) VALUES (?,?,?,?,?)").bind(t, defaultHash, 'teacher', '', null));
        });

        // 插入真實姓名學生名單
        students.forEach(name => {
            stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users (username, password, role, banned_until, last_login) VALUES (?,?,?,?,?)").bind(name, defaultHash, 'student', '', null));
        });

        await env.DB.batch(stmts);
        return new Response("✅ 數據庫名單已成功更新為真實姓名！", { status: 200 });
    } catch (e) {
        return new Response("❌ 初始化失敗: " + e.message, { status: 500 });
    }
}
