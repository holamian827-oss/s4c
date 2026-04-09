export async function onRequestGet({ env }) {
    try {
        // 1. 创建用户表 (增加 banned_until 字段)
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                banned_until TEXT
            )
        `).run();

        // 2. 创建任务表 (确保有 url 和 remarks)
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

        // 3. 准备初始数据
        let stmts = [];
        // 管理员
        stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?,?,?,?)").bind('admin', 'Admin1234', 'admin', ''));
        
        // 老师们
        const teachers = ['班主任', '中文老師', '英文老師', '物理老師', '化學老師', '資訊科技老師'];
        teachers.forEach(t => {
            stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?,?,?,?)").bind(t, '12345678', 'teacher', ''));
        });

        // 1-35 号同学
        for (let i = 1; i <= 35; i++) {
            stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?,?,?,?)").bind(`${i}_同學`, '12345678', 'student', ''));
        }

        await env.DB.batch(stmts);
        return new Response("✅ 数据库地基已铺好！1-35号和老师已就位。", { status: 200 });
    } catch (e) {
        return new Response("❌ 初始化失败: " + e.message, { status: 500 });
    }
}
