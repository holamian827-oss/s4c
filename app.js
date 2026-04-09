document.addEventListener('DOMContentLoaded', function() {
    const savedUser = localStorage.getItem('s4c_user');
    const savedRole = localStorage.getItem('s4c_role');
    if (!savedUser) { window.location.href = 'login.html'; return; }

    document.getElementById('navUserInfo').textContent = savedUser;
    const mainAppView = document.getElementById('mainAppView');
    const adminDashboardView = document.getElementById('adminDashboardView');

    // 權限控制
    if (savedRole === 'admin') document.getElementById('btnGoAdmin').classList.remove('hidden');
    if (savedRole === 'teacher' || savedRole === 'admin') document.getElementById('btnOpenModal').classList.remove('hidden');

    let taskList = [];
    let calendar;
    let currentTaskId = null;

    async function refreshData() {
        const res = await fetch('/api/tasks');
        taskList = await res.json();
        const events = taskList.map(t => ({ ...t, completed: t.completed === 1 }));
        
        if (!calendar && savedRole !== 'admin') {
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
        document.getElementById('loadingShield').classList.add('hidden');
    }

    function openDetail(id) {
        currentTaskId = id;
        const task = taskList.find(t => t.id === id);
        document.getElementById('detailTitle').textContent = task.title;
        document.getElementById('detailInfo').textContent = `${task.date} | ${task.subject || '通用'}`;
        document.getElementById('detailModal').classList.remove('hidden');
        document.getElementById('manageActionContainer').classList.toggle('hidden', !(savedRole === 'admin' || savedRole === 'teacher'));
    }

    // 刪除邏輯
    document.getElementById('btnDeleteTask').onclick = async () => {
        if (!confirm("確定刪除？")) return;
        await fetch(`/api/tasks?id=${currentTaskId}`, { method: 'DELETE' });
        location.reload();
    };

    // 編輯邏輯
    document.getElementById('btnEditTask').onclick = () => {
        const task = taskList.find(t => t.id === currentTaskId);
        document.getElementById('inputTitle').value = task.title;
        document.getElementById('inputDate').value = task.date;
        document.getElementById('addModal').classList.remove('hidden');
        document.getElementById('detailModal').classList.add('hidden');
    };

    // 儲存邏輯 (新增/修改)
    document.getElementById('addTaskForm').onsubmit = async (e) => {
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
        location.reload();
    };

    function renderAdminTable() {
        const tbody = document.getElementById('adminTaskTableBody');
        tbody.innerHTML = taskList.map(t => `
            <tr class="border-b">
                <td class="p-3">${t.date}</td><td class="p-3">${t.subject}</td><td class="p-3">${t.title}</td>
                <td class="p-3"><button onclick="deleteFromTable('${t.id}')" class="text-red-500">刪除</button></td>
            </tr>
        `).join('');
    }

    window.deleteFromTable = async (id) => {
        if(confirm("確定刪除此項目？")) {
            await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
            location.reload();
        }
    };

    document.getElementById('btnGoAdmin').onclick = () => { mainAppView.classList.add('hidden'); adminDashboardView.classList.remove('hidden'); };
    document.getElementById('btnBackToCalendar').onclick = () => { location.reload(); };
    document.getElementById('btnOpenModal').onclick = () => { currentTaskId = null; document.getElementById('addTaskForm').reset(); document.getElementById('addModal').classList.remove('hidden'); };

    refreshData();
});
