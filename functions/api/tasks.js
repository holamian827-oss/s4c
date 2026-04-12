// functions/api/tasks.js
export async function onRequestGet({ data, env }) {
    // 海關已驗證登入
    const { results } = await env.DB.prepare("SELECT * FROM tasks").all();
    return Response.json(results || []);
}

export async function onRequestPost({ request, data, env }) {
    const user = data.user; // 直接從海關拿
    if (user.role === 'student') return new Response("Forbidden", { status: 403 });

    const reqData = await request.json();
    await env.DB.prepare("INSERT OR REPLACE INTO tasks (id, title, date, type, subject, remarks, url, color, completed, createdBy) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .bind(reqData.id, reqData.title, reqData.date, reqData.type, reqData.subject, reqData.remarks, reqData.url, reqData.color, reqData.completed, user.username).run();
    return Response.json({ success: true });
}

export async function onRequestDelete({ request, data, env }) {
    const user = data.user;
    if (user.role === 'student') return new Response("Forbidden", { status: 403 });

    const id = new URL(request.url).searchParams.get('id');
    const task = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
    
    if (user.role !== 'admin' && task.createdBy !== user.username) {
        return new Response("Forbidden", { status: 403 });
    }

    await env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
    return Response.json({ success: true });
}
