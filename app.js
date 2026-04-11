// --- 全域變數 ---
const USER = { name: localStorage.getItem('s4c_user'), role: localStorage.getItem('s4c_role') };
let taskList = [];
let calendar = null;
let currentTaskId = null;
let editingTaskId = null;
let adminUserList = [];

document.addEventListener('DOMContentLoaded', function() {
    
    // --- 1. 身分檢查與初始化 ---
    const rawUser = localStorage.getItem('s4c_user');
    const savedRole = localStorage.getItem('s4c_role');
    const savedUser = (savedRole === 'admin') ? '系統管理員' : rawUser;

    // 沒登入就踢回登入頁
    if (!savedUser || !savedRole || savedUser === '未登入') {
        window.location.href = 'login.html';
        return; 
    }

    // 顯示用戶名
    const navUserInfo = document.getElementById('navUserInfo');
    if(navUserInfo) navUserInfo.textContent = `${savedUser}`;
    
    // 隱藏加載屏
    document.getElementById('loadingShield')?.classList.add('hidden');

    // --- 2. 視圖與權限控制 ---
    const mainAppView = document.getElementById('mainAppView');
    const adminDashboardView = document.getElementById('adminDashboardView');
    const btnNavAdminAdd = document.getElementById('btnNavAdminAdd');
    const btnOpenModal = document.getElementById('btnOpenModal');

    if (savedRole === 'admin') {
        adminDashboardView?.classList.remove('hidden');
        btnNavAdminAdd?.classList.remove('hidden');
    } else {
        mainAppView?.classList.remove('hidden');
        // 只有老師和管理員能看到「新增項目」按鈕
        if (savedRole === 'teacher' || savedRole === 'admin') {
            btnOpenModal?.classList.remove('hidden');
        }
    }

    // --- 3. 系統功能：登出、改密碼、選單 ---
    const sysMenuModal = document.getElementById('sysMenuModal');
    const sysTabBtns = document.querySelectorAll('.sys-tab-btn');
    const sysTabContents = document.querySelectorAll('.sys-tab-content');

    document.getElementById('btnSysMenu')?.addEventListener('click', () => sysMenuModal.classList.remove('hidden'));
    document.getElementById('btnCloseSysMenu')?.addEventListener('click', () => sysMenuModal.classList.add('hidden'));

    // 系統選單切換分頁
    sysTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sysTabBtns.forEach(b => { 
                b.classList.replace('bg-blue-50', 'bg-gray-50'); 
                b.classList.replace('text-blue-700', 'text-gray-700'); 
            });
            btn.classList.replace('bg-gray-50', 'bg-blue-50'); 
            btn.classList.replace('text-blue-700', 'text-gray-700');
            const targetId = btn.getAttribute('data-target');
            sysTabContents.forEach(content => {
                content.classList.toggle('hidden', content.id !== targetId);
                content.classList.toggle('block', content.id === targetId);
            });
        });
    });

    // 登出
    document.getElementById('btnLogout')?.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });

    // 個人密碼修改
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

    // --- 4. 數據核心：載入任務與用戶 ---
    async function loadData() {
        try {
            const res = await fetch('/api/tasks');
            taskList = await res.json();
            
            if (savedRole === 'admin') {
                renderAdminAuditLog();
                loadAdminUsers(); // 管理員加載用戶名單和登入日誌
            } else {
                renderCalendar(taskList);
            }
            document.getElementById('loadingShield')?.classList.add('hidden');
        } catch (e) {
            console.error("數據加載失敗:", e);
        }
    }

    // --- 5. 日曆邏輯 ---
    function renderCalendar(dataToRender) {
        const events = dataToRender.map(t => ({
            id: t.id, title: t.title, start: t.date, 
            color: t.color || (t.type === 'test' ? '#EF4444' : '#3B82F6'), 
            extendedProps: t
        }));

        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;

        if (!calendar) {
            calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                locale: 'zh-tw',
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

    // 篩選功能
    document.getElementById('applyFilter')?.addEventListener('click', () => {
        const selectedType = document.getElementById('filterType').value;
        const selectedSubject = document.getElementById('filterSubject').value;
        const filteredTasks = taskList.filter(task => {
            return (selectedType === 'all' || task.type === selectedType) && 
                   (selectedSubject === 'all' || task.subject === selectedSubject);
        });
        renderCalendar(filteredTasks);
    });

    // --- 6. 項目操作：詳情、編輯、刪除 ---
    function openDetailModalById(id) {
        const task = taskList.find(t => t.id === id);
        if(!task) return;
        currentTaskId = id;

        document.getElementById('detailTitle').textContent = task.title;
        document.getElementById('detailType').textContent = task.type === 'homework' ? '功課' : task.type === 'test' ? '測驗' : '其他';
        document.getElementById('detailSubject').textContent = task.subject || '無';
        document.getElementById('detailRemarks').textContent = task.remarks || '無';
        
        const urlContainer = document.getElementById('detailUrlContainer');
        if(task.url) { 
            urlContainer.classList.remove('hidden'); 
            document.getElementById('detailUrl').href = task.url; 
        } else { 
            urlContainer.classList.add('hidden'); 
        }

        // 判斷權限：管理員、老師或創建者可以操作
        const isAuthorized = (savedRole === 'admin' || savedRole === 'teacher' || task.createdBy === rawUser);
        document.getElementById('manageActionContainer')?.classList.toggle('hidden', !isAuthorized);
        document.getElementById('detailModal')?.classList.remove('hidden');
    }

    document.getElementById('btnCloseDetailX').onclick = () => document.getElementById('detailModal').classList.add('hidden');
    document.getElementById('btnCloseDetailBtn').onclick = () => document.getElementById('detailModal').classList.add('hidden');

    // 刪除
    document.getElementById('btnDeleteTask')?.addEventListener('click', async () => {
        if(confirm("⚠️ 確定要刪除此項目嗎？")) {
            await fetch(`/api/tasks?id=${currentTaskId}`, { method: 'DELETE' });
            document.getElementById('detailModal').classList.add('hidden');
            loadData();
        }
    });

    // 編輯
    document.getElementById('btnEditTask')?.addEventListener('click', () => {
        const task = taskList.find(t => t.id === currentTaskId);
        if(!task) return;
        document.getElementById('inputTitle').value = task.title; 
        document.getElementById('inputRemarks').value = task.remarks || '';
        document.getElementById('inputUrl').value = task.url || '';
        document.getElementById('inputType').value = task.type || 'homework';
        document.getElementById('inputSubject').value = task.subject || '';
        document.getElementById('inputDate').value = task.date || '';
        
        editingTaskId = currentTaskId;
        document.getElementById('modalTitle').textContent = "✏️ 修改項目";
        document.getElementById('detailModal').classList.add('hidden');
        document.getElementById('addModal').classList.remove('hidden');
    });

    // --- 7. 發佈項目 ---
    const openAddModal = () => {
        editingTaskId = null; 
        document.getElementById('modalTitle').textContent = "📝 發佈項目";
        document.getElementById('addTaskForm').reset();
        document.getElementById('addModal').classList.remove('hidden');
    };
    document.getElementById('btnOpenModal')?.addEventListener('click', openAddModal);
    document.getElementById('btnNavAdminAdd')?.addEventListener('click', openAddModal);
    document.getElementById('btnCloseModal').onclick = () => document.getElementById('addModal').classList.add('hidden');

    document.getElementById('addTaskForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSubmitTask');
        btn.textContent = "儲存中..."; btn.disabled = true;

        let urlInput = document.getElementById('inputUrl').value.trim();
        if (urlInput && !/^https?:\/\//i.test(urlInput)) urlInput = 'https://' + urlInput;

        const taskData = {
            id: editingTaskId || String(Date.now()),
            title: document.getElementById('inputTitle').value,
            date: document.getElementById('inputDate').value,
            type: document.getElementById('inputType').value,
            subject: document.getElementById('inputSubject').value,
            remarks: document.getElementById('inputRemarks').value,
            url: urlInput, 
            color: document.getElementById('inputType').value === 'test' ? '#EF4444' : '#3B82F6',
            completed: 0, 
            createdBy: rawUser
        };

        await fetch('/api/tasks', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(taskData) 
        });
        
        document.getElementById('addModal').classList.add('hidden');
        btn.textContent = "儲存"; btn.disabled = false;
        loadData();
    });

    // --- 8. 管理員專屬：真實登入日誌 (刷新即更新) ---
    function renderLoginLogs() {
        const ul = document.getElementById('adminLoginLog');
        if (!ul) return;
        ul.innerHTML = '';

        // 1. 篩選有登入時間的真實帳號
        let activeUsers = adminUserList.filter(u => u.last_login && u.last_login.length > 5);
        
        // 2. 排序：最新的排最上面
        activeUsers.sort((a, b) => new Date(b.last_login) - new Date(a.last_login));

        const now = new Date().getTime();
        const oneDay = 24 * 60 * 60 * 1000;

        // 3. 過濾 24 小時內的人，上限 50 條
        activeUsers = activeUsers.filter(u => (now - new Date(u.last_login).getTime()) < oneDay).slice(0, 50);

        if (activeUsers.length === 0) {
            ul.innerHTML = '<li class="text-gray-400 text-center py-6 bg-gray-50 rounded-lg border border-dashed">近 24 小時無人登入 😴</li>';
            return;
        }

        ul.innerHTML = activeUsers.map(u => {
            const timeDiff = Math.floor((now - new Date(u.last_login).getTime()) / 60000);
            let timeStr = timeDiff < 5 ? "剛剛" : timeDiff < 60 ? `${timeDiff} 分鐘前` : `${Math.floor(timeDiff/60)} 小時前`;

            return `
                <li class="flex justify-between items-center bg-white p-3 rounded-lg border border-blue-100 shadow-sm mb-2 hover:bg-blue-50 transition">
                    <span class="font-bold text-blue-700 text-sm">${u.username}</span>
                    <span class="text-gray-500 text-[10px] font-semibold bg-gray-100 px-3 py-1 rounded-full">${timeStr}</span>
                </li>`;
        }).join('');
    }

    // --- 9. 管理員專屬：用戶管理 ---
    async function loadAdminUsers() {
        try {
            const res = await fetch('/api/admin/users');
            const rawUsers = await res.json();
            
            // 學號數字排序 (解決 1, 10, 2 排序混亂問題)
            adminUserList = rawUsers.sort((a, b) => {
                const numA = parseInt(a.username.split('_')[0]) || 0;
                const numB = parseInt(b.username.split('_')[0]) || 0;
                return numA - numB;
            });

            const select = document.getElementById('adminStudentSelect');
            if(select) {
                select.innerHTML = '<option value="">-- 請選擇學生 --</option>' + 
                    adminUserList.filter(u => u.role === 'student')
                    .map(u => `<option value="${u.username}">${u.username}</option>`).join('');
            }
            
            renderBannedList();
            renderLoginLogs();
        } catch(e) { console.error("管理員加載用戶失敗:", e); }
    }

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

    // 管理面板下拉選擇聯動
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
                    statusEl.textContent = uInfo.banned_until === 'permanent' ? '🛑 永久停用' : '⚠️ 停用中';
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
                    statusEl.textContent = '✅ 正常';
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

    // 管理員審核日誌 (項目變動)
    function renderAdminAuditLog() {
        const ul = document.getElementById('adminAuditLog');
        if (!ul) return;
        ul.innerHTML = taskList.slice(0, 20).map(log => `
            <li class="border-b pb-3">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-gray-800 text-sm">${log.title}</span>
                    <button class="bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-xs font-bold transition" onclick="document.dispatchEvent(new CustomEvent('openTaskDetail', {detail: '${log.id}'}))">查看</button>
                </div>
            </li>`).join('');
    }
    document.addEventListener('openTaskDetail', (e) => openDetailModalById(e.detail));

    // --- 啟動程序 ---
    loadData();
});
