export async function onRequestGet({ env }) {
    try {
        // 創建用戶表，加入封禁時間欄位
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                banned_until TEXT
            )
        `).run();

        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY, title TEXT, date TEXT, type TEXT, subject TEXT, remarks TEXT, url TEXT, color TEXT, completed INTEGER, createdBy TEXT
            )
        `).run();

        const teachers = ['班主任', '中文老師', '英文老師', '物理老師', '化學老師', '生物老師', '資訊科技老師', '歷史老師', '地理老師', '音樂老師', '視藝老師', '宗教老師'];
        let stmts = [];
        stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?, ?, ?, ?)").bind('admin', 'Admin1234', 'admin', ''));
        teachers.forEach(t => stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?, ?, ?, ?)").bind(t, '12345678', 'teacher', '')));
        for (let i = 1; i <= 35; i++) stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?, ?, ?, ?)").bind(`${i}_同學`, '12345678', 'student', ''));
        
        await env.DB.batch(stmts);
        return new Response("✅ 數據庫初始化成功！包含 1-35 號及封禁功能。", { status: 200 });
    } catch (e) {
        return new Response("❌ 失敗: " + e.message, { status: 500 });
    }
}
