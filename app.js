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
    
    if (!rawUser || !savedRole || rawUser === '未登入') {
        window.location.href = 'login.html';
        return; 
    }

    const navUserInfo = document.getElementById('navUserInfo');
    if (navUserInfo) navUserInfo.textContent = rawUser;
    
    document.getElementById('loadingShield')?.classList.add('hidden');

    // --- 2. 視圖權限控制 ---
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

    document.getElementById('btnLogout')?.addEventListener('click', async () => {
        try { await fetch('/api/logout', { method: 'POST' }); } catch (e) {}
        localStorage.clear();
        window.location.href = 'login.html';
    });

    document.querySelectorAll('.sys-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            document.querySelectorAll('.sys-tab-btn').forEach(b => {
                b.classList.replace('bg-blue-50', 'bg-gray-50');
                b.classList.replace('text-blue-700', 'text-gray-700');
            });
            btn.classList.replace('bg-gray-50', 'bg-blue-50');
            btn.classList.replace('text-gray-700', 'text-blue-700');
            
            document.querySelectorAll('.sys-tab-content').forEach(content => {
                content.classList.toggle('hidden', content.id !== targetId);
                content.classList.toggle('block', content.id === targetId);
            });
        });
    });

    document.getElementById('btnChangeMyPwd')?.addEventListener('click', async () => {
        const oldP = prompt("請輸入目前的密碼：");
        const newP = prompt("請輸入新密碼 (最少 6 個字元)：");
        if (!oldP || !newP || newP.length < 6) return alert("❌ 輸入無效！");
        
        try {
            const res = await fetch('/api/change-password', { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ username: rawUser, oldPassword: oldP, newPassword: newP }) 
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

    // 意見反饋
    const feedbackModal = document.getElementById('feedbackModal');
    document.getElementById('btnFeedback')?.addEventListener('click', () => feedbackModal.classList.remove('hidden'));
    document.getElementById('btnCloseFeedback')?.addEventListener('click', () => feedbackModal.classList.add('hidden'));
    document.getElementById('feedbackForm')?.addEventListener('submit', (e) => { 
        e.preventDefault(); 
        alert("✅ 反饋已提交！管理員將會盡快跟進。"); 
        feedbackModal.classList.add('hidden'); 
        document.getElementById('feedbackForm').reset();
    });

    // --- 4. 數據加載邏輯 ---
    async function loadData() {
        try {
            const res = await fetch('/api/tasks');
            if (res.status === 401 || res.status === 403) {
                window.location.href = 'login.html';
                return;
            }
            taskList = await res.json();
            
            if (savedRole === 'admin') {
                loadAdminUsers();
                renderAdminAuditLog();
            } else {
                renderCalendar(taskList);
            }
        } catch (e) { console.error("加載失敗", e); }
    }

    // --- 5. 日曆與篩選 ---
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
                // 手機版預設列表模式
                initialView: window.innerWidth < 768 ? 'listMonth' : 'dayGridMonth',
                headerToolbar: { 
                    left: 'prev,next today', 
                    center: 'title', 
                    right: 'dayGridMonth,listMonth' 
                },
                buttonText: { month: '日曆模式', listMonth: '列表模式', today: '今天' },
                handleWindowResize: true,
                height: 'auto',
                events: events,
                eventClick: (info) => openDetailModalById(info.event.id)
            });
            calendar.render();
        } else {
            calendar.removeAllEvents();
            calendar.addEventSource(events);
        }
    }

    document.getElementById('applyFilter')?.addEventListener('click', () => {
        if (!calendar) return;
        const selectedType = document.getElementById('filterType').value;
        const selectedSubject = document.getElementById('filterSubject').value;
        
        const filteredTasks = taskList.filter(task => {
            // 兼容舊資料：如果舊資料係「數學 (班主任)」，當作「數學」過濾
            let s = task.subject;
            if (s === '數學 (班主任)') s = '數學';
            return (selectedType === 'all' || task.type === selectedType) && (selectedSubject === 'all' || s === selectedSubject);
        });
        renderCalendar(filteredTasks);
    });

    // --- 6. 項目操作 (新增/修改/刪除/詳情) ---
    function openDetailModalById(id) {
        const t = taskList.find(x => x.id === id);
        if(!t) return;
        currentTaskId = id;

        document.getElementById('detailTitle').textContent = t.title;
        
        // 類型翻譯
        let typeStr = '其他';
        if (t.type === 'homework') typeStr = '功課';
        else if (t.type === 'test') typeStr = '測驗';
        else if (t.type === 'notice') typeStr = '通告回條';
        else if (t.type === 'event') typeStr = '學校活動';
        document.getElementById('detailType').textContent = typeStr;

        // 科目處理 (隱藏班主任字眼)
        let displaySubject = t.subject;
        if (displaySubject === '數學 (班主任)') displaySubject = '數學';
        document.getElementById('detailSubject').textContent = displaySubject || '無';
        
        document.getElementById('detailRemarks').textContent = t.remarks || '無';
        
        const urlContainer = document.getElementById('detailUrlContainer');
        if(t.url) { 
            urlContainer.classList.remove('hidden'); 
            document.getElementById('detailUrl').href = t.url; 
        } else { urlContainer.classList.add('hidden'); }

        const isCreatorOrAdmin = (savedRole === 'admin' || t.createdBy === rawUser || savedRole === 'teacher');
        document.getElementById('manageActionContainer').classList.toggle('hidden', !isCreatorOrAdmin);
        document.getElementById('detailModal').classList.remove('hidden');
    }

    document.getElementById('btnCloseDetailX').onclick = () => document.getElementById('detailModal').classList.add('hidden');
    document.getElementById('btnCloseDetailBtn').onclick = () => document.getElementById('detailModal').classList.add('hidden');

    document.getElementById('btnDeleteTask')?.addEventListener('click', async () => {
        if(confirm("⚠️ 確定要刪除此項目嗎？")) {
            await fetch(`/api/tasks?id=${currentTaskId}`, { method: 'DELETE' });
            document.getElementById('detailModal').classList.add('hidden');
            loadData();
        }
    });

    document.getElementById('btnEditTask')?.addEventListener('click', () => {
        const t = taskList.find(x => x.id === currentTaskId);
        if(!t) return;
        document.getElementById('inputTitle').value = t.title.replace(/^\[.*?\] /, ''); 
        document.getElementById('inputRemarks').value = t.remarks || '';
        document.getElementById('inputUrl').value = t.url || '';
        document.getElementById('inputType').value = t.type || 'homework';
        document.getElementById('inputSubject').value = (t.subject === '數學 (班主任)') ? '數學' : t.subject || '';
        document.getElementById('inputDate').value = t.date || '';
        
        editingTaskId = currentTaskId;
        const titleEl = document.getElementById('modalTitle');
        if(titleEl) titleEl.textContent = "✏️ 修改項目";
        
        document.getElementById('detailModal').classList.add('hidden');
        document.getElementById('addModal').classList.remove('hidden');
    });

    const openAddModal = () => {
        editingTaskId = null; 
        const titleEl = document.getElementById('modalTitle');
        if(titleEl) titleEl.textContent = "📝 發佈項目";
        document.getElementById('addTaskForm').reset();
        document.getElementById('addModal').classList.remove('hidden');
    };
    document.getElementById('btnOpenModal')?.addEventListener('click', openAddModal);
    document.getElementById('btnNavAdminAdd')?.addEventListener('click', openAddModal);
    document.getElementById('btnCloseModal').onclick = () => document.getElementById('addModal').classList.add('hidden');

    document.getElementById('addTaskForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSubmitTask');
        btn.textContent = "儲存中..."; 
        btn.disabled = true;

        let urlInput = document.getElementById('inputUrl').value.trim();
        if (urlInput && !/^https?:\/\//i.test(urlInput)) urlInput = 'https://' + urlInput;

        const title = document.getElementById('inputTitle').value;
        const type = document.getElementById('inputType').value;
        const importance = document.getElementById('inputImportance')?.value || '';
        const fullTitle = (type === 'test' && importance) ? `[${importance}] ${title}` : title;

        let evtColor = '#3B82F6'; // Default homework
        if (type === 'test') evtColor = '#EF4444';
        else if (type === 'notice') evtColor = '#F59E0B';
        else if (type === 'event') evtColor = '#10B981';

        const taskData = {
            id: editingTaskId || String(Date.now()),
            title: fullTitle, 
            date: document.getElementById('inputDate').value,
            type: type, 
            subject: document.getElementById('inputSubject').value,
            remarks: document.getElementById('inputRemarks').value,
            url: urlInput, 
            color: evtColor, 
            completed: 0, 
            createdBy: rawUser
        };

        const res = await fetch('/api/tasks', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(taskData) 
        });
        
        if (res.ok) {
            document.getElementById('addModal').classList.add('hidden');
            document.getElementById('addTaskForm').reset();
            loadData();
        } else {
            alert("❌ 儲存失敗！");
        }
        btn.textContent = "儲存"; 
        btn.disabled = false;
    });

    // --- 7. 管理員後台 ---
    function renderAdminAuditLog() {
        const ul = document.getElementById('adminAuditLog');
        if (!ul) return;
        ul.innerHTML = taskList.slice(0, 20).map(log => `
            <li class="border-b pb-3">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-gray-800">${log.title}</span>
                    <button class="bg-gray-100 px-2 py-1 rounded text-xs font-bold" onclick="document.dispatchEvent(new CustomEvent('openTaskDetail', {detail: '${log.id}'}))">查看</button>
                </div>
                <div class="text-xs text-gray-500 flex gap-2">
                    <span class="bg-blue-100 text-blue-700 px-1 rounded">${log.createdBy || '系統'}</span>
                    <span>${log.date}</span>
                </div>
            </li>`).join('');
    }
    document.addEventListener('openTaskDetail', (e) => openDetailModalById(e.detail));

    async function loadAdminUsers() {
        try {
            const res = await fetch('/api/admin/users');
            if (res.status === 403) return;
            
            const rawUsers = await res.json();
            adminUserList = rawUsers.sort((a, b) => (parseInt(a.username) || 0) - (parseInt(b.username) || 0));

            const select = document.getElementById('adminStudentSelect');
            if (select) {
                select.innerHTML = '<option value="">-- 請選擇要管理的學生 --</option>' + 
                    adminUserList.filter(u => u.role === 'student').map(u => `<option value="${u.username}">${u.username}</option>`).join('');
            }
        } catch (e) {}
    }

    const adminSelect = document.getElementById('adminStudentSelect');
    if (adminSelect) {
        adminSelect.addEventListener('change', (e) => {
            const target = e.target.value;
            const panel = document.getElementById('adminStudentPanel');
            if (!target) { panel?.classList.add('hidden'); panel?.classList.remove('flex'); return; }
            
            panel?.classList.remove('hidden');
            panel?.classList.add('flex');
            
            const uInfo = adminUserList.find(u => u.username === target);
            const statusEl = document.getElementById('adminStudentStatus');
            const btnBan = document.getElementById('btnAdminSuspend');
            
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

    document.getElementById('btnAdminSuspend1D')?.addEventListener('click', async () => {
        const u = adminSelect?.value;
        if (!u) return;
        if (confirm(`⚠️ 確定要停用 ${u} 1天嗎？`)) {
            const d = new Date(); d.setDate(d.getDate()+1);
            await fetch('/api/admin/user-status', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: u, bannedUntil: d.toISOString() }) });
            loadAdminUsers();
        }
    });

    document.getElementById('btnAdminSuspendPerm')?.addEventListener('click', async () => {
        const u = adminSelect?.value;
        if (!u) return;
        if (confirm(`⚠️ 確定要永久停用 ${u} 嗎？`)) {
            await fetch('/api/admin/user-status', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: u, bannedUntil: 'permanent' }) });
            loadAdminUsers();
        }
    });

    document.getElementById('btnAdminResetPwd')?.addEventListener('click', async () => {
        const u = adminSelect?.value;
        if (u && confirm(`確定重設 ${u} 的密碼為 12345678 嗎？`)) {
            await fetch('/api/admin/reset-password', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: u }) });
            alert("✅ 密碼已成功重置");
        }
    });

    // 啟動
    loadData();
});
