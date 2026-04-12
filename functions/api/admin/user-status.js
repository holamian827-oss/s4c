export async function onRequestPost({ request, env }) {
    try {
        const cookie = request.headers.get('Cookie');
        if (!cookie) return new Response("Unauthorized", { status: 401 });
        
        const match = cookie.match(/session_token=([^;]+)/);
        const user = match ? await env.DB.prepare("SELECT role FROM users WHERE session_token = ?").bind(match[1]).first() : null;
        
        // 🔒 管理员鉴权
        if (!user || user.role !== 'admin') return new Response("Forbidden", { status: 403 });

        const { username, bannedUntil } = await request.json();
        await env.DB.prepare("UPDATE users SET banned_until = ? WHERE username = ?").bind(bannedUntil, username).run();
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ success: false, message: error.message }, { status: 500 });
    }
}
