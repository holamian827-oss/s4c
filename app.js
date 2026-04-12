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
    
    // 將 Admin 顯示為「系統管理員」
    const displayUser = (savedRole === 'admin') ? '系統管理員' : rawUser;
    
    if (!rawUser || !savedRole || rawUser === '未登入') {
        window.location.href = 'login.html';
        return; 
    }

    const navUserInfo = document.getElementById('navUserInfo');
    if (navUserInfo) navUserInfo.textContent = displayUser;
    
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

    // --- 4. 💡 意見反饋 / 📥 查看意見 (根據身分切換) ---
    const btnFeedback = document.getElementById('btnFeedback');
    const feedbackModal = document.getElementById('feedbackModal');
    const viewFeedbackModal = document.getElementById('viewFeedbackModal');
    const feedbackType = document.getElementById('feedbackType');
    const feedbackImageContainer = document.getElementById('feedbackImageContainer');
    const feedbackForm = document.getElementById('feedbackForm');

    if (btnFeedback) {
        if (savedRole === 'admin') {
            // 管理員：變成「查看意見」
            btnFeedback.innerHTML = '📥 查看意見';
            btnFeedback.addEventListener('click', () => viewFeedbackModal?.classList.remove('hidden'));
        } else {
            // 學生/老師：彈出填寫表單
            btnFeedback.addEventListener('click', () => feedbackModal?.classList.remove('hidden'));
        }
    }

    // 關閉表單按鈕
    document.getElementById('btnCloseFeedback')?.addEventListener('click', () => feedbackModal?.classList.add('hidden'));
    document.getElementById('btnCloseViewFeedback')?.addEventListener('click', () => viewFeedbackModal?.classList.add('hidden'));
    document.getElementById('btnCloseViewFeedbackBtn')?.addEventListener('click', () => viewFeedbackModal?.classList.add('hidden'));

    // 反饋類型切換 (Bug 顯示上傳圖片)
    if (feedbackType) {
        feedbackType.addEventListener('change', () => {
            feedbackImageContainer?.classList.toggle('hidden', feedbackType.value !== 'bug反饋');
        });
    }

    // 提交反饋表單
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // 預留對接 Backend API
            alert("✅ 反饋已提交！管理員將會盡快跟進。");
            feedbackModal?.classList.add('hidden');
            feedbackForm.reset();
            feedbackImageContainer?.classList.add('hidden');
        });
    }

    // --- 5. 數據加載邏輯 ---
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

    // --- 6. 日曆與列表模式 ---
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
                // 手機預設列表，電腦預設日曆
                initialView: window.innerWidth < 768 ? 'listMonth' : 'dayGridMonth',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,listMonth'
                },
                buttonText: {
                    month: '日曆模式',
                    listMonth: '列表模式',
                    today: '今天'
                },
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
        const type = document.getElementById('filterType').value;
        const subject = document.getElementById('filterSubject').value;
        const filteredTasks = taskList.filter(task => {
            return (type === 'all' || task.type === type) && (subject === 'all' || task.subject === subject);
        });
        renderCalendar(filteredTasks);
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

        const isAuthorized = (savedRole === 'admin' || savedRole === 'teacher' || t.createdBy === rawUser);
        document.getElementById('manageActionContainer')?.classList.toggle('hidden', !isAuthorized);
        document.getElementById('detailModal')?.classList.remove('hidden');
    }

    document.getElementById('btnCloseDetailBtn')?.addEventListener('click', () => document.getElementById('detailModal')?.classList.add('hidden'));
    document.getElementById('btnCloseDetailX')?.addEventListener('click', () => document.getElementById('detailModal')?.classList.add('hidden'));

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

    const openAddModal = () => {
        editingTaskId = null; 
        const titleEl = document.getElementById('modalTitle');
        if(titleEl) titleEl.textContent = "📝 發佈項目";
        document.getElementById('addTaskForm')?.reset();
        document.getElementById('addModal')?.classList.remove('hidden');
    };
    
    document.getElementById('btnOpenModal')?.addEventListener('click', openAddModal);
    document.getElementById('btnNavAdminAdd')?.addEventListener('click', openAddModal);
    document.getElementById('btnCloseModal')?.addEventListener('click', () => document.getElementById('addModal')?.classList.add('hidden'));

    document.getElementById('btnEditTask')?.addEventListener('click', () => {
        const t = taskList.find(x => x.id === currentTaskId);
        if (!t) return;
        
        document.getElementById('inputTitle').value = t.title.replace(/^\[.*?\] /, ''); 
        document.getElementById('inputRemarks').value = t.remarks || '';
        document.getElementById('inputUrl').value = t.url || '';
        document.getElementById('inputType').value = t.type || 'homework';
        document.getElementById('inputSubject').value = t.subject || '';
        document.getElementById('inputDate').value = t.date || '';
        
        editingTaskId = currentTaskId;
        const titleEl = document.getElementById('modalTitle');
        if(titleEl) titleEl.textContent = "✏️ 修改項目";
        
        document.getElementById('detailModal')?.classList.add('hidden');
        document.getElementById('addModal')?.classList.remove('hidden');
    });

    document.getElementById('addTaskForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSubmitTask');
        btn.disabled = true;

        let urlInput = document.getElementById('inputUrl').value.trim();
        if (urlInput && !/^https?:\/\//i.test(urlInput)) urlInput = 'https://' + urlInput;

        const data = {
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

        const res = await fetch('/api/tasks', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(data) 
        });

        if (res.ok) {
            document.getElementById('addModal').classList.add('hidden');
            loadData();
        } else {
            alert("❌ 儲存失敗！");
        }
        btn.disabled = false;
    });

    // --- 8. 管理員專區：真實日誌與用戶管理 ---
    function renderLoginLogs() {
        const ul = document.getElementById('adminLoginLog');
        if (!ul) return;
        ul.innerHTML = '';

        let active = adminUserList.filter(u => u.last_login).sort((a, b) => new Date(b.last_login) - new Date(a.last_login));
        const now = new Date().getTime();
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
            renderLoginLogs();
            renderBannedList();
        } catch (e) {}
    }

    const adminSelect = document.getElementById('adminStudentSelect');
    if (adminSelect) {
        adminSelect.addEventListener('change', (e) => {
            const target = e.target.value;
            const panel = document.getElementById('adminStudentPanel');
            if (!target) { panel?.classList.add('hidden'); return; }
            
            panel?.classList.remove('hidden');
            panel?.classList.add('flex');
            
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
                method: 'POST', headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ username: u, bannedUntil: until }) 
            });
            loadAdminUsers();
            adminSelect.value = '';
            adminSelect.dispatchEvent(new Event('change'));
        }
    });

    document.getElementById('btnAdminResetPwd')?.addEventListener('click', async () => {
        const u = adminSelect?.value;
        if (u && confirm(`確定重設 ${u} 的密碼為 12345678 嗎？`)) {
            await fetch('/api/admin/reset-password', { 
                method: 'POST', headers: {'Content-Type':'application/json'}, 
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
            method: 'POST', headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({ username: e.detail, bannedUntil: '' }) 
        });
        loadAdminUsers();
        adminSelect.value = '';
        adminSelect.dispatchEvent(new Event('change'));
    });

    // 啟動程序
    loadData();
});
