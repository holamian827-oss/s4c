async function getAuthUser(request, env) {
    const cookie = request.headers.get('Cookie');
    if (!cookie) return null;
    const match = cookie.match(/session_token=([^;]+)/);
    if (!match) return null;
    return await env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(match[1]).first();
}

export async function onRequestGet({ request, env }) {
    const user = await getAuthUser(request, env);
    if (!user) return new Response("Unauthorized", { status: 401 });

    const { results } = await env.DB.prepare("SELECT * FROM tasks").all();
    return Response.json(results || []);
}

export async function onRequestPost({ request, env }) {
    const user = await getAuthUser(request, env);
    if (!user) return new Response("Unauthorized", { status: 401 });

    const data = await request.json();
    const realCreator = user.username; // 🔒 强制使用真实身份，无视前端传来的 createdBy

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

    // 🔒 越权拦截：学生只能删除自己发的东西
    if (user.role === 'student' && task.createdBy !== user.username) {
        return new Response("Forbidden", { status: 403 });
    }

    await env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
    return Response.json({ success: true });
}
