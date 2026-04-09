export async function onRequestGet({ env }) {
    try {
        // 創建用戶表
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                banned_until TEXT
            )
        `).run();

        // 關鍵：創建任務表，包含 url 和 remarks 欄位
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

        // 初始化管理員
        await env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?,?,?,?)")
            .bind('admin', 'Admin1234', 'admin', '')
            .run();

        return new Response("✅ 數據庫表結構已更新！包含連結與備注功能。", { status: 200 });
    } catch (e) {
        return new Response("❌ 失敗: " + e.message, { status: 500 });
    }
}
