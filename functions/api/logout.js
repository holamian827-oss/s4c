export async function onRequestPost({ request, env }) {
    try {
        // 1. 獲取當前的 Cookie
        const cookie = request.headers.get('Cookie');
        if (cookie) {
            const match = cookie.match(/session_token=([^;]+)/);
            if (match) {
                const token = match[1];
                // 🔒 2. 徹底銷毀：將資料庫中對應的 session_token 清空為 NULL
                await env.DB.prepare("UPDATE users SET session_token = NULL WHERE session_token = ?").bind(token).run();
            }
        }
    } catch (e) {
        // 即使資料庫操作出現意外，也必須繼續執行第三步清空前端 Cookie
        console.error("Token 清除失敗:", e);
    }

    // 3. 清空前端瀏覽器的 Cookie
    const headers = new Headers();
    headers.append("Set-Cookie", `session_token=; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=0`);
    
    return new Response(JSON.stringify({ success: true, message: "已安全登出並銷毀憑證" }), { headers });
}
