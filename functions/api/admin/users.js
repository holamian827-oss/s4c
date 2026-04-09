export async function onRequestGet({ env }) {
    try {
        // 從數據庫取出所有人，按照用戶名排序
        const { results } = await env.DB.prepare("SELECT username, role, banned_until FROM users ORDER BY username ASC").all();
        return Response.json(results || []);
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}
