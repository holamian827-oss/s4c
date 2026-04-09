export async function onRequestGet({ env }) {
    try {
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY, password TEXT NOT NULL, role TEXT NOT NULL, banned_until TEXT
            )
        `).run();
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY, title TEXT, date TEXT, type TEXT, subject TEXT, remarks TEXT, url TEXT, color TEXT, completed INTEGER, createdBy TEXT
            )
        `).run();
        
        let stmts = [];
        stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?,?,?,?)").bind('admin', 'Admin1234', 'admin', ''));
        for (let i = 1; i <= 35; i++) stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?,?,?,?)").bind(`${i}_同學`, '12345678', 'student', ''));
        
        await env.DB.batch(stmts);
        return new Response("✅ 數據庫初始化成功！包含 1-35 號及連結功能。", { status: 200 });
    } catch (e) {
        return new Response("❌ 失敗: " + e.message, { status: 500 });
    }
}
