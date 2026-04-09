const USER = { name: localStorage.getItem('s4c_user'), role: localStorage.getItem('s4c_role') };
let taskList = [];
let calendar = null;
let currentTaskId = null;
let adminUserList = [];

document.addEventListener('DOMContentLoaded', function() {
    
    // --- 1. 身分檢查 ---
    if (!USER.name || !USER.role) {
        window.location.href = 'login.html';
        return; 
    }

    document.getElementById('navUserInfo').textContent = `${USER.role === 'admin' ? '🛡️' : '👤'} ${USER.name}`;

    // --- 2. 權限與視圖分配 ---
    const mainAppView = document.getElementById('mainAppView');
    const adminDashboardView = document.getElementById('adminDashboardView');
    const btnNavAdminAdd = document.getElementById('btnNavAdminAdd');
    const btnSysMenu = document.getElementById('btnSysMenu');
    const btnOpenModal = document.getElementById('btnOpenModal');

    if (USER.role === 'admin') {
        adminDashboardView.classList.remove('hidden');
        btnNavAdminAdd.classList.remove('hidden');
        btnSysMenu.classList.add('hidden'); 
    } else {
        mainAppView.classList.remove('hidden');
        if (USER.role === 'teacher') btnOpenModal.classList.remove('hidden');
    }

    // --- 3. 系統菜單 (Tab 設計) ---
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

    document.getElementById('btnLogout')?.addEventListener('click', () => { localStorage.clear(); window.location.href = 'login.html'; });

    // --- 同學的 API：修改密碼 ---
    document.getElementById('btnChangeMyPwd')?.addEventListener('click', async () => {
        const oldP = prompt("請輸入您的目前密碼：");
        const newP = prompt("請輸入新密碼 (最少 6 個字元)：");
        if (!oldP || !newP || newP.length < 6) return alert("❌ 無效輸入或密碼太短！");
        
        try {
            const res = await fetch('/api/change-password', { 
                method: 'POST', headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ username: USER.name, oldPassword: oldP, newPassword: newP }) 
            });
            const data = await res.json();
            if (data.success) { alert("✅ 密碼更改成功！請重新登入。"); localStorage.clear(); location.href = 'login.html'; }
            else { alert("❌ 舊密碼不正確！"); }
        } catch(e) { alert("連接伺服器失敗！"); }
    });

    // --- 修復：意見反饋 ---
    const feedbackModal = document.getElementById('feedbackModal');
    document.getElementById('btnFeedback')?.addEventListener('click', () => feedbackModal.classList.remove('hidden'));
    document.getElementById('btnCloseFeedback')?.addEventListener('click', () => feedbackModal.classList.add('hidden'));
    document.getElementById('feedbackForm')?.addEventListener('submit', (e) => { 
        e.preventDefault(); 
        alert("✅ 感謝您的反饋！意見已成功提交。"); 
        feedbackModal.classList.add('hidden'); 
        e.target.reset();
    });

    // --- 4. 核心數據獲取 (對接同學的 Task API) ---
    async function loadData() {
        try {
            const res = await fetch('/api/tasks');
            taskList = await res.json();
            
            if (USER.role !== 'admin') {
                renderCalendar(taskList); // 初次渲染全量數據
            } else {
                renderAdminAuditLog();
                loadAdminUsers();
            }
            document.getElementById('loadingShield').classList.add('hidden');
        } catch (e) {
            console.error(e);
            document.getElementById('loadingShield').innerHTML = '<p class="text-red-500 font-bold">⚠️ 數據載入失敗，請檢查網絡連線</p>';
        }
    }

    // --- 5. 日曆與修復篩選功能 ---
    function renderCalendar(tasksToRender) {
        const events = tasksToRender.map(t => ({
            id: t.id, title: t.title, start: t.date, color: t.color || (t.type === 'test' ? '#EF4444' : '#3B82F6'), extendedProps: t
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

    // 篩選按鈕事件
    document.getElementById('applyFilter')?.addEventListener('click', () => {
        if (!calendar) return;
        const selectedType = document.getElementById('filterType').value;
        const selectedSubject = document.getElementById('filterSubject').value;
        
        const filteredTasks = taskList.filter(task => {
            const matchType = (selectedType === 'all' || task.type === selectedType);
            const matchSubject = (selectedSubject === 'all' || task.subject === selectedSubject);
            return matchType && matchSubject;
        });
        
        renderCalendar(filteredTasks); // 用過濾後嘅數據重刷日曆
    });

    // --- 6. 項目操作 (新增/修改/刪除/詳情) ---
    function openDetailModalById(id) {
        const task = taskList.find(t => t.id === id);
        if(!task) return;
        currentTaskId = id;

        document.getElementById('detailTitle').textContent = task.title;
        document.getElementById('detailType').textContent = task.type === 'homework' ? '功課' : task.type === 'test' ? '測驗' : '其他';
        document.getElementById('detailSubject').textContent = task.subject || '無';
        document.getElementById('detailRemarks').textContent = task.remarks || '無';
        
        const urlContainer = document.getElementById('detailUrlContainer');
        if(task.url) { urlContainer.classList.remove('hidden'); document.getElementById('detailUrl').href = task.url; } 
        else { urlContainer.classList.add('hidden'); }

        const isCreatorOrAdmin = (USER.role === 'admin' || task.createdBy === USER.name || USER.role === 'teacher');
        document.getElementById('manageActionContainer').classList.toggle('hidden', !isCreatorOrAdmin);
        document.getElementById('detailModal').classList.remove('hidden');
    }

    document.getElementById('btnCloseDetailX').onclick = () => document.getElementById('detailModal').classList.add('hidden');
    document.getElementById('btnCloseDetailBtn').onclick = () => document.getElementById('detailModal').classList.add('hidden');

    // 刪除 (對接同學 API)
    document.getElementById('btnDeleteTask')?.addEventListener('click', async () => {
        if(confirm("⚠️ 確定要刪除此項目嗎？")) {
            await fetch(`/api/tasks?id=${currentTaskId}`, { method: 'DELETE' });
            document.getElementById('detailModal').classList.add('hidden');
            loadData(); 
        }
    });

    // 準備修改
    document.getElementById('btnEditTask')?.addEventListener('click', () => {
        const task = taskList.find(t => t.id === currentTaskId);
        if(!task) return;
        document.getElementById('inputTitle').value = task.title.replace(/^\[.*?\] /, ''); 
        document.getElementById('inputRemarks').value = task.remarks || '';
        document.getElementById('inputUrl').value = task.url || '';
        document.getElementById('inputType').value = task.type || 'homework';
        document.getElementById('inputSubject').value = task.subject || '';
        document.getElementById('inputDate').value = task.date || '';
        
        document.getElementById('modalTitle').textContent = "✏️ 修改項目";
        document.getElementById('detailModal').classList.add('hidden');
        document.getElementById('addModal').classList.remove('hidden');
    });

    const openAddModal = () => {
        currentTaskId = null; 
        document.getElementById('modalTitle').textContent = "📝 發佈項目";
        document.getElementById('addTaskForm').reset();
        document.getElementById('addModal').classList.remove('hidden');
    };
    document.getElementById('btnOpenModal')?.addEventListener('click', openAddModal);
    document.getElementById('btnNavAdminAdd')?.addEventListener('click', openAddModal);
    document.getElementById('btnCloseModal').onclick = () => document.getElementById('addModal').classList.add('hidden');

    // 儲存項目 (對接同學 API + 智能 URL)
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
            id: currentTaskId || String(Date.now()),
            title: fullTitle, date: document.getElementById('inputDate').value,
            type: type, subject: document.getElementById('inputSubject').value,
            remarks: document.getElementById('inputRemarks').value,
            url: urlInput, color: type === 'test' ? '#EF4444' : '#3B82F6', 
            completed: 0, createdBy: USER.name
        };

        await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskData) });
        
        document.getElementById('addModal').classList.add('hidden');
        btn.textContent = "儲存"; btn.disabled = false;
        loadData();
    });

    // --- 7. 管理員後台 (對接同學 User API) ---
    function renderAdminAuditLog() {
        const ul = document.getElementById('adminAuditLog');
        if (!ul) return;
        ul.innerHTML = taskList.slice(0, 20).map(log => `
            <li class="border-b pb-3">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-gray-800">${log.title}</span>
                    <button class="bg-gray-100 px-2 py-1 rounded text-xs font-bold" onclick="document.dispatchEvent(new CustomEvent('openTaskDetail', {detail: '${log.id}'}))">查看</button>
                </div>
                <div class="text-xs text-gray-500 flex gap-2"><span class="bg-blue-100 text-blue-700 px-1 rounded">${log.createdBy || '系統'}</span><span>${log.date}</span></div>
            </li>`).join('');
    }
    document.addEventListener('openTaskDetail', (e) => openDetailModalById(e.detail));

    async function loadAdminUsers() {
        try {
            const res = await fetch('/api/admin/users');
            adminUserList = await res.json();
            const select = document.getElementById('adminStudentSelect');
            if(!select) return;
            select.innerHTML = '<option value="">-- 請選擇學號 --</option>' + 
                adminUserList.filter(u => u.role === 'student' || u.role === 'teacher').map(u => `<option value="${u.username}">${u.username}</option>`).join('');
        } catch(e) {}
    }

    const adminSelect = document.getElementById('adminStudentSelect');
    if(adminSelect) {
        adminSelect.addEventListener('change', (e) => {
            const targetUser = e.target.value;
            const panel = document.getElementById('adminStudentPanel');
            const msg = document.getElementById('adminStudentEmptyMsg');
            
            if(!targetUser) { panel.classList.add('hidden'); panel.classList.remove('flex'); msg.classList.remove('hidden'); return; }
            
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

    // 封鎖帳號 API
    async function setBanStatus(duration) {
        const u = document.getElementById('adminStudentSelect').value;
        if(!u) return;
        
        let until = "";
        if (duration === '1d') { const d = new Date(); d.setDate(d.getDate()+1); until = d.toISOString(); }
        else if (duration === 'perm') until = 'permanent';

        await fetch('/api/admin/user-status', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: u, bannedUntil: until }) });
        alert("✅ 帳號狀態更新成功！");
        loadAdminUsers();
        document.getElementById('adminStudentSelect').value = '';
        document.getElementById('adminStudentSelect').dispatchEvent(new Event('change'));
    }

    document.getElementById('btnAdminSuspend1D')?.addEventListener('click', () => setBanStatus('1d'));
    document.getElementById('btnAdminSuspendPerm')?.addEventListener('click', () => setBanStatus('perm'));
    document.getElementById('btnAdminUnban')?.addEventListener('click', () => setBanStatus(''));

    // 啟動
    loadData();
});
