document.addEventListener('DOMContentLoaded', function() {
    
    // 1. 【身分檢查站】
    const savedUser = localStorage.getItem('s4c_user');
    const savedRole = localStorage.getItem('s4c_role');
    const savedToken = localStorage.getItem('s4c_token');

    if (!savedUser || !savedRole || !savedToken) {
        window.location.href = 'login.html';
        return; 
    }

    const navUserInfoEl = document.getElementById('navUserInfo');
    if (navUserInfoEl) navUserInfoEl.textContent = savedUser;
    
    document.getElementById('loadingShield')?.classList.add('hidden');

    // 🔒 權限與視圖控制
    const btnOpenModal = document.getElementById('btnOpenModal');
    const btnNavAdminAdd = document.getElementById('btnNavAdminAdd');
    const btnGoAdmin = document.getElementById('btnGoAdmin');
    const mainAppView = document.getElementById('mainAppView');
    const adminDashboardView = document.getElementById('adminDashboardView');
    
    mainAppView?.classList.remove('hidden');
    adminDashboardView?.classList.add('hidden');

    if (savedRole === 'admin') {
        btnGoAdmin?.classList.remove('hidden');
        btnNavAdminAdd?.classList.remove('hidden');
    } else if (savedRole === 'teacher') {
        btnOpenModal?.classList.remove('hidden');
    }

    // 管理員頁面跳轉
    btnGoAdmin?.addEventListener('click', () => {
        mainAppView.classList.add('hidden');
        adminDashboardView.classList.remove('hidden');
        renderAdminTaskTable(); 
    });

    document.getElementById('btnBackToCalendar')?.addEventListener('click', () => {
        adminDashboardView.classList.add('hidden');
        mainAppView.classList.remove('hidden');
        if(calendar) calendar.render();
    });

    // 管理員後台 Tab 切換
    const adminTabBtns = document.querySelectorAll('.admin-tab-btn');
    const adminTabContents = document.querySelectorAll('.admin-tab-content');

    adminTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            adminTabBtns.forEach(b => {
                b.classList.remove('bg-purple-600', 'text-white');
                b.classList.add('bg-white', 'text-gray-600');
            });
            btn.classList.remove('bg-white', 'text-gray-600');
            btn.classList.add('bg-purple-600', 'text-white');

            const targetId = btn.getAttribute('data-target');
            adminTabContents.forEach(content => {
                content.classList.toggle('hidden', content.id !== targetId);
            });
        });
    });

    // ≡ 系統菜單邏輯
    const sysMenuModal = document.getElementById('sysMenuModal');
    const sysTabBtns = document.querySelectorAll('.sys-tab-btn');
    const sysTabContents = document.querySelectorAll('.sys-tab-content');

    document.getElementById('btnSysMenu')?.addEventListener('click', () => sysMenuModal?.classList.remove('hidden'));
    document.getElementById('btnCloseSysMenu')?.addEventListener('click', () => sysMenuModal?.classList.add('hidden'));

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

    // 登出按鈕
    const logoutBtn = document.querySelector('a[href="login.html"]');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('s4c_user'); 
            localStorage.removeItem('s4c_role');
            localStorage.removeItem('s4c_token');
        });
    }

    // ---------------------------------------------------------
    // 真實數據庫與日曆邏輯
    // ---------------------------------------------------------
    let taskList = [];
    let currentSelectedTaskId = null; 
    let editingTaskId = null; 

    const calendarEl = document.getElementById('calendar');
    let calendar;

    async function loadTasks() {
        try {
            const res = await fetch('/api/tasks');
            const data = await res.json();
            
            taskList = data.map(t => ({ ...t, completed: t.completed === 1 }));

            if (savedRole !== 'admin' && calendarEl) {
                if (calendar) calendar.destroy();
                calendar = new FullCalendar.Calendar(calendarEl, {
                    initialView: 'dayGridMonth',
                    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
                    events: taskList,
                    eventClick: (info) => openDetailModalById(info.event.id),
                    eventClassNames: (arg) => arg.event.extendedProps.completed ? ['task-completed'] : []
                });
                calendar.render();
            }
            // 同時刷新管理員列表
            renderAdminTaskTable();
        } catch (e) {
            console.error("無法加載數據:", e);
        }
    }

    loadTasks();

    function openDetailModalById(id) {
        const task = taskList.find(t => t.id === id);
        if(!task) return;
        currentSelectedTaskId = id;

        const elTitle = document.getElementById('detailTitle');
        const elType = document.getElementById('detailType');
        const elSubject = document.getElementById('detailSubject');
        const elRemarks = document.getElementById('detailRemarks');
        if(elTitle) elTitle.textContent = task.title;
        if(elType) elType.textContent = task.type;
        if(elSubject) elSubject.textContent = task.subject || '無';
        if(elRemarks) elRemarks.textContent = task.remarks || '無';
        
        const urlContainer = document.getElementById('detailUrlContainer');
        const detailUrl = document.getElementById('detailUrl');
        if (task.url && urlContainer && detailUrl) { 
            urlContainer.classList.remove('hidden'); 
            detailUrl.href = task.url; 
        } else if (urlContainer) { 
            urlContainer.classList.add('hidden'); 
        }

        const isCreatorOrAdmin = (savedRole === 'admin' || task.createdBy === savedUser || savedRole === 'teacher');
        const manageContainer = document.getElementById('manageActionContainer');
        const studentContainer = document.getElementById('studentActionContainer');

        if (isCreatorOrAdmin) {
            manageContainer?.classList.remove('hidden');
            studentContainer?.classList.add('hidden'); 
        } else {
            manageContainer?.classList.add('hidden');
            studentContainer?.classList.remove('hidden');
        }

        document.getElementById('detailModal')?.classList.remove('hidden');
    }

    document.getElementById('btnCloseDetailX')?.addEventListener('click', () => document.getElementById('detailModal')?.classList.add('hidden'));
    document.getElementById('btnCloseDetailBtn')?.addEventListener('click', () => document.getElementById('detailModal')?.classList.add('hidden'));

    document.getElementById('btnEditTask')?.addEventListener('click', () => {
        const task = taskList.find(t => t.id === currentSelectedTaskId);
        if(!task) return;
        
        const inputTitle = document.getElementById('inputTitle');
        const inputRemarks = document.getElementById('inputRemarks');
        const inputUrl = document.getElementById('inputUrl');
        const inputType = document.getElementById('inputType');
        const inputSubject = document.getElementById('inputSubject');
        const inputDate = document.getElementById('inputDate');

        if(inputTitle) inputTitle.value = task.title.replace(/^\[.*?\] /, ''); 
        if(inputRemarks) inputRemarks.value = task.remarks || '';
        if(inputUrl) inputUrl.value = task.url || '';
        if(inputType) inputType.value = task.type;
        if(inputSubject) inputSubject.value = task.subject;
        if(inputDate) inputDate.value = task.date;
        
        editingTaskId = currentSelectedTaskId;
        const modalTitle = document.getElementById('modalTitle');
        const btnSubmitTask = document.getElementById('btnSubmitTask');
        if(modalTitle) modalTitle.textContent = "✏️ 修改項目";
        if(btnSubmitTask) btnSubmitTask.textContent = "更新項目";
        
        document.getElementById('detailModal')?.classList.add('hidden');
        document.getElementById('addModal')?.classList.remove('hidden');
    });

    document.getElementById('btnDeleteTask')?.addEventListener('click', async () => {
        if (confirm("⚠️ 確定要刪除此項目嗎？此操作無法還原。")) {
            try {
                await fetch(`/api/tasks?id=${currentSelectedTaskId}`, { method: 'DELETE' });
                alert("🗑️ 項目已刪除！");
                document.getElementById('detailModal')?.classList.add('hidden');
                loadTasks();
            } catch (e) {
                alert("刪除失敗，請稍後再試。");
            }
        }
    });

    const addTaskForm = document.getElementById('addTaskForm');
    const openAddModal = () => {
        editingTaskId = null; 
        const modalTitle = document.getElementById('modalTitle');
        const btnSubmitTask = document.getElementById('btnSubmitTask');
        if(modalTitle) modalTitle.textContent = "📝 新增項目";
        if(btnSubmitTask) btnSubmitTask.textContent = "儲存";
        document.getElementById('addModal')?.classList.remove('hidden');
    };
    
    btnOpenModal?.addEventListener('click', openAddModal);
    btnNavAdminAdd?.addEventListener('click', openAddModal);
    document.getElementById('btnAdminListAdd')?.addEventListener('click', openAddModal);
    
    document.getElementById('btnCloseModal')?.addEventListener('click', () => { 
        document.getElementById('addModal')?.classList.add('hidden'); 
        addTaskForm?.reset(); 
    });

    addTaskForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmitTask = document.getElementById('btnSubmitTask');
        btnSubmitTask.disabled = true;
        btnSubmitTask.textContent = "處理中...";
        
        const inputUrlEl = document.getElementById('inputUrl');
        let urlInput = inputUrlEl ? inputUrlEl.value.trim() : '';
        if (urlInput && !/^https?:\/\//i.test(urlInput)) {
            urlInput = 'https://' + urlInput;
        }

        const typeEl = document.getElementById('inputType');
        const titleEl = document.getElementById('inputTitle');
        const dateEl = document.getElementById('inputDate');
        const subjectEl = document.getElementById('inputSubject');
        const remarksEl = document.getElementById('inputRemarks');

        const type = typeEl ? typeEl.value : 'homework';
        const title = titleEl ? titleEl.value : '';
        let eventColor = type === 'test' ? '#EF4444' : type === 'notice' ? '#F59E0B' : type === 'event' ? '#10B981' : '#3B82F6';

        const taskData = {
            id: editingTaskId || String(Date.now()),
            title: title,
            date: dateEl ? dateEl.value : '',
            type: type,
            subject: subjectEl ? subjectEl.value : '',
            remarks: remarksEl ? remarksEl.value : '',
            url: urlInput,
            color: eventColor,
            completed: false,
            createdBy: savedUser
        };

        try {
            await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            
            alert(editingTaskId ? "✅ 項目已更新！" : "✅ 新項目已儲存！");
            document.getElementById('addModal')?.classList.add('hidden');
            addTaskForm.reset();
            loadTasks(); 
        } catch (err) {
            alert("儲存失敗，請檢查網絡連線。");
        } finally {
            btnSubmitTask.disabled = false;
            btnSubmitTask.textContent = "儲存";
        }
    });

    // ---------------------------------------------------------
    // 管理員後台專用渲染函數
    // ---------------------------------------------------------
    function renderAdminTaskTable() {
        const tbody = document.getElementById('adminTaskTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (taskList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-gray-500">目前數據庫中沒有任何項目。</td></tr>`;
            return;
        }

        const sortedTasks = [...taskList].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedTasks.forEach(task => {
            const tr = document.createElement('tr');
            tr.className = "border-b hover:bg-gray-50";
            
            let typeBadge = '';
            if(task.type === 'test') typeBadge = '<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">測驗</span>';
            else if(task.type === 'homework') typeBadge = '<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">功課</span>';
            else typeBadge = `<span class="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">${task.type}</span>`;

            tr.innerHTML = `
                <td class="p-3">${task.date}</td>
                <td class="p-3">${typeBadge}</td>
                <td class="p-3">${task.subject || '無'}</td>
                <td class="p-3 font-semibold text-gray-800">${task.title}</td>
                <td class="p-3 text-center">
                    <button class="text-blue-600 hover:text-blue-800 font-bold mr-2" onclick="editTaskFromAdmin('${task.id}')">編輯</button>
                    <button class="text-red-600 hover:text-red-800 font-bold" onclick="deleteTaskFromAdmin('${task.id}')">刪除</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.deleteTaskFromAdmin = async function(id) {
        if (confirm("⚠️ 確定要在後台刪除此項目嗎？")) {
            try {
                await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
                alert("🗑️ 項目已刪除！");
                loadTasks(); 
            } catch (e) {
                alert("刪除失敗");
            }
        }
    };

    window.editTaskFromAdmin = function(id) {
        openDetailModalById(id);
        document.getElementById('btnEditTask').click();
    };

    // 學生帳號管理控制 (純前端演示)
    const adminStudentSelect = document.getElementById('adminStudentSelect');
    const adminStudentPanel = document.getElementById('adminStudentPanel');
    const adminStudentEmptyMsg = document.getElementById('adminStudentEmptyMsg');

    adminStudentSelect?.addEventListener('change', (e) => {
        if (e.target.value) {
            adminStudentPanel.classList.remove('hidden');
            adminStudentPanel.classList.add('flex');
            adminStudentEmptyMsg.classList.add('hidden');
        } else {
            adminStudentPanel.classList.add('hidden');
            adminStudentPanel.classList.remove('flex');
            adminStudentEmptyMsg.classList.remove('hidden');
        }
    });

    document.getElementById('btnAdminResetPwd')?.addEventListener('click', () => {
        alert(`此功能需對接 D1 數據庫用戶表，目前為演示狀態。`);
    });
});
