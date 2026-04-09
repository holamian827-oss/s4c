document.addEventListener('DOMContentLoaded', function() {
    const savedUser = localStorage.getItem('s4c_user');
    const savedRole = localStorage.getItem('s4c_role');
    if (!savedUser) { window.location.href = 'login.html'; return; }

    document.getElementById('navUserInfo').textContent = savedUser;
    const mainAppView = document.getElementById('mainAppView');
    const adminDashboardView = document.getElementById('adminDashboardView');
    const addModal = document.getElementById('addModal');
    const addTaskForm = document.getElementById('addTaskForm');

    // 權限控制
    if (savedRole === 'admin') {
        document.getElementById('btnGoAdmin')?.classList.remove('hidden');
        document.getElementById('btnNavAdminAdd')?.classList.remove('hidden');
    } else if (savedRole === 'teacher') {
        document.getElementById('btnOpenModal')?.classList.remove('hidden');
    }

    let taskList = [];
    let calendar;
    let currentTaskId = null;

    // --- 同步數據 ---
    async function refreshData() {
        try {
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
            // 重要：管理員登入後立刻渲染表格
            if (savedRole === 'admin') {
                renderAdminTaskTable();
                renderUserManagement();
            }
            document.getElementById('loadingShield')?.classList.add('hidden');
        } catch (e) { console.error(e); }
    }

    // --- 管理員：渲染表格 ---
    function renderAdminTaskTable() {
        const tbody = document.getElementById('adminTaskTableBody');
        if(!tbody) return;
        tbody.innerHTML = taskList.map(t => `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-3 text-xs">${t.date}</td>
                <td class="p-3">${t.title}</td>
                <td class="p-3 text-center">
                    <button onclick="editFromAdmin('${t.id}')" class="text-blue-600 mr-2 text-xs font-bold">編輯</button>
                    <button onclick="deleteFromAdmin('${t.id}')" class="text-red-600 text-xs font-bold">刪除</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="3" class="p-4 text-center text-gray-400">暫無項目</td></tr>';
    }

    // --- 管理員：封禁功能 ---
    window.banUser = async (targetUser, duration) => {
        let bannedUntil = "";
        const now = new Date();
        if (duration === '1d') {
            now.setDate(now.getDate() + 1);
            bannedUntil = now.toISOString();
        } else if (duration === 'perm') {
            bannedUntil = "permanent";
        }

        const res = await fetch('/api/admin/user-status', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username: targetUser, bannedUntil })
        });
        if ((await res.json()).success) alert(`已設置 ${targetUser} 的封禁狀態`);
    };

    function renderUserManagement() {
        const container = document.getElementById('userListContainer');
        if(!container) return;
        // 這裡列出 15, 22, 33 號作為演示，你可以根據 init.js 修改
        const demoUsers = ["15_同學", "22_同學", "33_同學"];
        container.innerHTML = demoUsers.map(u => `
            <div class="flex items-center justify-between p-2 bg-gray-50 rounded border">
                <span class="text-sm font-bold">${u}</span>
                <div class="flex gap-1">
                    <button onclick="banUser('${u}', '1d')" class="bg-orange-500 text-white text-[10px] px-2 py-1 rounded">1天</button>
                    <button onclick="banUser('${u}', 'perm')" class="bg-red-600 text-white text-[10px] px-2 py-1 rounded">永久</button>
                    <button onclick="banUser('${u}', '')" class="bg-green-600 text-white text-[10px] px-2 py-1 rounded">解封</button>
                </div>
            </div>
        `).join('');
    }

    // --- 修改密碼功能 ---
    window.handleChangePassword = async () => {
        const oldP = prompt("舊密碼:");
        const newP = prompt("新密碼 (至少6位):");
        if(!oldP || !newP || newP.length < 6) return alert("密碼太短");
        const res = await fetch('/api/change-password', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username: savedUser, oldPassword: oldP, newPassword: newP })
        });
        if((await res.json()).success) { alert("修改成功！請重新登入"); localStorage.clear(); location.reload(); }
        else { alert("修改失敗，可能是舊密碼錯誤"); }
    };

    // --- 彈窗按鈕綁定 ---
    const openAdd = () => { currentTaskId = null; addTaskForm.reset(); addModal.classList.remove('hidden'); };
    document.getElementById('btnOpenModal')?.addEventListener('click', openAdd);
    document.getElementById('btnNavAdminAdd')?.addEventListener('click', openAdd);
    document.getElementById('btnAdminListAdd')?.addEventListener('click', openAdd);

    addTaskForm.onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            id: currentTaskId || String(Date.now()),
            title: document.getElementById('inputTitle').value,
            date: document.getElementById('inputDate').value,
            type: document.getElementById('inputType').value,
            subject: document.getElementById('inputSubject').value,
            createdBy: savedUser, completed: 0
        };
        await fetch('/api/tasks', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data) 
        });
        location.reload();
    };

    window.editFromAdmin = (id) => {
        currentTaskId = id;
        const t = taskList.find(x => x.id === id);
        document.getElementById('inputTitle').value = t.title;
        document.getElementById('inputDate').value = t.date;
        addModal.classList.remove('hidden');
    };

    window.deleteFromAdmin = async (id) => {
        if(confirm("確定刪除？")) {
            await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
            refreshData();
        }
    };

    document.getElementById('btnGoAdmin')?.addEventListener('click', () => {
        mainAppView.classList.add('hidden');
        adminDashboardView.classList.remove('hidden');
    });
    document.getElementById('btnBackToCalendar')?.addEventListener('click', () => location.reload());
    document.getElementById('btnSysMenu')?.addEventListener('click', () => document.getElementById('sysMenuModal').classList.remove('hidden'));
    document.getElementById('btnCloseSysMenu')?.addEventListener('click', () => document.getElementById('sysMenuModal').classList.add('hidden'));

    refreshData();
});
