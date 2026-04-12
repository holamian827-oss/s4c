// functions/api/tasks.js
async function getAuthUser(request, env) {
    const cookie = request.headers.get('Cookie');
    if (!cookie) return null;
    const match = cookie.match(/session_token=([^;]+)/);
    if (!match) return null;
    return await env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(match[1]).first();
}

export async function onRequestGet({ request, env }) {
    const user = await getAuthUser(request, env);
    if (!user) return new Response("Unauthorized", { status: 401 }); // 沒登入不給看！

    const { results } = await env.DB.prepare("SELECT * FROM tasks").all();
    return Response.json(results || []);
}

export async function onRequestPost({ request, env }) {
    const user = await getAuthUser(request, env);
    if (!user) return new Response("Unauthorized", { status: 401 }); // 沒登入不准發佈！

    const data = await request.json();
    
    // 💡 絕對安全：強制綁定發佈者為「當前真實登入的用戶」，無視前端傳來的數據
    const realCreator = user.username; 

    await env.DB.prepare("INSERT OR REPLACE INTO tasks (id, title, date, type, subject, remarks, url, color, completed, createdBy) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .bind(data.id, data.title, data.date, data.type, data.subject, data.remarks, data.url, data.color, data.completed, realCreator).run();
    
    return Response.json({ success: true });
}

export async function onRequestDelete({ request, env }) {
    const user = await getAuthUser(request, env);
    if (!user) return new Response("Unauthorized", { status: 401 });

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const task = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
    if (!task) return Response.json({ success: false });

    // 💡 權限核對：只有管理員、老師，或者發佈者本人可以刪除！
    if (user.role === 'student' && task.createdBy !== user.username) {
        return new Response("Forbidden: 你不能刪除別人的功課", { status: 403 });
    }

    await env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
    return Response.json({ success: true });
}
