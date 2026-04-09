export async function onRequest({ request, env }) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM tasks ORDER BY date DESC").all();
        return Response.json(results || []);
    }
    if (request.method === "POST") {
        const d = await request.json();
        await env.DB.prepare(`INSERT OR REPLACE INTO tasks VALUES (?,?,?,?,?,?,?,?,?,?)`)
            .bind(d.id, d.title, d.date, d.type, d.subject, d.remarks, d.url || '', d.color || '#3B82F6', d.completed, d.createdBy)
            .run();
        return Response.json({ success: true });
    }
    if (request.method === "DELETE") {
        await env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
        return Response.json({ success: true });
    }
}
