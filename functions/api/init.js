// 密碼加密函數 (SHA-256)
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet({ env }) {
    try {
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                banned_until TEXT
            )
        `).run();

        try { await env.DB.prepare("ALTER TABLE users ADD COLUMN banned_until TEXT").run(); } catch (e) {}
        try { await env.DB.prepare("ALTER TABLE users ADD COLUMN last_login TEXT").run(); } catch (e) {}

        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT,
                date TEXT,
                type TEXT,
                subject TEXT,
                remarks TEXT,
                url TEXT,
                color TEXT,
                completed INTEGER,
                createdBy TEXT
            )
        `).run();

        let stmts = [];
        // 提前將預設密碼轉換為哈希值
        const adminHash = await hashPassword('Admin1234');
        const defaultHash = await hashPassword('12345678');

        // 🚨 修復點：VALUES 裡面改成 5 個問號，並補上最後一個參數 null (last_login)
        stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?,?,?,?,?)").bind('admin', adminHash, 'admin', '', null));
        
        const teachers = ['班主任', '中文老師', '英文老師', '物理老師', '化學老師', '生物老師', '資訊科技老師', '歷史老師', '地理老師', '音樂老師', '視藝老師', '宗教老師'];
        teachers.forEach(t => {
            stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?,?,?,?,?)").bind(t, defaultHash, 'teacher', '', null));
        });

        for (let i = 1; i <= 35; i++) {
            stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?,?,?,?,?)").bind(`${i}_同學`, defaultHash, 'student', '', null));
        }

        await env.DB.batch(stmts);
        return new Response("✅ 數據庫補丁已安裝，所有密碼已轉換為哈希值！", { status: 200 });
    } catch (e) {
        return new Response("❌ 初始化失敗: " + e.message, { status: 500 });
    }
}
