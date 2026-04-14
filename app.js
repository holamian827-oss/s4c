const USER = { name: localStorage.getItem('s4c_user'), role: localStorage.getItem('s4c_role') };
let taskList = [];
let calendar = null;
let currentTaskId = null;

window.onload = () => {
    if (!USER.name) { window.location.href = 'login.html'; return; }
    document.getElementById('navUserInfo').textContent = `👤 ${USER.name}`;
    setupUI();
    refreshData();
};

function setupUI() {
    if (USER.role === 'admin') {
        document.getElementById('btnGoAdmin')?.classList.remove('hidden');
        document.getElementById('btnNavAdd')?.classList.remove('hidden');
    } else if (USER.role === 'teacher') {
        document.getElementById('btnOpenModal')?.classList.remove('hidden');
    }
}

async function refreshData() {
    try {
        const res = await fetch('/api/tasks');
        if (res.status === 401 || res.status === 403) {
            window.location.href = 'login.html';
            return;
        }
        taskList = await res.json();
        renderCalendar(taskList);
        if (USER.role === 'admin') {
            renderAdminTable();
            renderUserList();
        }
        document.getElementById('loadingShield').classList.add('hidden');
    } catch (e) { console.error(e); }
}

function renderCalendar(data) {
    const el = document.getElementById('calendar');
    if (!el || USER.role === 'admin') return;
    
    // 💡 處理顏色邏輯：根據類型賦予不同顏色
    const events = data.map(t => ({ 
        id: t.id, 
        title: t.title, 
        start: t.date, 
        color: t.color || (t.type === 'test' ? '#ef4444' : t.type === 'notice' ? '#f59e0b' : t.type === 'event' ? '#10b981' : '#3b82f6'),
        extendedProps: t
    }));

    if (!calendar) {
        calendar = new FullCalendar.Calendar(el, { 
            // 💡 手機版自適應列表模式與頂部選單
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
            eventClick: (info) => openDetail(info.event.id) 
        });
        calendar.render();
    } else {
        calendar.removeAllEvents();
        calendar.addEventSource(events);
    }
}

// --- 彈窗功能 ---
window.openAddModal = (id = null) => {
    const modal = document.getElementById('addModal');
    const form = document.getElementById('addTaskForm');
    if (id) {
        currentTaskId = id;
        const t = taskList.find(x => x.id === id);
        document.getElementById('inputTitle').value = t.title;
        document.getElementById('inputDate').value = t.date;
        document.getElementById('inputType').value = t.type || 'homework';
        
        // 💡 舊數據兼容：如果以前存咗「數學 (班主任)」，編輯時自動幫佢轉返「數學」
        let editSubject = t.subject || 'none';
        if (editSubject === '數學 (班主任)') editSubject = '數學';
        document.getElementById('inputSubject').value = editSubject;

        document.getElementById('inputUrl').value = t.url || '';
        document.getElementById('inputRemarks').value = t.remarks || '';
        document.getElementById('modalTitle').textContent = "✏️ 編輯項目";
    } else {
        currentTaskId = null;
        form.reset();
        document.getElementById('modalTitle').textContent = "發佈新項目";
    }
    modal.classList.remove('hidden');
};

window.saveTask = async (e) => {
    e.preventDefault();
    
    // 💡 生成顏色
    const typeVal = document.getElementById('inputType').value;
    let colorVal = '#3b82f6';
    if (typeVal === 'test') colorVal = '#ef4444';
    if (typeVal === 'notice') colorVal = '#f59e0b';
    if (typeVal === 'event') colorVal = '#10b981';

    const data = {
        id: currentTaskId || String(Date.now()),
        title: document.getElementById('inputTitle').value,
        date: document.getElementById('inputDate').value,
        type: typeVal,
        subject: document.getElementById('inputSubject').value,
        url: document.getElementById('inputUrl').value,
        remarks: document.getElementById('inputRemarks').value,
        color: colorVal,
        createdBy: USER.name, completed: 0
    };
    
    await fetch('/api/tasks', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data) 
    });
    location.reload();
};

