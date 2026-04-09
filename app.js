document.addEventListener('DOMContentLoaded', function() {
    // 1. 【身分檢查】
    const savedUser = localStorage.getItem('s4c_user');
    const savedRole = localStorage.getItem('s4c_role');

    if (!savedUser || !savedRole) {
        window.location.href = 'login.html';
        return; 
    }

    document.getElementById('navUserInfo').textContent = savedUser;
    document.getElementById('loadingShield')?.classList.add('hidden');

    // 🔒 權限與視圖控制
    const btnOpenModal = document.getElementById('btnOpenModal');
    const btnNavAdminAdd = document.getElementById('btnNavAdminAdd');
    const btnGoAdmin = document.getElementById('btnGoAdmin');
    const mainAppView = document.getElementById('mainAppView');
    const adminDashboardView = document.getElementById('adminDashboardView');
    
    if (savedRole === 'admin') {
        btnGoAdmin?.classList.remove('hidden');
        btnNavAdminAdd?.classList.remove('hidden');
    } else if (savedRole === 'teacher') {
        btnOpenModal?.classList.remove('hidden');
    }

    // --- 頁面跳轉 ---
    btnGoAdmin?.addEventListener('click', () => {
        mainAppView.classList.add('hidden');
        adminDashboardView.classList.remove('hidden');
        renderAdminTaskTable();
    });

    document.getElementById('btnBackToCalendar')?.addEventListener('click', () => {
        adminDashboardView.classList.add('hidden');
        mainAppView.classList.remove('hidden');
        calendar.render();
    });

    // ---------------------------------------------------------
    // 數據持久化邏輯 (使用 LocalStorage 代替 D1)
    // ---------------------------------------------------------
    let taskList = JSON.parse(localStorage.getItem('s4c_tasks')) || [
        { id: '1', title: '物理大測', date: '2026-04-10', type: 'test', subject: '物理', color: '#EF4444', remarks: '第一至三章', completed: false, createdBy: '物理老師' }
    ];

    function saveToLocal() {
        localStorage.setItem('s4c_tasks', JSON.stringify(taskList));
    }

    let calendar;
    const calendarEl = document.getElementById('calendar');

    function initCalendar() {
        if (!calendarEl || savedRole === 'admin') return;
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
            events: taskList,
            eventClick: (info) => openDetailModalById(info.event.id),
            eventClassNames: (arg) => arg.event.extendedProps.completed ? ['task-completed'] : []
        });
        calendar.render();
    }
    initCalendar();

    // --- 新增 / 修改邏輯 ---
    const addTaskForm = document.getElementById('addTaskForm');
    let editingTaskId = null;

    addTaskForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const taskData = {
            id: editingTaskId || String(Date.now()),
            title: document.getElementById('inputTitle').value,
            date: document.getElementById('inputDate').value,
            type: document.getElementById('inputType').value,
            subject: document.getElementById('inputSubject').value,
            remarks: document.getElementById('inputRemarks').value,
            url: document.getElementById('inputUrl').value,
            color: document.getElementById('inputType').value === 'test' ? '#EF4444' : '#3B82F6',
            completed: false,
            createdBy: savedUser
        };

        if (editingTaskId) {
            const index = taskList.findIndex(t => t.id === editingTaskId);
            taskList[index] = taskData;
        } else {
            taskList.push(taskData);
        }

        saveToLocal();
        alert("✅ 已儲存！");
        window.location.reload(); 
    });

    // --- 刪除邏輯 ---
    window.deleteTaskFromAdmin = function(id) {
        if (confirm("⚠️ 確定要刪除嗎？")) {
            taskList = taskList.filter(t => t.id !== id);
            saveToLocal();
            renderAdminTaskTable();
            if(calendar) window.location.reload();
        }
    };

    // --- 管理員表格渲染 ---
    function renderAdminTaskTable() {
        const tbody = document.getElementById('adminTaskTableBody');
        if (!tbody) return;
        tbody.innerHTML = taskList.map(task => `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-3">${task.date}</td>
                <td class="p-3">${task.type}</td>
                <td class="p-3">${task.subject}</td>
                <td class="p-3 font-semibold">${task.title}</td>
                <td class="p-3 text-center">
                    <button class="text-red-600 font-bold" onclick="deleteTaskFromAdmin('${task.id}')">刪除</button>
                </td>
            </tr>
        `).join('');
    }

    // 登出
    document.querySelector('a[href="login.html"]')?.addEventListener('click', () => localStorage.clear());
});
