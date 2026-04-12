// functions/api/admin/users.js
export async function onRequestGet({ request, env }) {
    const cookie = request.headers.get('Cookie');
    if (!cookie) return new Response("Unauthorized", { status: 401 });
    const match = cookie.match(/session_token=([^;]+)/);
    const user = match ? await env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(match[1]).first() : null;
    
    // 💡 檢查是否為管理員
    if (!user || user.role !== 'admin') return new Response("Forbidden", { status: 403 });

    const { results } = await env.DB.prepare("SELECT username, role, banned_until, last_login FROM users ORDER BY username ASC").all();
    return Response.json(results || []);
}
