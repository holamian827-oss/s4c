document.addEventListener('DOMContentLoaded', function() {
    const savedUser = localStorage.getItem('s4c_user');
    const savedRole = localStorage.getItem('s4c_role');
    if (!savedUser) { window.location.href = 'login.html'; return; }

    document.getElementById('navUserInfo').textContent = savedUser;
    const mainAppView = document.getElementById('mainAppView');
    const adminDashboardView = document.getElementById('adminDashboardView');
    const addModal = document.getElementById('addModal');
    const addTaskForm = document.getElementById('addTaskForm');

    // 權限顯示
    if (savedRole === 'admin') {
        document.getElementById('btnGoAdmin')?.classList.remove('hidden');
        document.getElementById('btnNavAdminAdd')?.classList.remove('hidden');
    } else if (savedRole === 'teacher') {
        document.getElementById('btnOpenModal')?.classList.remove('hidden');
    }

    let taskList = [];
    let calendar;
    let currentTaskId = null;

    // --- 同步 D1 數據 ---
    async function refreshData() {
        const res = await fetch('/api/tasks');
        taskList = await res.json();
        const events = taskList.map(t => ({ ...t, completed: t.completed === 1 }));
        
        if (!calendar && document.getElementById('calendar') && savedRole !== 'admin') {
            calendar = new FullCalendar.Calendar(document.getElementById('calendar'), {
                initialView: 'dayGridMonth',
                events: events,
                eventClick: (info) => openDetail(info.event.id)
            });
            calendar.render();
        } else if (calendar) {
            calendar.removeAllEvents();
            calendar.addEventSource(events);
        }
        if (savedRole === 'admin') renderAdminTable();
        document.getElementById('loadingShield')?.classList.add('hidden');
    }

    // --- 打開新增彈窗 ---
    const openAddModal = () => {
        currentTaskId = null; 
        addTaskForm.reset();
        document.getElementById('modalTitle').textContent = "📝 新增項目";
        addModal.classList.remove('hidden');
    };

    document.getElementById('btnOpenModal')?.addEventListener('click', openAddModal);
    document.getElementById('btnNavAdminAdd')?.addEventListener('click', openAddModal);
    document.getElementById('btnAdminListAdd')?.addEventListener('click', openAddModal);

    // --- 雲端修改密碼 ---
    window.handleChangePassword = async function() {
        const oldPwd = prompt("請輸入您的舊密碼：");
        if (!oldPwd) return;
        const newPwd = prompt("請輸入新密碼 (至少 6 位)：");
        if (!newPwd || newPwd.length < 6) { alert("密碼太短！"); return; }

        const res = await fetch('/api/change-password', {
            method: 'POST',
            body: JSON.stringify({ username: savedUser, oldPassword: oldPwd, newPassword: newPwd })
        });
        const result = await res.json();
        if (result.success) {
            alert("✅ 密碼已在雲端數據庫修改成功！請重新登入。");
            localStorage.clear();
            window.location.href = 'login.html';
        } else {
            alert("❌ 修改失敗：" + result.message);
        }
    };

    // --- 提交作業項目 ---
    addTaskForm.onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            id: currentTaskId || String(Date.now()),
            title: document.getElementById('inputTitle').value,
            date: document.getElementById('inputDate').value,
            type: document.getElementById('inputType').value,
            subject: document.getElementById('inputSubject').value,
            remarks: document.getElementById('inputRemarks').value,
            createdBy: savedUser,
            completed: 0
        };
        await fetch('/api/tasks', { method: 'POST', body: JSON.stringify(data) });
        addModal.classList.add('hidden');
        refreshData();
    };

    function openDetail(id) {
        currentTaskId = id;
        const task = taskList.find(t => t.id === id);
        document.getElementById('detailTitle').textContent = task.title;
        document.getElementById('detailModal').classList.remove('hidden');
        document.getElementById('manageActionContainer')?.classList.toggle('hidden', !(savedRole === 'admin' || savedRole === 'teacher'));
    }

    document.getElementById('btnDeleteTask').onclick = async () => {
        if (!confirm("確定刪除？")) return;
        await fetch(`/api/tasks?id=${currentTaskId}`, { method: 'DELETE' });
        location.reload();
    };

    document.getElementById('btnEditTask').onclick = () => {
        const task = taskList.find(t => t.id === currentTaskId);
        document.getElementById('inputTitle').value = task.title;
        document.getElementById('inputDate').value = task.date;
        document.getElementById('modalTitle').textContent = "✏️ 編輯項目";
        addModal.classList.remove('hidden');
        document.getElementById('detailModal').classList.add('hidden');
    };

    function renderAdminTable() {
        const tbody = document.getElementById('adminTaskTableBody');
        if(!tbody) return;
        tbody.innerHTML = taskList.map(t => `
            <tr class="border-b">
                <td class="p-3">${t.date}</td><td class="p-3">${t.subject}</td><td class="p-3">${t.title}</td>
                <td class="p-3"><button onclick="deleteFromTable('${t.id}')" class="text-red-500 font-bold">刪除</button></td>
            </tr>
        `).join('');
    }

    window.deleteFromTable = async (id) => {
        if(confirm("確定刪除？")) {
            await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
            location.reload();
        }
    };

    document.getElementById('btnSysMenu').onclick = () => document.getElementById('sysMenuModal').classList.remove('hidden');
    document.getElementById('btnCloseSysMenu').onclick = () => document.getElementById('sysMenuModal').classList.add('hidden');
    document.getElementById('btnGoAdmin').onclick = () => { mainAppView.classList.add('hidden'); adminDashboardView.classList.remove('hidden'); };
    document.getElementById('btnBackToCalendar').onclick = () => { location.reload(); };

    refreshData();
});
