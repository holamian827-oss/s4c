// functions/api/init.js
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet({ request, env }) {
    // ⛔ 嚴格權限檢查：缺少金鑰直接拒絕，防止駭客重置資料庫
    const url = new URL(request.url);
    if (url.searchParams.get('key') !== 'S4C_Super_Admin_2026_Lock') {
        return new Response("⛔ 拒絕訪問：安全金鑰無效", { status: 403 });
    }

    try {
        // 💡 核心升級：新增 session_token 欄位
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY, password TEXT NOT NULL, role TEXT NOT NULL,
                banned_until TEXT, last_login TEXT, session_token TEXT
            )
        `).run();

        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY, title TEXT, date TEXT, type TEXT, subject TEXT, 
                remarks TEXT, url TEXT, color TEXT, completed INTEGER, createdBy TEXT
            )
        `).run();

        try { await env.DB.prepare("ALTER TABLE users ADD COLUMN session_token TEXT").run(); } catch(e){}

        const students = ["01_陳凱晴", "02_陳凱琳", "03_陳映彤", "04_陳柏揚", "05_陳玄楓", "06_周晉賢", "07_周博熙", "08_陳佶弢", "09_鍾震峰", "10_鄧名傑", "11_高梓博", "12_許德懿", "13_胡峻源", "14_黃啟琨", "15_葉希蕾", "16_郭藹霖", "17_林子軒", "18_林浩信", "19_林依澄", "20_林嘉怡", "21_李卓喬", "22_李嘉宏", "23_李釨凝", "24_梁紫菱", "25_羅康裕", "26_呂凱豐", "27_羅珏俊", "28_唐梓航", "29_唐廉皓", "30_黃梓浩", "31_黃旖旎 ", "32_黃美琦", "33_黃思穎", "34_葉黌鵬", "35_張騰文"];

        let stmts = [];
        const adminHash = await hashPassword('Admin1234');
        const defaultHash = await hashPassword('12345678');

        stmts.push(env.DB.prepare("DELETE FROM users WHERE role = 'student'"));

        stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users (username, password, role, banned_until, last_login, session_token) VALUES (?,?,?,?,?,?)").bind('admin', adminHash, 'admin', '', null, null));
        
        const teachers = ['班主任', '中文老師', '英文老師', '物理老師', '化學老師', '生物老師', '資訊科技老師', '歷史老師', '地理老師', '音樂老師', '視藝老師', '宗教老師'];
        teachers.forEach(t => {
            stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users (username, password, role, banned_until, last_login, session_token) VALUES (?,?,?,?,?,?)").bind(t, defaultHash, 'teacher', '', null, null));
        });

        students.forEach(name => {
            stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users (username, password, role, banned_until, last_login, session_token) VALUES (?,?,?,?,?,?)").bind(name, defaultHash, 'student', '', null, null));
        });

        await env.DB.batch(stmts);
        return new Response("✅ 零信任資料庫補丁安裝成功！", { status: 200 });
    } catch (e) {
        return new Response("❌ 初始化失敗: " + e.message, { status: 500 });
    }
}
