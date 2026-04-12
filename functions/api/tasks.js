// 驗證 Token 並獲取使用者完整資訊 (包含 role)
async function getAuthUser(request, env) {
    const cookie = request.headers.get('Cookie');
    if (!cookie) return null;
    const match = cookie.match(/session_token=([^;]+)/);
    if (!match) return null;
    return await env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(match[1]).first();
}

// [讀取] 所有人 (只要有登入) 都可以看功課
export async function onRequestGet({ request, env }) {
    const user = await getAuthUser(request, env);
    if (!user) return new Response("Unauthorized: 請先登入", { status: 401 }); 

    const { results } = await env.DB.prepare("SELECT * FROM tasks").all();
    return Response.json(results || []);
}

// [發佈/修改] 只有老師和管理員可以操作
export async function onRequestPost({ request, env }) {
    const user = await getAuthUser(request, env);
    if (!user) return new Response("Unauthorized: 請先登入", { status: 401 });

    // 🚨 終極攔截：如果你是學生，直接賞你一個 403 拒絕訪問，連資料庫的邊都碰不到！
    if (user.role === 'student') {
        return new Response("Forbidden: 權限不足，學生無法發佈或修改項目！", { status: 403 });
    }

    const data = await request.json();
    
    // 強制綁定發佈者為「當前真實登入的用戶」
    const realCreator = user.username; 

    await env.DB.prepare("INSERT OR REPLACE INTO tasks (id, title, date, type, subject, remarks, url, color, completed, createdBy) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .bind(data.id, data.title, data.date, data.type, data.subject, data.remarks, data.url, data.color, data.completed, realCreator).run();
    
    return Response.json({ success: true });
}

// [刪除] 只有老師和管理員可以刪除
export async function onRequestDelete({ request, env }) {
    const user = await getAuthUser(request, env);
    if (!user) return new Response("Unauthorized: 請先登入", { status: 401 });

    // 🚨 終極攔截：學生絕對不能刪除任何東西！
    if (user.role === 'student') {
        return new Response("Forbidden: 權限不足，學生無法刪除項目！", { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const task = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
    if (!task) return Response.json({ success: false, message: "找不到該項目" });

    // 權限核對：如果不是管理員，老師只能刪除自己發佈的功課 (防止老師互刪)
    if (user.role !== 'admin' && task.createdBy !== user.username) {
        return new Response("Forbidden: 你只能刪除自己發佈的項目", { status: 403 });
    }

    await env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
    return Response.json({ success: true });
}
