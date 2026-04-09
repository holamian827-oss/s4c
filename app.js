document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 S4C 系統啟動...");
    const savedUser = localStorage.getItem('s4c_user');
    const savedRole = localStorage.getItem('s4c_role');
    if (!savedUser) { window.location.href = 'login.html'; return; }

    document.getElementById('navUserInfo').textContent = `👤 ${savedUser}`;
    
    // --- 權限 UI 控制 ---
    const btnGoAdmin = document.getElementById('btnGoAdmin');
    const btnNavAdd = document.getElementById('btnNavAdd');
    const btnOpenModal = document.getElementById('btnOpenModal');

    if (savedRole === 'admin') {
        btnGoAdmin?.classList.remove('hidden');
        btnNavAdd?.classList.remove('hidden');
    } else if (savedRole === 'teacher') {
        btnOpenModal?.classList.remove('hidden');
    }

    let taskList = [];
    let calendar;
    let currentTaskId = null;

    // --- 同步 D1 數據 ---
    async function refreshData() {
        try {
            const res = await fetch('/api/tasks');
            if (!res.ok) throw new Error("API 請求失敗");
            taskList = await res.json();
            
            const events = taskList.map(t => ({
                id: t.id, title: t.title, start: t.date, color: t.type === 'test' ? '#ef4444' : '#3b82f6'
            }));

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

            if (savedRole === 'admin') {
                renderAdminTable();
                renderUserList();
            }
            document.getElementById('loadingShield')?.classList.add('hidden');
        } catch (e) {
            console.error("❌ 數據庫同步失敗:", e);
            document.getElementById('loadingShield').textContent = "⚠️ 連線失敗，請檢查網絡";
        }
    }

    // --- 渲染管理員表格 ---
    function renderAdminTable() {
        const tbody = document.getElementById('adminTaskTableBody');
        if (!tbody) return;
        tbody.innerHTML = taskList.map(t => `
            <tr class="hover:bg-gray-50 transition">
                <td class="py-4 text-xs font-medium text-gray-400">${t.date}</td>
                <td class="py-4 font-bold text-gray-700">
                    ${t.title} ${t.url ? `<a href="${t.url}" target="_blank" class="text-blue-500 ml-1">🔗</a>` : ''}
                </td>
                <td class="py-4 text-center">
                    <button onclick="editFromAdmin('${t.id}')" class="text-blue-600 font-bold mr-3">編輯</button>
                    <button onclick="deleteFromAdmin('${t.id}')" class="text-red-500 font-bold">刪除</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="3" class="py-10 text-center text-gray-400 italic">目前數據庫中沒有任何項目。</td></tr>';
    }

    // --- 彈窗開關 ---
    const openAdd = () => {
        currentTaskId = null;
        document.getElementById('addTaskForm').reset();
        document.getElementById('modalTitle').textContent = "發佈新項目";
        document.getElementById('addModal').classList.remove('hidden');
    };

    // 綁定所有可能的新增按鈕
    [btnOpenModal, btnNavAdd, document.getElementById('btnAdminAdd')].forEach(b => {
        b?.addEventListener('click', openAdd);
    });

    document.getElementById('btnCancelAdd').onclick = () => document.getElementById('addModal').classList.add('hidden');

    // --- 儲存項目 (修復重點：加入 Headers) ---
    document.getElementById('addTaskForm').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            id: currentTaskId || String(Date.now()),
            title: document.getElementById('inputTitle').value,
            date: document.getElementById('inputDate').value,
            type: document.getElementById('inputType').value,
            url: document.getElementById('inputUrl').value,
            remarks: document.getElementById('inputRemarks').value,
            createdBy: savedUser, completed: 0
        };

        const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            document.getElementById('addModal').classList.add('hidden');
            location.reload();
        }
    };

    // --- 詳情與刪除 ---
    function openDetail(id) {
        currentTaskId = id;
        const t = taskList.find(x => x.id === id);
        document.getElementById('detailTitle').textContent = t.title;
        document.getElementById('detailContent').innerHTML = `
            <p>📅 <b>日期：</b>${t.date}</p>
            <p>📝 <b>備注：</b>${t.remarks || '無'}</p>
            ${t.url ? `<p>🔗 <b>連結：</b><a href="${t.url}" target="_blank" class="text-blue-600 underline">${t.url}</a></p>` : ''}
        `;
        document.getElementById('detailModal').classList.remove('hidden');
        document.getElementById('manageActionContainer').classList.toggle('hidden', !(savedRole === 'admin' || savedRole === 'teacher'));
    }

    // 點擊事件綁定
    document.getElementById('btnDeleteTask').onclick = async () => {
        if (confirm("確定刪除此項目？")) {
            await fetch(`/api/tasks?id=${currentTaskId}`, { method: 'DELETE' });
            location.reload();
        }
    };

    document.getElementById('btnEditTask').onclick = () => {
        const t = taskList.find(x => x.id === currentTaskId);
        document.getElementById('inputTitle').value = t.title;
        document.getElementById('inputDate').value = t.date;
        document.getElementById('inputUrl').value = t.url || '';
        document.getElementById('inputRemarks').value = t.remarks || '';
        document.getElementById('modalTitle').textContent = "✏️ 編輯項目";
        document.getElementById('addModal').classList.remove('hidden');
        document.getElementById('detailModal').classList.add('hidden');
    };

    // 管理員專屬函數
    window.editFromAdmin = (id) => openDetail(id);
    window.deleteFromAdmin = async (id) => {
        if (confirm("管理員確定刪除？")) {
            await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
            refreshData();
        }
    };

    // 菜單與密碼
    document.getElementById('btnSysMenu').onclick = () => document.getElementById('sysMenuModal').classList.remove('hidden');
    document.getElementById('btnCloseSysMenu').onclick = () => document.getElementById('sysMenuModal').classList.add('hidden');
    document.getElementById('btnChangePwd').onclick = async () => {
        const oldP = prompt("舊密碼:");
        const newP = prompt("新密碼(6位以上):");
        if (!oldP || !newP || newP.length < 6) return alert("輸入不合法");
        const res = await fetch('/api/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: savedUser, oldPassword: oldP, newPassword: newP })
        });
        if ((await res.json()).success) { alert("成功！請重新登入"); location.reload(); }
    };

    document.getElementById('btnGoAdmin').onclick = () => {
        document.getElementById('mainAppView').classList.add('hidden');
        document.getElementById('adminDashboardView').classList.remove('hidden');
    };
    document.getElementById('btnBackToCalendar').onclick = () => location.reload();
    document.getElementById('btnCloseDetail').onclick = () => document.getElementById('detailModal').classList.add('hidden');

    function renderUserList() {
        const container = document.getElementById('userListContainer');
        if(!container) return;
        const users = ["15_同學", "22_同學", "33_同學"];
        container.innerHTML = users.map(u => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span class="font-bold text-gray-700">${u}</span>
                <div class="flex gap-1">
                    <button onclick="ban('${u}', '1d')" class="bg-orange-100 text-orange-600 text-xs px-3 py-1 rounded-lg font-bold">封1天</button>
                    <button onclick="ban('${u}', 'perm')" class="bg-red-100 text-red-600 text-xs px-3 py-1 rounded-lg font-bold">永久</button>
                    <button onclick="ban('${u}', '')" class="bg-green-100 text-green-600 text-xs px-3 py-1 rounded-lg font-bold">解</button>
                </div>
            </div>
        `).join('');
    }

    refreshData();
});
