const USER = { name: localStorage.getItem('s4c_user'), role: localStorage.getItem('s4c_role') };
let taskList = [];
let calendar = null;
let currentTaskId = null;
let editingTaskId = null;
let adminUserList = [];

document.addEventListener('DOMContentLoaded', function() {
    
    const rawUser = localStorage.getItem('s4c_user');
    const savedRole = localStorage.getItem('s4c_role');
    const savedUser = (savedRole === 'admin') ? '系統管理員' : rawUser;

    if (!savedUser || !savedRole || savedUser === '未登入') {
        window.location.href = 'login.html';
        return; 
    }

    document.getElementById('navUserInfo').textContent = `${savedUser}`;
    document.getElementById('loadingShield').classList.add('hidden');

    const mainAppView = document.getElementById('mainAppView');
    const adminDashboardView = document.getElementById('adminDashboardView');
    const btnNavAdminAdd = document.getElementById('btnNavAdminAdd');
    const btnOpenModal = document.getElementById('btnOpenModal');

    if (savedRole === 'admin') {
        adminDashboardView.classList.remove('hidden');
        btnNavAdminAdd.classList.remove('hidden');
    } else {
        mainAppView.classList.remove('hidden');
        if (savedRole === 'teacher') btnOpenModal.classList.remove('hidden');
    }

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

    const feedbackModal = document.getElementById('feedbackModal');
    const feedbackType = document.getElementById('feedbackType');
    const feedbackImageContainer = document.getElementById('feedbackImageContainer');

    document.getElementById('btnFeedback')?.addEventListener('click', () => feedbackModal.classList.remove('hidden'));
    document.getElementById('btnCloseFeedback')?.addEventListener('click', () => feedbackModal.classList.add('hidden'));
    
    if(feedbackType) {
        feedbackType.addEventListener('change', () => {
            feedbackImageContainer.classList.toggle('hidden', feedbackType.value !== 'bug反饋');
        });
    }

    document.getElementById('feedbackForm')?.addEventListener('submit', (e) => { 
        e.preventDefault(); 
        alert("✅ 反饋已提交！管理員將會盡快跟進。"); 
        feedbackModal.classList.add('hidden'); 
        document.getElementById('feedbackForm').reset();
    });

    async function loadData() {
        try {
            const res = await fetch('/api/tasks');
            taskList = await res.json();
            
            if (savedRole !== 'admin') {
                renderCalendar(taskList);
            } else {
                renderAdminAuditLog();
                loadAdminUsers();
                renderLoginLogs();
            }
            document.getElementById('loadingShield').classList.add('hidden');
        } catch (e) {
            console.error(e);
            document.getElementById('loadingShield').innerHTML = '<p class="text-red-500 font-bold">⚠️ 數據載入失敗，請檢查網絡連線</p>';
        }
    }

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

    document.getElementById('applyFilter')?.addEventListener('click', () => {
        if (!calendar) return;
        const selectedType = document.getElementById('filterType').value;
        const selectedSubject = document.getElementById('filterSubject').value;
        const filteredTasks = taskList.filter(task => {
            return (selectedType === 'all' || task.type === selectedType) && (selectedSubject === 'all' || task.subject === selectedSubject);
        });
        renderCalendar(filteredTasks);
    });

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
            urlContainer.classList.remove('hidden'); document.getElementById('detailUrl').href = task.url; 
        } else { 
            urlContainer.classList.add('hidden'); 
        }

        const isCreatorOrAdmin = (savedRole === 'admin' || task.createdBy === rawUser || savedRole === 'teacher');
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
        const task = taskList.find(t => t.id === currentTaskId);
        if(!task) return;
        document.getElementById('inputTitle').value = task.title.replace(/^\[.*?\] /, ''); 
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

        const title = document.getElementById('inputTitle').value;
        const type = document.getElementById('inputType').value;
        const importance = document.getElementById('inputImportance')?.value || '';
        const fullTitle = (type === 'test' && importance) ? `[${importance}] ${title}` : title;

        const taskData = {
            id: editingTaskId || String(Date.now()),
            title: fullTitle, date: document.getElementById('inputDate').value,
            type: type, subject: document.getElementById('inputSubject').value,
            remarks: document.getElementById('inputRemarks').value, url: urlInput, 
            color: type === 'test' ? '#EF4444' : '#3B82F6', completed: 0, createdBy: rawUser
        };

        await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskData) });
        
        document.getElementById('addModal').classList.add('hidden');
        btn.textContent = "儲存"; btn.disabled = false;
        document.getElementById('addTaskForm').reset();
        loadData();
    });

    // --- 7. 全新設計的寬敞管理員面板 ---
    function renderLoginLogs() {
        const ul = document.getElementById('adminLoginLog');
        if (!ul) return;
        const mockLogins = [{ user: '22_同學', time: '剛剛' }, { user: '物理老師', time: '15 分鐘前' }];
        ul.innerHTML = mockLogins.map(l => `
            <li class="flex justify-between border-b pb-2">
                <span class="font-bold text-blue-600">${l.user}</span><span class="text-gray-400 text-xs">${l.time}</span>
            </li>`).join('');
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
            </li>`).join('');
    }
    
    document.addEventListener('openTaskDetail', (e) => openDetailModalById(e.detail));

    async function loadAdminUsers() {
        try {
            const res = await fetch('/api/admin/users');
            const rawUsers = await res.json();
            
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
        } catch(e) { console.error(e); }
    }

    // 專屬解封區 (小黑屋列表)
    function renderBannedList() {
        const ul = document.getElementById('adminBannedList');
        if (!ul) return;
        const bannedUsers = adminUserList.filter(u => u.banned_until);
        
        if (bannedUsers.length === 0) {
            ul.innerHTML = '<li class="text-gray-400 text-center py-6 bg-gray-50 rounded-lg border border-dashed">目前沒有被停用的帳號 🎉</li>';
            return;
        }
        
        ul.innerHTML = bannedUsers.map(u => {
            const isPerm = u.banned_until === 'permanent';
            const statusStr = isPerm ? '🛑 永久停用' : '⏳ 停用 1 天';
            return `
                <li class="flex justify-between items-center bg-white p-4 rounded-xl border border-red-100 shadow-sm mb-3">
                    <div>
                        <span class="font-bold text-gray-800 text-lg">${u.username}</span>
                        <div class="text-sm mt-1 text-red-500 font-medium">${statusStr}</div>
                    </div>
                    <button class="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm transition" 
                        onclick="document.dispatchEvent(new CustomEvent('quickUnban', {detail: '${u.username}'}))">
                        ✅ 解除停用
                    </button>
                </li>`;
        }).join('');
    }

    // 下拉選單與兩顆按鈕的聯動
    const adminSelect = document.getElementById('adminStudentSelect');
    if(adminSelect) {
        adminSelect.addEventListener('change', (e) => {
            const targetUser = e.target.value;
            const panel = document.getElementById('adminStudentPanel');
            
            if(!targetUser) { 
                panel?.classList.add('hidden'); 
                panel?.classList.remove('flex'); 
                return; 
            }
            
            const uInfo = adminUserList.find(u => u.username === targetUser);
            if(!uInfo) return;

            panel?.classList.remove('hidden'); 
            panel?.classList.add('flex');
            
            const nameEl = document.getElementById('adminSelectedStudentName');
            if(nameEl) nameEl.textContent = targetUser;
            
            const statusEl = document.getElementById('adminStudentStatus');
            const btnBan = document.getElementById('btnAdminSuspend');

            // 判斷狀態，如果已被封號，將封號按鈕反灰
            if(uInfo.banned_until) {
                if(statusEl) {
                    statusEl.textContent = uInfo.banned_until === 'permanent' ? '🛑 狀態：永久停用' : '⚠️ 狀態：停用中';
                    statusEl.className = 'px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-700';
                }
                if(btnBan) {
                    btnBan.disabled = true;
                    btnBan.className = "w-full bg-gray-300 text-gray-500 py-3 rounded-lg text-base font-bold cursor-not-allowed";
                    btnBan.textContent = "此帳號已停用 (請在下方列表解封)";
                }
            } else {
                if(statusEl) {
                    statusEl.textContent = '✅ 狀態：正常';
                    statusEl.className = 'px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-700';
                }
                if(btnBan) {
                    btnBan.disabled = false;
                    btnBan.className = "w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg text-base font-bold shadow-md transition";
                    btnBan.innerHTML = "🛑 停用此帳號";
                }
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

    // 將封號選項整合到單一按鈕，並利用 prompt 彈出選擇
    document.getElementById('btnAdminSuspend')?.addEventListener('click', () => {
        const u = adminSelect?.value;
        if(!u) return;
        
        const days = prompt(`⚠️ 你要停用 ${u} 多久？\n\n輸入 1 = 停用 1 天\n輸入 0 = 永久停用`, "1");
        if(days === null) return; // 按下取消
        
        if(days === "1") setBanStatus(u, '1d');
        else if(days === "0") setBanStatus(u, 'perm');
        else alert("❌ 無效的輸入！請輸入 1 或 0。");
    });

    // 專屬的小黑屋解封監聽
    document.addEventListener('quickUnban', (e) => {
        if(confirm(`確定要解除 ${e.detail} 的停用狀態嗎？`)) setBanStatus(e.detail, '');
    });

    // 重設密碼邏輯
    document.getElementById('btnAdminResetPwd')?.addEventListener('click', async () => {
        const targetUser = adminSelect?.value;
        if (!targetUser) return alert("請先選擇一位學生！");

        if (confirm(`⚠️ 確定要將 ${targetUser} 的密碼重設為預設密碼 (12345678) 嗎？`)) {
            try {
                const res = await fetch('/api/admin/reset-password', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: targetUser })
                });
                const data = await res.json();
                if (data.success) alert(`✅ 成功！${targetUser} 的密碼已恢復為 12345678`);
                else alert(`❌ 重設失敗：${data.message}`);
            } catch (e) { alert("❌ 連接伺服器失敗，請檢查網路"); }
        }
    });

    loadData();
});
