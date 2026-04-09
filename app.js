document.addEventListener('DOMContentLoaded', function() {
    
    // 1. 【身分檢查站】
    const urlParams = new URLSearchParams(window.location.search);
    const urlUser = urlParams.get('user');
    const urlRole = urlParams.get('role');

    if (urlUser && urlRole) {
        localStorage.setItem('s4c_user', urlUser);
        localStorage.setItem('s4c_role', urlRole);
        try { window.history.replaceState({}, document.title, "index.html"); } catch(e){}
    }

    const savedUser = localStorage.getItem('s4c_user');
    const savedRole = localStorage.getItem('s4c_role');

    if (!savedUser || !savedRole || savedUser === '未登入') {
        window.location.href = 'login.html';
        return; 
    }

    // ✅ 安全賦值與移除遮罩
    const navUserInfoEl = document.getElementById('navUserInfo');
    if (navUserInfoEl) navUserInfoEl.textContent = savedUser;
    
    document.getElementById('loadingShield')?.classList.add('hidden');

    // 🔒 權限與視圖控制 (✅ 全部加入安全檢查)
    const btnOpenModal = document.getElementById('btnOpenModal');
    const btnNavAdminAdd = document.getElementById('btnNavAdminAdd');
    const mainAppView = document.getElementById('mainAppView');
    const adminDashboardView = document.getElementById('adminDashboardView');
    
    if (savedRole === 'admin') {
        adminDashboardView?.classList.remove('hidden');
        btnNavAdminAdd?.classList.remove('hidden');
    } else {
        mainAppView?.classList.remove('hidden');
        if (savedRole === 'teacher') btnOpenModal?.classList.remove('hidden');
    }

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

    document.getElementById('btnChangeMyPwd')?.addEventListener('click', () => {
        const currentPwd = prompt("請輸入您的目前密碼：");
        if (!currentPwd) return; 
        const expectedPwd = localStorage.getItem(`pwd_${savedUser}`) || (savedRole === 'admin' ? 'Admin1234' : '12345678');
        if (currentPwd !== expectedPwd) { alert("❌ 目前密碼錯誤！"); return; }
        const newPwd = prompt("請輸入新密碼 (最少 6 個字元)：");
        if (newPwd && newPwd.length >= 6) {
            localStorage.setItem(`pwd_${savedUser}`, newPwd);
            alert("✅ 密碼更改成功！"); sysMenuModal?.classList.add('hidden');
        } else { alert("❌ 密碼太短。"); }
    });

    // ✅ 安全綁定登出按鈕
    const logoutBtn = document.querySelector('a[href="login.html"]');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('s4c_user'); 
            localStorage.removeItem('s4c_role');
        });
    }

    // ---------------------------------------------------------
    // 數據與日曆邏輯 (支援修改刪除)
    // ---------------------------------------------------------
    let mockTasks = [
        { id: '1', title: '物理大測', date: '2026-04-10', type: 'test', subject: '物理', color: '#EF4444', remarks: '第一至三章', completed: false, createdBy: '物理老師' },
        { id: '2', title: '數學工作紙', date: '2026-04-06', type: 'homework', subject: '數學 (班主任)', color: '#3B82F6', url: 'https://classroom.google.com', completed: false, createdBy: '班主任' }
    ];

    let currentSelectedTaskId = null; 
    let editingTaskId = null; 

    const calendarEl = document.getElementById('calendar');
    let calendar;
    if (savedRole !== 'admin' && calendarEl) {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
            events: mockTasks,
            eventClick: (info) => openDetailModalById(info.event.id),
            eventClassNames: (arg) => arg.event.extendedProps.completed ? ['task-completed'] : []
        });
        calendar.render();
    }

    function openDetailModalById(id) {
        const task = mockTasks.find(t => t.id === id);
        if(!task) return;
        currentSelectedTaskId = id;

        // ✅ 安全寫入詳情
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

        const isCreatorOrAdmin = (savedRole === 'admin' || task.createdBy === savedUser);
        const manageContainer = document.getElementById('manageActionContainer');
        const studentContainer = document.getElementById('studentActionContainer');

        if (isCreatorOrAdmin) {
            manageContainer?.classList.remove('hidden');
            studentContainer?.classList.add('hidden'); 
        } else {
            manageContainer?.classList.add('hidden');
            studentContainer?.classList.remove('hidden');
            
            const btnDone = document.getElementById('btnMarkDone');
            const btnUndone = document.getElementById('btnMarkUndone');
            if (task.completed) { 
                btnDone?.classList.add('hidden'); 
                btnUndone?.classList.remove('hidden'); 
            } else { 
                btnDone?.classList.remove('hidden'); 
                btnUndone?.classList.add('hidden'); 
            }
        }

        document.getElementById('detailModal')?.classList.remove('hidden');
    }

    // 關閉詳情
    document.getElementById('btnCloseDetailX')?.addEventListener('click', () => document.getElementById('detailModal')?.classList.add('hidden'));
    document.getElementById('btnCloseDetailBtn')?.addEventListener('click', () => document.getElementById('detailModal')?.classList.add('hidden'));

    // ✏️ 修改按鈕
    document.getElementById('btnEditTask')?.addEventListener('click', () => {
        const task = mockTasks.find(t => t.id === currentSelectedTaskId);
        if(!task) return;
        
        const inputTitle = document.getElementById('inputTitle');
        const inputRemarks = document.getElementById('inputRemarks');
        const inputUrl = document.getElementById('inputUrl');
        const inputType = document.getElementById('inputType');
        const inputSubject = document.getElementById('inputSubject');
        const inputDate = document.getElementById('inputDate');

        // ✅ 安全讀取與替換
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

    // 🗑️ 刪除按鈕
    document.getElementById('btnDeleteTask')?.addEventListener('click', () => {
        if (confirm("⚠️ 確定要刪除此項目嗎？此操作無法還原。")) {
            mockTasks = mockTasks.filter(t => t.id !== currentSelectedTaskId);
            if (calendar) {
                const eventObj = calendar.getEventById(currentSelectedTaskId);
                if(eventObj) eventObj.remove();
            }
            alert("🗑️ 項目已刪除！");
            document.getElementById('detailModal')?.classList.add('hidden');
        }
    });

    // 新增/修改表單提交
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
    
    document.getElementById('btnCloseModal')?.addEventListener('click', () => { 
        document.getElementById('addModal')?.classList.add('hidden'); 
        addTaskForm?.reset(); 
    });

    addTaskForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const inputUrlEl = document.getElementById('inputUrl');
        let urlInput = inputUrlEl ? inputUrlEl.value.trim() : '';
        if (urlInput && !/^https?:\/\//i.test(urlInput)) {
            urlInput = 'https://' + urlInput;
        }

        const typeEl = document.getElementById('inputType');
        const titleEl = document.getElementById('inputTitle');
        const importanceEl = document.getElementById('inputImportance');
        const dateEl = document.getElementById('inputDate');
        const subjectEl = document.getElementById('inputSubject');
        const remarksEl = document.getElementById('inputRemarks');

        const type = typeEl ? typeEl.value : 'homework';
        const title = titleEl ? titleEl.value : '';
        const importance = importanceEl ? importanceEl.value : '';
        const fullTitle = (type === 'test' ? `[${importance}] ` : '') + title;
        
        let eventColor = type === 'test' ? '#EF4444' : type === 'notice' ? '#F59E0B' : type === 'event' ? '#10B981' : '#3B82F6';

        const taskData = {
            id: editingTaskId || String(Date.now()),
            title: fullTitle,
            date: dateEl ? dateEl.value : '',
            type: type,
            subject: subjectEl ? subjectEl.value : '',
            remarks: remarksEl ? remarksEl.value : '',
            url: urlInput,
            color: eventColor,
            completed: false,
            createdBy: savedUser
        };

        if (editingTaskId) {
            const taskIndex = mockTasks.findIndex(t => t.id === editingTaskId);
            if(taskIndex !== -1) mockTasks[taskIndex] = taskData;
            
            if (calendar) {
                const existingEvent = calendar.getEventById(editingTaskId);
                if (existingEvent) existingEvent.remove();
                calendar.addEvent({ ...taskData, extendedProps: taskData });
            }
            alert("✅ 項目已更新！");
        } else {
            mockTasks.push(taskData);
            if (calendar) calendar.addEvent({ ...taskData, extendedProps: taskData });
            alert("✅ 新項目已儲存！");
        }

        document.getElementById('addModal')?.classList.add('hidden');
        addTaskForm.reset();
    });

    // 管理員數據渲染
    if (savedRole === 'admin') {
        const ul = document.getElementById('adminLoginLog');
        if (ul) ul.innerHTML = `<li class="border-b pb-2"><span class="font-bold text-blue-600">22_同學</span> <span class="text-xs text-gray-500">剛剛</span></li>`;
    }
});
