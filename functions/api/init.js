async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet({ env }) {
    try {
        // 1. 確保表結構存在
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                banned_until TEXT,
                last_login TEXT
            )
        `).run();

        // 💡 雙重保險：手動檢查並補上缺失的欄位
        try { await env.DB.prepare("ALTER TABLE users ADD COLUMN banned_until TEXT").run(); } catch (e) {}
        try { await env.DB.prepare("ALTER TABLE users ADD COLUMN last_login TEXT").run(); } catch (e) {}

        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY, title TEXT, date TEXT, type TEXT, subject TEXT, 
                remarks TEXT, url TEXT, color TEXT, completed INTEGER, createdBy TEXT
            )
        `).run();

        let stmts = [];
        const adminHash = await hashPassword('Admin1234');
        const defaultHash = await hashPassword('12345678');

        // 🚨 修正：這裡必須給足 5 個值，最後一個是 last_login (初始設為 null)
        stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users (username, password, role, banned_until, last_login) VALUES (?,?,?,?,?)").bind('admin', adminHash, 'admin', '', null));
        
        const teachers = ['班主任', '中文老師', '英文老師', '物理老師', '化學老師', '生物老師', '資訊科技老師', '歷史老師', '地理老師', '音樂老師', '視藝老師', '宗教老師'];
        teachers.forEach(t => {
            stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users (username, password, role, banned_until, last_login) VALUES (?,?,?,?,?)").bind(t, defaultHash, 'teacher', '', null));
        });

        for (let i = 1; i <= 35; i++) {
            stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users (username, password, role, banned_until, last_login) VALUES (?,?,?,?,?)").bind(`${i}_同學`, defaultHash, 'student', '', null));
        }

        await env.DB.batch(stmts);
        return new Response("✅ 數據庫結構與預設數據已完美同步！", { status: 200 });
    } catch (e) {
        return new Response("❌ 初始化失敗: " + e.message, { status: 500 });
    }
}
