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

    document.getElementById('navUserInfo').textContent = savedUser;
    document.getElementById('loadingShield').classList.add('hidden');

    // 🔒 權限與視圖控制
    const btnOpenModal = document.getElementById('btnOpenModal');
    const btnNavAdminAdd = document.getElementById('btnNavAdminAdd');
    const mainAppView = document.getElementById('mainAppView');
    const adminDashboardView = document.getElementById('adminDashboardView');
   
    if (savedRole === 'admin') {
        adminDashboardView.classList.remove('hidden');
        if(btnNavAdminAdd) btnNavAdminAdd.classList.remove('hidden');
    } else {
        mainAppView.classList.remove('hidden');
        if(savedRole === 'teacher') btnOpenModal.classList.remove('hidden');
    }

    // ≡ 系統菜單邏輯
    const sysMenuModal = document.getElementById('sysMenuModal');
    const sysTabBtns = document.querySelectorAll('.sys-tab-btn');
    const sysTabContents = document.querySelectorAll('.sys-tab-content');

    document.getElementById('btnSysMenu')?.addEventListener('click', () => sysMenuModal.classList.remove('hidden'));
    document.getElementById('btnCloseSysMenu')?.addEventListener('click', () => sysMenuModal.classList.add('hidden'));

    sysTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sysTabBtns.forEach(b => { b.classList.replace('bg-blue-50', 'bg-gray-50'); b.classList.replace('text-blue-700', 'text-gray-700'); });
            btn.classList.replace('bg-gray-50', 'bg-blue-50'); btn.classList.replace('text-gray-700', 'text-blue-700');
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
            alert("✅ 密碼更改成功！"); sysMenuModal.classList.add('hidden');
        } else { alert("❌ 密碼太短。"); }
    });

    // 登出清空
    document.querySelector('a[href="login.html"]').addEventListener('click', () => {
        localStorage.removeItem('s4c_user'); localStorage.removeItem('s4c_role');
    });

    // ---------------------------------------------------------
    // 數據與日曆邏輯 (支援修改刪除)
    // ---------------------------------------------------------
    let mockTasks = [
        { id: '1', title: '物理大測', date: '2026-04-10', type: 'test', subject: '物理', color: '#EF4444', remarks: '第一至三章', completed: false, createdBy: '物理老師' },
        { id: '2', title: '數學工作紙', date: '2026-04-06', type: 'homework', subject: '數學 (班主任)', color: '#3B82F6', url: 'https://classroom.google.com', completed: false, createdBy: '班主任' }
    ];

    let currentSelectedTaskId = null; // 紀錄目前點開嘅任務 ID
    let editingTaskId = null; // 紀錄目前修改緊嘅任務 ID

    const calendarEl = document.getElementById('calendar');
    let calendar;
    if(savedRole !== 'admin' && calendarEl) {
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

        document.getElementById('detailTitle').textContent = task.title;
        document.getElementById('detailType').textContent = task.type;
        document.getElementById('detailSubject').textContent = task.subject || '無';
        document.getElementById('detailRemarks').textContent = task.remarks || '無';
       
        const urlContainer = document.getElementById('detailUrlContainer');
        if(task.url) {
            urlContainer.classList.remove('hidden');
            document.getElementById('detailUrl').href = task.url;
        } else { urlContainer.classList.add('hidden'); }

        // 判斷權限顯示按鈕
        const isCreatorOrAdmin = (savedRole === 'admin' || task.createdBy === savedUser);
        const manageContainer = document.getElementById('manageActionContainer');
        const studentContainer = document.getElementById('studentActionContainer');

        if (isCreatorOrAdmin) {
            manageContainer.classList.remove('hidden');
            studentContainer.classList.add('hidden'); // 管理者唔需要標記完成
        } else {
            manageContainer.classList.add('hidden');
            studentContainer.classList.remove('hidden');
           
            const btnDone = document.getElementById('btnMarkDone');
            const btnUndone = document.getElementById('btnMarkUndone');
            if (task.completed) { btnDone.classList.add('hidden'); btnUndone.classList.remove('hidden'); }
            else { btnDone.classList.remove('hidden'); btnUndone.classList.add('hidden'); }
        }

        document.getElementById('detailModal').classList.remove('hidden');
    }

    // 關閉詳情
    document.getElementById('btnCloseDetailX').onclick = () => document.getElementById('detailModal').classList.add('hidden');
    document.getElementById('btnCloseDetailBtn').onclick = () => document.getElementById('detailModal').classList.add('hidden');

    // ✏️ 修改按鈕
    document.getElementById('btnEditTask')?.addEventListener('click', () => {
        const task = mockTasks.find(t => t.id === currentSelectedTaskId);
        if(!task) return;
       
        // 填入資料去 Form
        document.getElementById('inputTitle').value = task.title.replace(/^\[.*?\] /, ''); // 移除 [小測] 標籤
        document.getElementById('inputRemarks').value = task.remarks || '';
        document.getElementById('inputUrl').value = task.url || '';
        document.getElementById('inputType').value = task.type;
        document.getElementById('inputSubject').value = task.subject;
        document.getElementById('inputDate').value = task.date;
       
        // 切換 Modal 標題同狀態
        editingTaskId = currentSelectedTaskId;
        document.getElementById('modalTitle').textContent = "✏️ 修改項目";
        document.getElementById('btnSubmitTask').textContent = "更新項目";
       
        document.getElementById('detailModal').classList.add('hidden');
        document.getElementById('addModal').classList.remove('hidden');
    });

    // 🗑️ 刪除按鈕
    document.getElementById('btnDeleteTask')?.addEventListener('click', () => {
        if(confirm("⚠️ 確定要刪除此項目嗎？此操作無法還原。")) {
            mockTasks = mockTasks.filter(t => t.id !== currentSelectedTaskId);
            if(calendar) {
                const eventObj = calendar.getEventById(currentSelectedTaskId);
                if(eventObj) eventObj.remove();
            }
            alert("🗑️ 項目已刪除！");
            document.getElementById('detailModal').classList.add('hidden');
        }
    });

    // 新增/修改表單提交
    const addTaskForm = document.getElementById('addTaskForm');
    const openAddModal = () => {
        editingTaskId = null; // 確保係新增狀態
        document.getElementById('modalTitle').textContent = "📝 新增項目";
        document.getElementById('btnSubmitTask').textContent = "儲存";
        document.getElementById('addModal').classList.remove('hidden');
    };
   
    btnOpenModal?.addEventListener('click', openAddModal);
    btnNavAdminAdd?.addEventListener('click', openAddModal);
   
    document.getElementById('btnCloseModal').onclick = () => {
        document.getElementById('addModal').classList.add('hidden');
        addTaskForm.reset();
    };

    addTaskForm?.addEventListener('submit', (e) => {
        e.preventDefault();
       
        let urlInput = document.getElementById('inputUrl').value.trim();
        // 🌟 URL 智能補全
        if (urlInput && !/^https?:\/\//i.test(urlInput)) {
            urlInput = 'https://' + urlInput;
        }

        const title = document.getElementById('inputTitle').value;
        const type = document.getElementById('inputType').value;
        const importance = document.getElementById('inputImportance').value;
        const fullTitle = (type === 'test' ? `[${importance}] ` : '') + title;
       
        let eventColor = type === 'test' ? '#EF4444' : type === 'notice' ? '#F59E0B' : type === 'event' ? '#10B981' : '#3B82F6';

        const taskData = {
            id: editingTaskId || String(Date.now()),
            title: fullTitle,
            date: document.getElementById('inputDate').value,
            type: type,
            subject: document.getElementById('inputSubject').value,
            remarks: document.getElementById('inputRemarks').value,
            url: urlInput,
            color: eventColor,
            completed: false,
            createdBy: savedUser
        };

        if (editingTaskId) {
            // 更新現有
            const taskIndex = mockTasks.findIndex(t => t.id === editingTaskId);
            if(taskIndex !== -1) mockTasks[taskIndex] = taskData;
           
            if (calendar) {
                const existingEvent = calendar.getEventById(editingTaskId);
                if (existingEvent) existingEvent.remove();
                calendar.addEvent({ ...taskData, extendedProps: taskData });
            }
            alert("✅ 項目已更新！");
        } else {
            // 新增
            mockTasks.push(taskData);
            if (calendar) calendar.addEvent({ ...taskData, extendedProps: taskData });
            alert("✅ 新項目已儲存！");
        }

        // 🛑 移除了 calendar.changeView('listMonth')，不再強制跳轉

        document.getElementById('addModal').classList.add('hidden');
        addTaskForm.reset();
    });

    // 其他：Admin 簡單渲染 (如需)
    if(savedRole === 'admin') {
        const ul = document.getElementById('adminLoginLog');
        if(ul) ul.innerHTML = `<li class="border-b pb-2"><span class="font-bold text-blue-600">22_同學</span> <span class="text-xs text-gray-500">剛剛</span></li>`;
    }
});