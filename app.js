const USER = { name: localStorage.getItem('s4c_user'), role: localStorage.getItem('s4c_role') };
let taskList = [];
let calendar = null;
let currentTaskId = null;
let editingTaskId = null;
let adminUserList = [];

document.addEventListener('DOMContentLoaded', function() {
    
    // --- 1. 身分檢查 ---
    const rawUser = localStorage.getItem('s4c_user');
    const savedRole = localStorage.getItem('s4c_role');
    const savedUser = (savedRole === 'admin') ? '系統管理員' : rawUser;

    if (!savedUser || !savedRole || savedUser === '未登入') {
        window.location.href = 'login.html';
        return; 
    }

    document.getElementById('navUserInfo').textContent = `${savedUser}`;
    document.getElementById('loadingShield').classList.add('hidden');

    // --- 2. 權限與視圖控制 ---
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

    // --- 3. 系統菜單邏輯 ---
    const sysMenuModal = document.getElementById('sysMenuModal');
    const sysTabBtns = document.querySelectorAll('.sys-tab-btn');
    const sysTabContents = document.querySelectorAll('.sys-tab-content');

    document.getElementById('btnSysMenu')?.addEventListener('click', () => sysMenuModal.classList.remove('hidden'));
    document.getElementById('btnCloseSysMenu')?.addEventListener('click', () => sysMenuModal.classList.add('hidden'));

    sysTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sysTabBtns.forEach(b => { 
                b.classList.replace('bg-blue-50', 'bg-gray-50'); 
                b.classList.replace('text-blue-700', 'text-gray-700'); 
            });
            btn.classList.replace('bg-gray-50', 'bg-blue-50'); 
            btn.classList.replace('text-gray-700', 'text-blue-700');
            const targetId = btn.getAttribute('data-target');
            sysTabContents.forEach(content => {
                content.classList.toggle('hidden', content.id !== targetId);
                content.classList.toggle('block', content.id === targetId);
            });
        });
    });

    document.getElementById('btnLogout')?.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });

    document.getElementById('btnChangeMyPwd')?.addEventListener('click', async () => {
        const oldP = prompt("請輸入您的目前密碼：");
        const newP = prompt("請輸入新密碼 (最少 6 個字元)：");
        if (!oldP || !newP || newP.length < 6) return alert("❌ 無效輸入或密碼太短！");
        
        try {
            const res = await fetch('/api/change-password', { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ username: rawUser, oldPassword: oldP, newPassword: newP }) 
            });
            const data = await res.json();
            if (data.success) { 
                alert("✅ 密碼更改成功！請重新登入。"); 
                localStorage.clear(); 
                window.location.href = 'login.html'; 
            } else { alert("❌ 舊密碼不正確！"); }
        } catch(e) { alert("連接伺服器失敗！"); }
    });

    // --- 4. 數據核心加載 ---
    async function loadData() {
        try {
            const res = await fetch('/api/tasks');
            taskList = await res.json();
            
            if (savedRole !== 'admin') {
                renderCalendar(taskList);
            } else {
                renderAdminAuditLog();
                loadAdminUsers(); // 這裡會同步觸發真實登入日誌的加載
            }
            document.getElementById('loadingShield').classList.add('hidden');
        } catch (e) {
            console.error(e);
            const shield = document.getElementById('loadingShield');
            if (shield) shield.innerHTML = '<p class="text-red-500 font-bold">⚠️ 數據同步失敗，請刷新頁面或聯絡管理員</p>';
        }
    }

    // --- 5. 日曆渲染 ---
    function renderCalendar(dataToRender) {
        const events = dataToRender.map(t => ({
            id: t.id, title: t.title, start: t.date, 
            color: t.color || (t.type === 'test' ? '#EF4444' : '#3B82F6'), extendedProps: t
        }));
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;
        if (!calendar) {
            calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
                events: events,
                eventClick: (info) => openDetailModalById(info.event.id)
            });
            calendar.render();
        } else {
            calendar.removeAllEvents();
            calendar.addEventSource(events);
        }
    }

    // --- 6. 管理員：真實登入日誌渲染 (刷新即同步) ---
    function renderLoginLogs() {
        const ul = document.getElementById('adminLoginLog');
        if (!ul) return;
        
        ul.innerHTML = ''; // 每次渲染先清空

        // 1. 篩選出有登入過的人
        let activeUsers = adminUserList.filter(u => u.last_login && u.last_login.length > 5);
        
        // 2. 排序：最新的排在最前面
        activeUsers.sort((a, b) => new Date(b.last_login) - new Date(a.last_login));

        const now = new Date().getTime();
        const oneDay = 24 * 60 * 60 * 1000;

        // 3. 過濾 24 小時內登入的用戶，實現自動清空
        activeUsers = activeUsers.filter(u => (now - new Date(u.last_login).getTime()) < oneDay);
        activeUsers = activeUsers.slice(0, 50);

        if (activeUsers.length === 0) {
            ul.innerHTML = '<li class="text-gray-400 text-center py-6 bg-gray-50 rounded-lg border border-dashed">近 24 小時內無人登入 😴</li>';
            return;
        }

        ul.innerHTML = activeUsers.map(u => {
            const timeDiff = Math.floor((now - new Date(u.last_login).getTime()) / 60000);
            let timeStr = "";
            if (timeDiff < 5) timeStr = "剛剛";
            else if (timeDiff < 60) timeStr = `${timeDiff} 分鐘前`;
            else timeStr = `${Math.floor(timeDiff/60)} 小時前`;

            return `
                <li class="flex justify-between items-center bg-white p-3 rounded-lg border border-blue-100 shadow-sm mb-2 hover:bg-blue-50 transition">
                    <span class="font-bold text-blue-700">${u.username}</span>
                    <span class="text-gray-500 text-xs font-semibold bg-gray-100 px-3 py-1 rounded-full">${timeStr}</span>
                </li>`;
        }).join('');
    }

    // --- 7. 管理員數據載入 ---
    async function loadAdminUsers() {
        try {
            const res = await fetch('/api/admin/users');
            const rawUsers = await res.json();
            
            // 排序：學號按數字排
            adminUserList = rawUsers.sort((a, b) => {
                const numA = parseInt(a.username.split('_')[0]) || 0;
                const numB = parseInt(b.username.split('_')[0]) || 0;
                return numA - numB;
            });

            const select = document.getElementById('adminStudentSelect');
            if(select) {
                select.innerHTML = '<option value="">-- 請選擇要管理的學號 --</option>' + 
                    adminUserList.filter(u => u.role === 'student')
                    .map(u => `<option value="${u.username}">${u.username}</option>`).join('');
            }
            
            renderBannedList();
            renderLoginLogs(); // 💡 確保這裡會執行登入日誌渲染
        } catch(e) { console.error("管理員數據載入失敗:", e); }
    }

    // --- 8. 管理員：小黑屋與操作 ---
    function renderBannedList() {
        const ul = document.getElementById('adminBannedList');
        if (!ul) return;
        const bannedUsers = adminUserList.filter(u => u.banned_until);
        
        if (bannedUsers.length === 0) {
            ul.innerHTML = '<li class="text-gray-400 text-center py-6 bg-gray-50 rounded-lg border border-dashed text-sm">目前沒有被停用的帳號 🎉</li>';
            return;
        }
        
        ul.innerHTML = bannedUsers.map(u => {
            const isPerm = u.banned_until === 'permanent';
            const statusStr = isPerm ? '🛑 永久停用' : '⏳ 停用 1 天';
            return `
                <li class="flex justify-between items-center bg-white p-4 rounded-xl border border-red-100 shadow-sm mb-3">
                    <div>
                        <span class="font-bold text-gray-800">${u.username}</span>
                        <div class="text-xs mt-1 text-red-500 font-medium">${statusStr}</div>
                    </div>
                    <button class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition" 
                        onclick="document.dispatchEvent(new CustomEvent('quickUnban', {detail: '${u.username}'}))">解封</button>
                </li>`;
        }).join('');
    }

    const adminSelect = document.getElementById('adminStudentSelect');
    if(adminSelect) {
        adminSelect.addEventListener('change', (e) => {
            const targetUser = e.target.value;
            const panel = document.getElementById('adminStudentPanel');
            if(!targetUser) { panel?.classList.add('hidden'); return; }
            
            const uInfo = adminUserList.find(u => u.username === targetUser);
            if(!uInfo) return;

            panel?.classList.remove('hidden'); 
            panel?.classList.add('flex');
            document.getElementById('adminSelectedStudentName').textContent = targetUser;
            
            const statusEl = document.getElementById('adminStudentStatus');
            const btnBan = document.getElementById('btnAdminSuspend');
            const banSelect = document.getElementById('banDurationSelect');

            if(uInfo.banned_until) {
                if(statusEl) {
                    statusEl.textContent = uInfo.banned_until === 'permanent' ? '🛑 狀態：永久停用' : '⚠️ 狀態：停用中';
                    statusEl.className = 'px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700';
                }
                if(btnBan) {
                    btnBan.disabled = true;
                    btnBan.className = "w-2/3 bg-gray-300 text-gray-500 py-3 rounded-lg text-base font-bold cursor-not-allowed";
                    btnBan.textContent = "已停用";
                }
                if(banSelect) banSelect.disabled = true;
            } else {
                if(statusEl) {
                    statusEl.textContent = '✅ 狀態：正常';
                    statusEl.className = 'px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700';
                }
                if(btnBan) {
                    btnBan.disabled = false;
                    btnBan.className = "w-2/3 bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg text-base font-bold shadow-sm transition";
                    btnBan.innerHTML = "🛑 停用帳號";
                }
                if(banSelect) banSelect.disabled = false;
            }
        });
    }

    async function setBanStatus(targetUsername, duration) {
        if(!targetUsername) return;
        let until = "";
        if (duration === '1d') { 
            const d = new Date(); d.setDate(d.getDate()+1); until = d.toISOString(); 
        } else if (duration === 'perm') { until = 'permanent'; }
        
        await fetch('/api/admin/user-status', { 
            method: 'POST', headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({ username: targetUsername, bannedUntil: until }) 
        });
        await loadAdminUsers();
        if(adminSelect && adminSelect.value === targetUsername) adminSelect.dispatchEvent(new Event('change'));
    }

    document.getElementById('btnAdminSuspend')?.addEventListener('click', () => {
        const u = adminSelect?.value;
        const durationValue = document.getElementById('banDurationSelect').value;
        const durationText = durationValue === '1d' ? '1 天' : '永久';
        if(confirm(`⚠️ 確定要【${durationText}】停用 ${u} 嗎？`)) setBanStatus(u, durationValue);
    });

    document.addEventListener('quickUnban', (e) => {
        if(confirm(`✅ 確定要解除 ${e.detail} 的停用狀態嗎？`)) setBanStatus(e.detail, '');
    });

    document.getElementById('btnAdminResetPwd')?.addEventListener('click', async () => {
        const targetUser = adminSelect?.value;
        if (confirm(`⚠️ 確定要將 ${targetUser} 的密碼重設為預設 (12345678) 嗎？`)) {
            const res = await fetch('/api/admin/reset-password', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: targetUser })
            });
            const data = await res.json();
            if (data.success) alert(`✅ 成功！${targetUser} 的密碼已恢復。`);
        }
    });

    // --- 9. 審核日誌 (近期新增項目) ---
    function renderAdminAuditLog() {
        const ul = document.getElementById('adminAuditLog');
        if (!ul) return;
        ul.innerHTML = taskList.slice(0, 20).map(log => `
            <li class="border-b pb-3">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-gray-800">${log.title}</span>
                    <button class="bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-xs font-bold transition" onclick="document.dispatchEvent(new CustomEvent('openTaskDetail', {detail: '${log.id}'}))">查看</button>
                </div>
            </li>`).join('');
    }
    document.addEventListener('openTaskDetail', (e) => openDetailModalById(e.detail));

    // 啟動加載
    loadData();
});
