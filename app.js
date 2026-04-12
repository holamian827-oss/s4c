// --- 全域變數 ---
const USER = { name: localStorage.getItem('s4c_user'), role: localStorage.getItem('s4c_role') };
let taskList = [];
let calendar = null;
let currentTaskId = null;
let editingTaskId = null;
let adminUserList = [];

document.addEventListener('DOMContentLoaded', function() {
    
    // --- 1. 身分檢查與介面初始化 ---
    const rawUser = localStorage.getItem('s4c_user');
    const savedRole = localStorage.getItem('s4c_role');
    
    // 如果本地紀錄缺失，跳回登入頁
    if (!rawUser || !savedRole || rawUser === '未登入') {
        window.location.href = 'login.html';
        return; 
    }

    const navUserInfo = document.getElementById('navUserInfo');
    if (navUserInfo) navUserInfo.textContent = rawUser;
    
    document.getElementById('loadingShield')?.classList.add('hidden');

    // --- 2. 視圖權限控制 (UI 層面) ---
    const mainAppView = document.getElementById('mainAppView');
    const adminDashboardView = document.getElementById('adminDashboardView');
    const btnNavAdminAdd = document.getElementById('btnNavAdminAdd');
    const btnOpenModal = document.getElementById('btnOpenModal');

    if (savedRole === 'admin') {
        adminDashboardView?.classList.remove('hidden');
        btnNavAdminAdd?.classList.remove('hidden');
    } else {
        mainAppView?.classList.remove('hidden');
        if (savedRole === 'teacher') btnOpenModal?.classList.remove('hidden');
    }

    // --- 3. 系統選單與安全登出 ---
    const sysMenuModal = document.getElementById('sysMenuModal');
    document.getElementById('btnSysMenu')?.addEventListener('click', () => sysMenuModal?.classList.remove('hidden'));
    document.getElementById('btnCloseSysMenu')?.addEventListener('click', () => sysMenuModal?.classList.add('hidden'));

    // 💡 零信任安全登出：銷毀伺服器端的 HttpOnly Cookie
    document.getElementById('btnLogout')?.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
        } catch (e) {
            console.error("登出通訊失敗");
        }
        localStorage.clear();
        window.location.href = 'login.html';
    });

    document.querySelectorAll('.sys-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            document.querySelectorAll('.sys-tab-content').forEach(content => {
                content.classList.toggle('hidden', content.id !== targetId);
                content.classList.toggle('block', content.id === targetId);
            });
        });
    });

    // 變更密碼 (後端會自動驗證當前 Token)
    document.getElementById('btnChangeMyPwd')?.addEventListener('click', async () => {
        const oldP = prompt("請輸入目前的密碼：");
        const newP = prompt("請輸入新密碼 (最少 6 個字元)：");
        if (!oldP || !newP || newP.length < 6) return alert("❌ 輸入無效！");
        
        try {
            const res = await fetch('/api/change-password', { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ oldPassword: oldP, newPassword: newP }) 
            });
            const data = await res.json();
            if (data.success) { 
                alert("✅ 密碼更改成功！請重新登入。"); 
                document.getElementById('btnLogout').click();
            } else { 
                alert(`❌ 失敗：${data.message}`); 
            }
        } catch(e) { alert("無法連接伺服器"); }
    });

    // --- 4. 數據加載邏輯 ---
    async function loadData() {
        try {
            const res = await fetch('/api/tasks');
            if (res.status === 401) {
                window.location.href = 'login.html'; // Token 失效
                return;
            }
            taskList = await res.json();
            
            if (savedRole === 'admin') {
                renderAdminAuditLog();
                loadAdminUsers();
            } else {
                renderCalendar(taskList);
            }
        } catch (e) { console.error("加載失敗", e); }
    }

    function renderCalendar(data) {
        const el = document.getElementById('calendar');
        if (!el) return;
        
        const events = data.map(t => ({
            id: t.id, title: t.title, start: t.date, 
            color: t.color || (t.type === 'test' ? '#EF4444' : '#3B82F6'), 
            extendedProps: t
        }));

        if (!calendar) {
            calendar = new FullCalendar.Calendar(el, {
                initialView: 'dayGridMonth',
                events: events,
                eventClick: (info) => openDetailModalById(info.event.id)
            });
            calendar.render();
        } else {
            calendar.removeAllEvents();
            calendar.addEventSource(events);
        }
    }

    // --- 5. 管理員專區：真實日誌與用戶管理 ---
    function renderLoginLogs() {
        const ul = document.getElementById('adminLoginLog');
        if (!ul) return;
        ul.innerHTML = '';

        let active = adminUserList.filter(u => u.last_login).sort((a, b) => new Date(b.last_login) - new Date(a.last_login));
        const now = new Date().getTime();
        // 24小時過期過濾
        active = active.filter(u => (now - new Date(u.last_login).getTime()) < 86400000).slice(0, 50);

        if (active.length === 0) {
            ul.innerHTML = '<li class="text-gray-400 text-center py-4 text-sm border-dashed border-2 rounded">近 24 小時內無人登入</li>';
            return;
        }

        ul.innerHTML = active.map(u => {
            const diff = Math.floor((now - new Date(u.last_login).getTime()) / 60000);
            const timeStr = diff < 5 ? "剛剛" : diff < 60 ? `${diff} 分鐘前` : `${Math.floor(diff/60)} 小時前`;
            return `<li class="flex justify-between items-center bg-white p-3 rounded-lg border border-blue-100 shadow-sm mb-2">
                        <span class="font-bold text-blue-700 text-sm">${u.username}</span>
                        <span class="text-gray-400 text-[10px] bg-gray-50 px-2 py-1 rounded-full font-mono">${timeStr}</span>
                    </li>`;
        }).join('');
    }

    async function loadAdminUsers() {
        try {
            const res = await fetch('/api/admin/users');
            if (res.status === 403) return console.warn("權限不足，無法載入用戶列表");
            
            const rawUsers = await res.json();
            // 💡 修正學號數字排序 (解決 1, 10, 2 亂序)
            adminUserList = rawUsers.sort((a, b) => {
                const numA = parseInt(a.username) || 0;
                const numB = parseInt(b.username) || 0;
                return numA - numB;
            });

            const select = document.getElementById('adminStudentSelect');
            if (select) {
                select.innerHTML = '<option value="">-- 請選擇要管理的學生 --</option>' + 
                    adminUserList.filter(u => u.role === 'student').map(u => `<option value="${u.username}">${u.username}</option>`).join('');
            }
            renderLoginLogs();
            renderBannedList();
        } catch (e) { console.error(e); }
    }

    // --- 6. 管理員：封號與重置功能 ---
    const adminSelect = document.getElementById('adminStudentSelect');
    if (adminSelect) {
        adminSelect.addEventListener('change', (e) => {
            const target = e.target.value;
            const panel = document.getElementById('adminStudentPanel');
            if (!target) { panel?.classList.add('hidden'); return; }
            
            panel?.classList.remove('hidden');
            const uInfo = adminUserList.find(u => u.username === target);
            const statusEl = document.getElementById('adminStudentStatus');
            const btnBan = document.getElementById('btnAdminSuspend');
            
            document.getElementById('adminSelectedStudentName').textContent = target;

            if (uInfo?.banned_until) {
                statusEl.textContent = '🛑 停用中';
                statusEl.className = 'px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-bold';
                btnBan.disabled = true;
                btnBan.textContent = '此帳號已在名單中';
            } else {
                statusEl.textContent = '✅ 狀態正常';
                statusEl.className = 'px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-bold';
                btnBan.disabled = false;
                btnBan.textContent = '🛑 停用此帳號';
            }
        });
    }

    document.getElementById('btnAdminSuspend')?.addEventListener('click', async () => {
        const u = adminSelect?.value;
        const dur = document.getElementById('banDurationSelect')?.value;
        if (!u) return;
        if (confirm(`⚠️ 確定要停用 ${u} 嗎？`)) {
            const until = (dur === 'perm') ? 'permanent' : new Date(Date.now() + 86400000).toISOString();
            await fetch('/api/admin/user-status', { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ username: u, bannedUntil: until }) 
            });
            loadAdminUsers();
        }
    });

    document.getElementById('btnAdminResetPwd')?.addEventListener('click', async () => {
        const u = adminSelect?.value;
        if (u && confirm(`確定重設 ${u} 的密碼為 12345678 嗎？`)) {
            await fetch('/api/admin/reset-password', { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ username: u }) 
            });
            alert("✅ 密碼已成功重置");
        }
    });

    function renderBannedList() {
        const ul = document.getElementById('adminBannedList');
        if (!ul) return;
        const list = adminUserList.filter(u => u.banned_until);
        if (list.length === 0) {
            ul.innerHTML = '<li class="text-gray-400 text-center py-4 text-xs">目前沒有停用的帳號</li>';
            return;
        }
        ul.innerHTML = list.map(u => `
            <li class="flex justify-between items-center p-3 bg-red-50 mb-2 rounded-lg border border-red-100 shadow-sm transition hover:bg-red-100">
                <span class="text-sm font-bold text-red-900">${u.username}</span>
                <button class="bg-green-500 text-white px-3 py-1 rounded-md text-xs font-bold shadow-sm" 
                    onclick="document.dispatchEvent(new CustomEvent('unban', {detail:'${u.username}'}))">解封</button>
            </li>`).join('');
    }

    document.addEventListener('unban', async (e) => {
        await fetch('/api/admin/user-status', { 
            method: 'POST', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({ username: e.detail, bannedUntil: '' }) 
        });
        loadAdminUsers();
    });

    // --- 7. 項目詳情與操作 ---
    function openDetailModalById(id) {
        const t = taskList.find(x => x.id === id);
        if (!t) return;
        currentTaskId = id;
        document.getElementById('detailTitle').textContent = t.title;
        document.getElementById('detailType').textContent = t.type === 'homework' ? '功課' : '測驗';
        document.getElementById('detailSubject').textContent = t.subject || '無';
        document.getElementById('detailRemarks').textContent = t.remarks || '無';
        
        const urlBox = document.getElementById('detailUrlContainer');
        if (t.url) {
            urlBox.classList.remove('hidden');
            document.getElementById('detailUrl').href = t.url;
        } else {
            urlBox.classList.add('hidden');
        }

        // 伺服器會核驗權限，前端僅做按鈕顯示控制
        const isAuthorized = (savedRole === 'admin' || savedRole === 'teacher' || t.createdBy === rawUser);
        document.getElementById('manageActionContainer')?.classList.toggle('hidden', !isAuthorized);
        document.getElementById('detailModal')?.classList.remove('hidden');
    }

    document.getElementById('btnCloseDetailBtn')?.addEventListener('click', () => document.getElementById('detailModal')?.classList.add('hidden'));
    document.getElementById('btnCloseDetailX')?.addEventListener('click', () => document.getElementById('detailModal')?.classList.add('hidden'));

    // 刪除項目 (後端會驗證 Token 是否有權刪除)
    document.getElementById('btnDeleteTask')?.addEventListener('click', async () => {
        if (confirm("⚠️ 確定要刪除嗎？")) {
            const res = await fetch(`/api/tasks?id=${currentTaskId}`, { method: 'DELETE' });
            if (res.ok) {
                document.getElementById('detailModal').classList.add('hidden');
                loadData();
            } else {
                alert("❌ 權限不足，無法刪除！");
            }
        }
    });

    // 新增/修改項目
    document.getElementById('addTaskForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSubmitTask');
        btn.disabled = true;

        const data = {
            id: editingTaskId || String(Date.now()),
            title: document.getElementById('inputTitle').value,
            date: document.getElementById('inputDate').value,
            type: document.getElementById('inputType').value,
            subject: document.getElementById('inputSubject').value,
            remarks: document.getElementById('inputRemarks').value,
            url: document.getElementById('inputUrl').value,
            color: document.getElementById('inputType').value === 'test' ? '#EF4444' : '#3B82F6',
            completed: 0
        };

        const res = await fetch('/api/tasks', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(data) 
        });

        if (res.ok) {
            document.getElementById('addModal').classList.add('hidden');
            loadData();
        } else {
            alert("❌ 儲存失敗：您沒有權限發佈項目！");
        }
        btn.disabled = false;
    });

    // --- 啟動程序 ---
    loadData();
});
