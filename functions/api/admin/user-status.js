export async function onRequestPost({ request, env }) {
    const { username, bannedUntil } = await request.json();
    await env.DB.prepare("UPDATE users SET banned_until = ? WHERE username = ?")
        .bind(bannedUntil, username).run();
    return Response.json({ success: true });
}
