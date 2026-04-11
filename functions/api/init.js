// 密碼加密函數 (SHA-256)
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet({ env }) {
    try {
        // 1. 確保表存在
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                banned_until TEXT
            )
        `).run();

        // 確保有 banned_until 欄位
        try {
            await env.DB.prepare("ALTER TABLE users ADD COLUMN banned_until TEXT").run();
        } catch (e) {}

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

        // 🧹 2. 自動大掃除：刪除舊的 NULL 廢棄數據和錯誤的簡體字老師
        await env.DB.prepare("DELETE FROM users WHERE banned_until IS NULL").run();
        await env.DB.prepare("DELETE FROM users WHERE username LIKE '%老师'").run();

        // 3. 準備初始數據
        let stmts = [];
        
        // 提前生成默認密碼的密文
        const adminHash = await hashPassword('Admin1234');
        const defaultHash = await hashPassword('12345678');

        // 管理員
        stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?,?,?,?)").bind('admin', adminHash, 'admin', ''));
        
        // 💡 嚴格對應你前端的繁體中文選單
        const teachers = ['班主任', '中文老師', '英文老師', '物理老師', '化學老師', '生物老師', '資訊科技老師', '歷史老師', '地理老師', '音樂老師', '視藝老師', '宗教老師'];
        teachers.forEach(t => {
            stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?,?,?,?)").bind(t, defaultHash, 'teacher', ''));
        });

        // 1-35 號同學 (使用繁體 _同學)
        for (let i = 1; i <= 35; i++) {
            stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?,?,?,?)").bind(`${i}_同學`, defaultHash, 'student', ''));
        }

        await env.DB.batch(stmts);
        return new Response("✅ 數據庫已完美修復！舊的冗餘數據已清理，所有帳號已轉換為加密狀態。", { status: 200 });
    } catch (e) {
        return new Response("❌ 初始化失敗: " + e.message, { status: 500 });
    }
}
