export async function onRequest({ request, env }) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    // --- 1. 获取所有数据 (GET) ---
    if (request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM tasks ORDER BY date DESC").all();
        return Response.json(results || []);
    }

    // --- 2. 新增或更新数据 (POST) ---
    if (request.method === "POST") {
        const data = await request.json();
        await env.DB.prepare(`
            INSERT OR REPLACE INTO tasks 
            (id, title, date, type, subject, remarks, url, color, completed, createdBy) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.id, data.title, data.date, data.type, data.subject, 
            data.remarks, data.url, data.color, data.completed ? 1 : 0, data.createdBy
        ).run();
        return Response.json({ success: true });
    }

    // --- 3. 删除数据 (DELETE) ---
    if (request.method === "DELETE") {
        if (!id) return Response.json({ success: false }, { status: 400 });
        await env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
        return Response.json({ success: true });
    }

    return new Response("Method not allowed", { status: 405 });
}
