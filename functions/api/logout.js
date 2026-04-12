// functions/api/logout.js
export async function onRequestPost({ env }) {
    const headers = new Headers();
    // 💡 清除前端 Cookie
    headers.append("Set-Cookie", `session_token=; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=0`);
    return new Response(JSON.stringify({ success: true }), { headers });
}
