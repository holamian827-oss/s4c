document.addEventListener('DOMContentLoaded', function() {
    
    // 1. 【身分檢查站】
    const savedUser = localStorage.getItem('s4c_user');
    const savedRole = localStorage.getItem('s4c_role');

    if (!savedUser || !savedRole || savedUser === '未登入') {
        window.location.href = 'login.html';
        return; 
    }

    document.getElementById('navUserInfo').textContent = `${savedUser}`;

    // 🔒 權限與視圖控制
    const btnOpenModal = document.getElementById('btnOpenModal');
    const btnNavAdminAdd = document.getElementById('btnNavAdminAdd');
    const mainAppView = document.getElementById('mainAppView');
    const adminDashboardView = document.getElementById('adminDashboardView');
    
    if (savedRole === 'admin') {
        adminDashboardView.classList.remove('hidden');
        if(btnNavAdminAdd) btnNavAdminAdd.classList.remove('hidden');
    } else {
        mainAppView.classList.remove('hidden');
        if(savedRole === 'teacher') btnOpenModal.classList.remove('hidden');
    }

    // ≡ 系統菜單邏輯
    const sysMenuModal = document.getElementById('sysMenuModal');
    const sysTabBtns = document.querySelectorAll('.sys-tab-btn');
    const sysTabContents = document.querySelectorAll('.sys-tab-content');

    document.getElementById('btnSysMenu')?.addEventListener('click', () => sysMenuModal.classList.remove('hidden'));
    document.getElementById('btnCloseSysMenu')?.addEventListener('click', () => sysMenuModal.classList.add('hidden'));

    sysTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sysTabBtns.forEach(b => { b.classList.replace('bg-blue-50', 'bg-gray-50'); b.classList.replace('text-blue-700', 'text-gray-700'); });
            btn.classList.replace('bg-gray-50', 'bg-blue-50'); btn.classList.replace('text-gray-700', 'text-blue-700');
            const targetId = btn.getAttribute('data-target');
            sysTabContents.forEach(content => {
                content.classList.toggle('hidden', content.id !== targetId);
                content.classList.toggle('block', content.id === targetId);
            });
        });
    });

    // 🔑 對接同學 API：更改密碼
    document.getElementById('btnChangeMyPwd')?.addEventListener('click', async () => {
        const oldP = prompt("請輸入您的舊密碼：");
        const newP = prompt("請輸入新密碼 (最少 6 個字元)：");
        if (!oldP || !newP || newP.length < 6) { alert("❌ 無效輸入或密碼太短！"); return; }
        
        try {
            const res = await fetch('/api/change-password', { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ username: savedUser, oldPassword: oldP, newPassword: newP }) 
            });
            const data = await res.json();
            if (data.success) { 
                alert("✅ 密碼更改成功！請重新登入。"); 
                localStorage.clear(); 
                location.href = 'login.html'; 
            } else { alert("❌ 舊密碼不正確！"); }
        } catch(e) { alert("連接伺服器失敗！"); }
    });

    document.getElementById('btnLogout')?.addEventListener('click', () => localStorage.clear());

    // ---------------------------------------------------------
    // 核心數據與 API 對接
    // ---------------------------------------------------------
    let taskList = [];
    let currentSelectedTaskId = null;
    let editingTaskId = null;
    let calendar;

    async function loadData() {
        try {
            // 請求同學的 Task API
            const res = await fetch('/api/tasks');
            taskList = await res.json();
            
            if(savedRole !== 'admin') {
                renderCalendar();
            } else {
                renderAdminAuditLog();
                loadAdminUsers();
            }
            document.getElementById('loadingShield').classList.add('hidden');
        } catch (e) {
            console.error("Fetch Data Error:", e);
            document.getElementById('loadingShield').textContent = "⚠️ 數據載入失敗，請檢查網絡";
        }
    }

    // 渲染日曆
    function renderCalendar() {
        const events = taskList.map(t => ({
            id: t.id, title: t.title, start: t.date, color: t.color || (t.type === 'test' ? '#EF4444' : '#3B82F6'), extendedProps: t
        }));

        const calendarEl = document.getElementById('calendar');
        if(!calendarEl) return;

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

    // 顯示詳情視窗
    function openDetailModalById(id) {
        const task = taskList.find(t => t.id === id);
        if(!task) return;
        currentSelectedTaskId = id;

        document.getElementById('detailTitle').textContent = task.title;
        document.getElementById('detailType').textContent = task.type === 'homework' ? '功課' : task.type === 'test' ? '測驗' : '其他';
        document.getElementById('detailSubject').textContent = task.subject || '無';
        document.getElementById('detailRemarks').textContent = task.remarks || '無';
        
        const urlContainer = document.getElementById('detailUrlContainer');
        if(task.url) { 
            urlContainer.classList.remove('hidden'); 
            document.getElementById('detailUrl').href = task.url; 
        } else { urlContainer.classList.add('hidden'); }

        const isCreatorOrAdmin = (savedRole === 'admin' || task.createdBy === savedUser || savedRole === 'teacher');
        document.getElementById('manageActionContainer').classList.toggle('hidden', !isCreatorOrAdmin);

        document.getElementById('detailModal').classList.remove('hidden');
    }

    document.getElementById('btnCloseDetailX').onclick = () => document.getElementById('detailModal').classList.add('hidden');
    document.getElementById('btnCloseDetailBtn').onclick = () => document.getElementById('detailModal').classList.add('hidden');

    // 🗑️ 對接 API：刪除項目
    document.getElementById('btnDeleteTask')?.addEventListener('click', async () => {
        if(confirm("⚠️ 確定要刪除此項目嗎？")) {
            await fetch(`/api/tasks?id=${currentSelectedTaskId}`, { method: 'DELETE' });
            document.getElementById('detailModal').classList.add('hidden');
            loadData(); // 重新拉取數據
        }
    });

    // ✏️ 準備修改
    document.getElementById('btnEditTask')?.addEventListener('click', () => {
        const task = taskList.find(t => t.id === currentSelectedTaskId);
        if(!task) return;
        document.getElementById('inputTitle').value = task.title.replace(/^\[.*?\] /, ''); 
        document.getElementById('inputRemarks').value = task.remarks || '';
        document.getElementById('inputUrl').value = task.url || '';
        document.getElementById('inputType').value = task.type || 'homework';
        document.getElementById('inputSubject').value = task.subject || '';
        document.getElementById('inputDate').value = task.date || '';
        
        editingTaskId = currentSelectedTaskId;
        document.getElementById('modalTitle').textContent = "✏️ 修改項目";
        document.getElementById('detailModal').classList.add('hidden');
        document.getElementById('addModal').classList.remove('hidden');
    });

    // 新增 / 修改 提交 (對接 API)
    const openAddModal = () => {
        editingTaskId = null; 
        document.getElementById('modalTitle').textContent = "📝 發佈項目";
        document.getElementById('addModal').classList.remove('hidden');
    };
    document.getElementById('btnOpenModal')?.addEventListener('click', openAddModal);
    document.getElementById('btnNavAdminAdd')?.addEventListener('click', openAddModal);
    document.getElementById('btnCloseModal').onclick = () => { document.getElementById('addModal').classList.add('hidden'); document.getElementById('addTaskForm').reset(); };

    document.getElementById('addTaskForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSubmitTask');
        btn.textContent = "儲存中..."; btn.disabled = true;

        let urlInput = document.getElementById('inputUrl').value.trim();
        if (urlInput && !/^https?:\/\//i.test(urlInput)) urlInput = 'https://' + urlInput;

        const title = document.getElementById('inputTitle').value;
        const type = document.getElementById('inputType').value;
        const importance = document.getElementById('inputImportance')?.value || '';
        const fullTitle = (type === 'test' && importance) ? `[${importance}] ${title}` : title;

        const taskData = {
            id: editingTaskId || String(Date.now()),
            title: fullTitle, date: document.getElementById('inputDate').value,
            type: type, subject: document.getElementById('inputSubject').value,
            remarks: document.getElementById('inputRemarks').value,
            url: urlInput, createdBy: savedUser, completed: 0
        };

        await fetch('/api/tasks', { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskData) 
        });

        document.getElementById('addModal').classList.add('hidden');
        document.getElementById('addTaskForm').reset();
        btn.textContent = "儲存"; btn.disabled = false;
        loadData(); // 刷新日曆或後台
    });

    // ==========================================
    // 🛡️ 管理員專屬：對接同學的 User API
    // ==========================================
    let adminUserList = [];

    function renderAdminAuditLog() {
        const ul = document.getElementById('adminAuditLog');
        if (!ul) return;
        ul.innerHTML = '';
        // 依賴 Backend 的 ORDER BY date DESC
        taskList.slice(0, 15).forEach(log => {
            ul.innerHTML += `
                <li class="border-b pb-3">
                    <div class="flex justify-between items-start mb-1">
                        <span class="font-bold text-gray-800">${log.title}</span>
                        <button class="bg-gray-100 px-2 py-1 rounded text-xs font-bold" onclick="document.dispatchEvent(new CustomEvent('openTaskDetail', {detail: '${log.id}'}))">查看</button>
                    </div>
                    <div class="text-xs text-gray-500 flex gap-2">
                        <span class="bg-blue-100 text-blue-700 px-1 rounded">${log.createdBy || '系統'}</span>
                        <span>${log.date}</span>
                    </div>
                </li>`;
        });
    }

    document.addEventListener('openTaskDetail', (e) => openDetailModalById(e.detail));

    async function loadAdminUsers() {
        try {
            const res = await fetch('/api/admin/users');
            adminUserList = await res.json();
            const select = document.getElementById('adminStudentSelect');
            if(!select) return;
            select.innerHTML = '<option value="">-- 請選擇學號 --</option>' + 
                adminUserList.filter(u => u.role === 'student').map(u => `<option value="${u.username}">${u.username}</option>`).join('');
        } catch(e) { console.error("Load users failed"); }
    }

    const adminSelect = document.getElementById('adminStudentSelect');
    if(adminSelect) {
        adminSelect.addEventListener('change', (e) => {
            const targetUser = e.target.value;
            const panel = document.getElementById('adminStudentPanel');
            const msg = document.getElementById('adminStudentEmptyMsg');
            
            if(!targetUser) {
                panel.classList.add('hidden'); panel.classList.remove('flex'); msg.classList.remove('hidden');
                return;
            }
            
            const uInfo = adminUserList.find(u => u.username === targetUser);
            msg.classList.add('hidden'); panel.classList.remove('hidden'); panel.classList.add('flex');
            
            const statusEl = document.getElementById('adminStudentStatus');
            const btnUnban = document.getElementById('btnAdminUnban');
            const btnSus1D = document.getElementById('btnAdminSuspend1D');
            const btnSusPerm = document.getElementById('btnAdminSuspendPerm');

            if(uInfo.banned_until) {
                statusEl.textContent = uInfo.banned_until === 'permanent' ? '🛑 永久停用' : '⚠️ 暫時停用中';
                statusEl.className = 'font-bold text-red-600';
                btnUnban.classList.remove('hidden'); btnSus1D.classList.add('hidden'); btnSusPerm.classList.add('hidden');
            } else {
                statusEl.textContent = '✅ 正常';
                statusEl.className = 'font-bold text-green-600';
                btnUnban.classList.add('hidden'); btnSus1D.classList.remove('hidden'); btnSusPerm.classList.remove('hidden');
            }
        });
    }

    // 呼叫同學嘅 Ban API
    async function setBanStatus(duration) {
        const u = document.getElementById('adminStudentSelect').value;
        if(!u) return;
        
        let until = "";
        if (duration === '1d') { const d = new Date(); d.setDate(d.getDate()+1); until = d.toISOString(); }
        else if (duration === 'perm') until = 'permanent';

        await fetch('/api/admin/user-status', { 
            method: 'POST', headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({ username: u, bannedUntil: until }) 
        });
        alert("✅ 帳號狀態更新成功！");
        loadAdminUsers();
        document.getElementById('adminStudentSelect').value = '';
        document.getElementById('adminStudentSelect').dispatchEvent(new Event('change'));
    }

    document.getElementById('btnAdminSuspend1D')?.addEventListener('click', () => setBanStatus('1d'));
    document.getElementById('btnAdminSuspendPerm')?.addEventListener('click', () => setBanStatus('perm'));
    document.getElementById('btnAdminUnban')?.addEventListener('click', () => setBanStatus(''));
    
    // (重設密碼 API 同學未寫，此處維持 alert 提示)
    document.getElementById('btnAdminResetPwd')?.addEventListener('click', () => {
        alert("⚠️ 管理員強制重設密碼 API 後端暫未實裝，敬請期待！");
    });

    // 啟動
    loadData();
});
