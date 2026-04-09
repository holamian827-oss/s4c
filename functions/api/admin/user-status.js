export async function onRequestPost({ request, env }) {
    try {
        const { username, bannedUntil } = await request.json();
        
        await env.DB.prepare("UPDATE users SET banned_until = ? WHERE username = ?")
            .bind(bannedUntil, username)
            .run();

        return Response.json({ success: true });
    } catch (e) {
        return Response.json({ success: false, message: e.message }, { status: 500 });
    }
}
