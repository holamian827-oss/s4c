export async function onRequestPost({ request, env }) {
    try {
        const { username, password, role } = await request.json();
        
        // 這裡的變量 DB 必須與你 Cloudflare Pages 后台綁定的 Variable Name 完全一致
        const user = await env.DB.prepare(
            "SELECT * FROM users WHERE username = ? AND password = ? AND role = ?"
        ).bind(username, password, role).first();

        if (user) {
            return Response.json({ 
                success: true, 
                user: user.username, 
                role: user.role 
            });
        }
        return Response.json({ success: false, message: "帳號或密碼錯誤" }, { status: 401 });
    } catch (e) {
        return Response.json({ success: false, error: "數據庫連線失敗: " + e.message }, { status: 500 });
    }
}

