export async function onRequestGet({ env }) {
    const { results } = await env.DB.prepare("SELECT username, role, banned_until FROM users ORDER BY username ASC").all();
    return Response.json(results || []);
}
