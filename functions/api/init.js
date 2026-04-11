// 密码加密函数 (SHA-256)
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet({ env }) {
    try {
        // 1. 尝试建表 (针对全新部署)
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                banned_until TEXT
            )
        `).run();

        // 💡 修复核心：如果表里只有 3 列，强制新增 banned_until 列！
        try {
            await env.DB.prepare("ALTER TABLE users ADD COLUMN banned_until TEXT").run();
        } catch (e) {
            // 如果报错，说明这列已经存在了，直接忽略即可，不影响运行
        }

        // 2. 创建任务表
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
        
        // 提前生成默认密码的密文
        const adminHash = await hashPassword('Admin1234');
        const defaultHash = await hashPassword('12345678');

        // 管理员
        stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?,?,?,?)").bind('admin', adminHash, 'admin', ''));
        
        // 老师们
        const teachers = ['班主任', '中文老师', '英文老师', '物理老师', '化学老师', '生物老师', '资讯科技老师', '历史老师', '地理老师', '音乐老师', '视艺老师', '宗教老师'];
        teachers.forEach(t => {
            stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?,?,?,?)").bind(t, defaultHash, 'teacher', ''));
        });

        // 1-35 号同学
        for (let i = 1; i <= 35; i++) {
            stmts.push(env.DB.prepare("INSERT OR REPLACE INTO users VALUES (?,?,?,?)").bind(`${i}_同學`, defaultHash, 'student', ''));
        }

        await env.DB.batch(stmts);
        return new Response("✅ 数据库修复完毕！新增了字段，所有密码已成功加密并初始化。", { status: 200 });
    } catch (e) {
        return new Response("❌ 初始化失败: " + e.message, { status: 500 });
    }
}
