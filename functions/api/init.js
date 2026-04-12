async function hashPassword(password, salt) {
    const msgBuffer = new TextEncoder().encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    if (url.searchParams.get('key') !== 'S4C_Super_Admin_2026_Lock') {
        return new Response("⛔ 拒絕訪問", { status: 403 });
    }

    try {
        await env.DB.prepare("DROP TABLE IF EXISTS users").run();
        
        await env.DB.prepare(`
            CREATE TABLE users (
                username TEXT PRIMARY KEY, password TEXT NOT NULL, salt TEXT NOT NULL, 
                role TEXT NOT NULL, banned_until TEXT, last_login TEXT, 
                session_token TEXT, token_created_at TEXT
            )
        `).run(); // 💡 新增了 token_created_at 欄位
        
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY, title TEXT, date TEXT, type TEXT, subject TEXT, 
                remarks TEXT, url TEXT, color TEXT, completed INTEGER, createdBy TEXT
            )
        `).run();

        const students = ["01_陳凱晴", "02_陳凱琳", "03_陳映彤", "04_陳柏揚", "05_陳玄楓", "06_周晉賢", "07_周博熙", "08_陳佶弢", "09_鍾震峰", "10_鄧名傑", "11_高梓博", "12_許德懿", "13_胡峻源", "14_黃啟琨", "15_黃旖旎", "16_郭藹霖", "17_林子軒", "18_林浩信", "19_林依澄", "20_林嘉怡", "21_李卓喬", "22_李嘉宏", "23_李釨凝", "24_梁紫菱", "25_羅康裕", "26_呂凱豐", "27_羅珏俊", "28_唐梓航", "29_唐廉皓", "30_黃梓浩", "31_葉希蕾", "32_黃美琦", "33_黃思穎", "34_葉黌鵬", "35_張騰文"];
        let stmts = [];

        const adminSalt = crypto.randomUUID();
        const adminHash = await hashPassword('Admin1234', adminSalt);
        stmts.push(env.DB.prepare("INSERT INTO users (username, password, salt, role) VALUES (?,?,?,?)").bind('admin', adminHash, adminSalt, 'admin'));

        const teachers = ['班主任', '中文老師', '英文老師', '物理老師', '化學老師', '生物老師', '資訊科技老師'];
        for (const t of teachers) {
            const salt = crypto.randomUUID();
            const hash = await hashPassword('12345678', salt);
            stmts.push(env.DB.prepare("INSERT INTO users (username, password, salt, role) VALUES (?,?,?,?)").bind(t, hash, salt, 'teacher'));
        }

        for (const s of students) {
            const salt = crypto.randomUUID();
            const hash = await hashPassword('12345678', salt);
            stmts.push(env.DB.prepare("INSERT INTO users (username, password, salt, role) VALUES (?,?,?,?)").bind(s, hash, salt, 'student'));
        }

        await env.DB.batch(stmts);
        return new Response("✅ 安全資料庫 2.0 升級完成！", { status: 200 });
    } catch (e) { return new Response(e.message, { status: 500 }); }
}
