export async function onRequestPost({ request, env }) {
    try {
        const { username, password, role } = await request.json();
        
        const { results } = await env.DB.prepare(
            "SELECT * FROM users WHERE username = ? AND password = ? AND role = ?"
        ).bind(username, password, role).all();

        if (results && results.length > 0) {
            return Response.json({ success: true, token: "auth-" + username, user: username, role: role });
        } else {
            return Response.json({ success: false, message: "账号或密码错误" }, { status: 401 });
        }
    } catch (e) {
        return Response.json({ success: false, message: "服务器内部错误: " + e.message }, { status: 500 });
    }
}
