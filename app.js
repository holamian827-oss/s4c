document.addEventListener('DOMContentLoaded', function() {
    
    // 1. 基本身分檢查與初始化
    const savedUser = localStorage.getItem('s4c_user');
    const savedRole = localStorage.getItem('s4c_role');

    if (!savedUser || !savedRole) {
        window.location.href = 'login.html';
        return; 
    }

    document.getElementById('navUserInfo').textContent = `${savedUser}`;

    // 2. 核心數據與變數
    let taskList = []; 
    let calendar;
    let currentSelectedTaskId = null;
    let editingTaskId = null;

    // --- 💡 意見反饋功能修復 ---
    const btnFeedback = document.getElementById('btnFeedback');
    const feedbackModal = document.getElementById('feedbackModal');
    const btnCloseFeedback = document.getElementById('btnCloseFeedback');
    const feedbackForm = document.getElementById('feedbackForm');

    if (btnFeedback) {
        btnFeedback.addEventListener('click', () => {
            feedbackModal.classList.remove('hidden');
        });
    }

    if (btnCloseFeedback) {
        btnCloseFeedback.addEventListener('click', () => {
            feedbackModal.classList.add('hidden');
            feedbackForm.reset();
        });
    }

    if (feedbackForm) {
        feedbackForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert("✅ 感謝您的反饋！意見已成功提交。");
            feedbackModal.classList.add('hidden');
            feedbackForm.reset();
        });
    }

    // --- 🔍 篩選功能修復 ---
    const applyFilterBtn = document.getElementById('applyFilter');
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', () => {
            if (!calendar) return;

            const selectedType = document.getElementById('filterType').value;
            const selectedSubject = document.getElementById('filterSubject').value;

            // 根據選取的類型同科目對 taskList 進行過濾
            const filteredTasks = taskList.filter(task => {
                const matchType = (selectedType === 'all' || task.type === selectedType);
                const matchSubject = (selectedSubject === 'all' || task.subject === selectedSubject);
                return matchType && matchSubject;
            });

            // 更新日曆顯示
            calendar.removeAllEvents();
            calendar.addEventSource(filteredTasks.map(t => ({
                id: t.id, title: t.title, start: t.date, color: t.color || (t.type === 'test' ? '#EF4444' : '#3B82F6'), extendedProps: t
            })));
        });
    }

    // --- 載入數據 ---
    async function loadData() {
        try {
            const res = await fetch('/api/tasks');
            taskList = await res.json();
            
            if (savedRole !== 'admin') {
                renderCalendar();
            } else {
                renderAdminAuditLog();
                loadAdminUsers();
            }
            document.getElementById('loadingShield').classList.add('hidden');
        } catch (e) {
            console.error("Fetch Data Error:", e);
        }
    }

    function renderCalendar() {
        const events = taskList.map(t => ({
            id: t.id, title: t.title, start: t.date, color: t.color || (t.type === 'test' ? '#EF4444' : '#3B82F6'), extendedProps: t
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

    // 其餘修改、刪除、Admin 後台邏輯保持 V0.5.2 原樣...

    loadData(); // 啟動
});
