async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    try {
        const cookie = request.headers.get('Cookie');
        if (!cookie) return new Response("Unauthorized", { status: 401 });
        
        const match = cookie.match(/session_token=([^;]+)/);
        const user = match ? await env.DB.prepare("SELECT role FROM users WHERE session_token = ?").bind(match[1]).first() : null;
        
        // 🔒 管理员鉴权
        if (!user || user.role !== 'admin') return new Response("Forbidden", { status: 403 });

        const { username } = await request.json();
        const defaultHash = await hashPassword('12345678'); 

        await env.DB.prepare("UPDATE users SET password = ? WHERE username = ?").bind(defaultHash, username).run();
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ success: false, message: error.message }, { status: 500 });
    }
}
