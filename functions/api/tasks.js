export async function onRequest({ request, env }) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM tasks ORDER BY date DESC").all();
        return Response.json(results || []);
    }
    
    if (request.method === "POST") {
        const d = await request.json();
        // 必须严格对应 init.js 里的 10 个字段顺序
        await env.DB.prepare("INSERT OR REPLACE INTO tasks VALUES (?,?,?,?,?,?,?,?,?,?)")
            .bind(d.id, d.title, d.date, d.type, d.subject || '', d.remarks || '', d.url || '', d.color || '#3b82f6', d.completed || 0, d.createdBy)
            .run();
        return Response.json({ success: true });
    }

    if (request.method === "DELETE") {
        await env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
        return Response.json({ success: true });
    }
}
