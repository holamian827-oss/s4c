export async function onRequestGet({ env }) {
    try {
        const { results } = await env.DB.prepare("SELECT * FROM tasks").all();
        return Response.json(results || []);
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}

export async function onRequestPost({ request, env }) {
    try {
        const data = await request.json();
        await env.DB.prepare(
            "INSERT OR REPLACE INTO tasks (id, title, date, type, subject, remarks, url, color, completed, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
            data.id, data.title, data.date, data.type, data.subject, 
            data.remarks, data.url, data.color, data.completed ? 1 : 0, data.createdBy
        ).run();
        return Response.json({ success: true });
    } catch (e) {
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function onRequestDelete({ request, env }) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get('id');
        if (id) {
            await env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
        }
        return Response.json({ success: true });
    } catch (e) {
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}