function openDetail(id) {
    currentTaskId = id;
    const t = taskList.find(x => x.id === id);
    document.getElementById('detailTitle').textContent = t.title;
    
    // 💡 介面顯示淨化邏輯：過濾掉 (班主任)
    let displaySubject = t.subject || '無';
    if (displaySubject === '數學 (班主任)') displaySubject = '數學';

    let displayType = '功課';
    if (t.type === 'test') displayType = '測驗';
    if (t.type === 'notice') displayType = '通告回條';
    if (t.type === 'event') displayType = '學校活動';

    document.getElementById('detailContent').innerHTML = `
        <p>📌 <b>類型：</b><span class="bg-gray-100 px-2 py-0.5 rounded text-sm">${displayType}</span></p>
        <p>📖 <b>科目：</b>${displaySubject}</p>
        <p>📅 <b>日期：</b>${t.date}</p>
        <p>📝 <b>備註：</b>${t.remarks || '無'}</p>
        ${t.url ? `<p>🔗 <b>連結：</b><a href="${t.url}" target="_blank" class="text-blue-600 font-bold underline break-all">點擊前往連結</a></p>` : ''}
    `;
    
    document.getElementById('manageActionContainer').classList.toggle('hidden', !(USER.role === 'admin' || USER.role === 'teacher' || t.createdBy === USER.name));
    document.getElementById('detailModal').classList.remove('hidden');
}

// --- 管理員專區 ---
function renderAdminTable() {
    const tbody = document.getElementById('adminTaskTableBody');
    if (!tbody) return;
    tbody.innerHTML = taskList.map(t => `
        <tr class="hover:bg-gray-50">
            <td class="py-4 text-xs font-medium text-gray-400">${t.date}</td>
            <td class="py-4 font-bold">${t.title} ${t.url ? '🔗' : ''}</td>
            <td class="py-4 text-center">
                <button onclick="openAddModal('${t.id}')" class="text-blue-600 font-bold mr-3">編輯</button>
                <button onclick="deleteTask('${t.id}')" class="text-red-500 font-bold">刪除</button>
            </td>
        </tr>
    `).join('');
}

async function renderUserList() {
    const res = await fetch('/api/admin/users');
    if (res.status === 403) return; // 權限不足
    const users = await res.json();
    document.getElementById('userListContainer').innerHTML = users.map(u => {
        if (u.username === USER.name || u.role !== 'student') return '';
        return `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl border">
            <span class="font-bold text-gray-700 text-sm">${u.username}</span>
            <div class="flex gap-1">
                <button onclick="setBan('${u.username}','1d')" class="bg-orange-100 text-orange-600 text-[10px] px-2 py-1 rounded font-bold hover:bg-orange-200">停1天</button>
                <button onclick="setBan('${u.username}','perm')" class="bg-red-100 text-red-600 text-[10px] px-2 py-1 rounded font-bold hover:bg-red-200">永久</button>
                <button onclick="setBan('${u.username}','')" class="bg-green-100 text-green-600 text-[10px] px-2 py-1 rounded font-bold hover:bg-green-200">解封</button>
            </div>
        </div>`;
    }).join('');
}

window.setBan = async (u, t) => {
    let until = "";
    if (t === '1d') { const d = new Date(); d.setDate(d.getDate()+1); until = d.toISOString(); }
    else if (t === 'perm') until = 'permanent';
    await fetch('/api/admin/user-status', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username:u, bannedUntil:until}) });
    alert("封禁狀態更新成功");
    renderUserList();
};

window.deleteTask = async (id) => {
    if (confirm("確定刪除？此操作不可復原。")) {
        await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
        location.reload();
    }
};

window.changeMyPassword = async () => {
    const oldP = prompt("請輸入舊密碼:");
    const newP = prompt("請輸入新密碼 (至少6位):");
    if (!oldP || !newP || newP.length < 6) return alert("無效密碼或長度太短！");
    const res = await fetch('/api/change-password', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username:USER.name, oldPassword:oldP, newPassword:newP}) });
    if ((await res.json()).success) { 
        alert("✅ 修改成功！請重新登入"); 
        localStorage.clear(); 
        location.reload(); 
    } else { 
        alert("❌ 舊密碼不正確！"); 
    }
};

window.toggleAdminView = (show) => {
    document.getElementById('mainAppView').classList.toggle('hidden', show);
    document.getElementById('adminDashboardView').classList.toggle('hidden', !show);
};

window.editFromDetail = () => { document.getElementById('detailModal').classList.add('hidden'); openAddModal(currentTaskId); };
window.deleteFromDetail = () => deleteTask(currentTaskId);
