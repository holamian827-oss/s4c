export async function onRequestGet({ env }) {
    try {
        // 1. 創建表（如果不存在）
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                role TEXT NOT NULL
            )
        `).run();

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

        // 2. 準備名單
        const teachers = [
            '班主任', '中文老師', '英文老師', '物理老師', '化學老師', 
            '生物老師', '資訊科技老師', '歷史老師', '地理老師', 
            '音樂老師', '視藝老師', '宗教老師'
        ];

        let statements = [];

        // 管理員
        statements.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?, ?, ?)").bind('admin', 'Admin1234', 'admin'));

        // 老師
        teachers.forEach(t => {
            statements.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?, ?, ?)").bind(t, '12345678', 'teacher'));
        });

        // 1~35 號同學
        for (let i = 1; i <= 35; i++) {
            statements.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?, ?, ?)").bind(`${i}_同學`, '12345678', 'student'));
        }

        // 3. 執行批量寫入
        await env.DB.batch(statements);

        return new Response("✅ 數據庫初始化成功！1-35號同學及老師已就緒。", { status: 200 });
    } catch (e) {
        return new Response("❌ 初始化失敗: " + e.message, { status: 500 });
    }
}
