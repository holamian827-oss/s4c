// functions/api/tasks.js (升級後)

// [讀取]
export async function onRequestGet({ data, env }) {
    // 海關保證了走到這裡的人一定登入了
    const { results } = await env.DB.prepare("SELECT * FROM tasks").all();
    return Response.json(results || []);
}

// [發佈/修改]
export async function onRequestPost({ request, data, env }) {
    const user = data.user; // 直接從海關拿人名
    if (user.role === 'student') return new Response("Forbidden", { status: 403 });

    const reqData = await request.json();
    await env.DB.prepare("INSERT OR REPLACE INTO tasks (id, title, date, type, subject, remarks, url, color, completed, createdBy) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .bind(reqData.id, reqData.title, reqData.date, reqData.type, reqData.subject, reqData.remarks, reqData.url, reqData.color, reqData.completed, user.username).run();
    return Response.json({ success: true });
}
