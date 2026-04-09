export async function onRequestPost({ request, env }) {
    const { username, password, role } = await request.json();
    const { results } = await env.DB.prepare(
        "SELECT * FROM users WHERE username = ? AND password = ? AND role = ?"
    ).bind(username, password, role).all();

    if (results.length > 0) {
        return Response.json({ success: true, user: username, role: role });
    }
    return Response.json({ success: false }, { status: 401 });
}
