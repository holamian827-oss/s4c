// --- 后台学生数据加载与排序 ---
    async function loadAdminUsers() {
        try {
            const res = await fetch('/api/admin/users');
            const rawUsers = await res.json();
            
            // 💡 修复乱序：提取学号前面的数字，进行数字大小排序 (1, 2, ..., 10, 11)
            adminUserList = rawUsers.sort((a, b) => {
                const numA = parseInt(a.username.split('_')[0]) || 0;
                const numB = parseInt(b.username.split('_')[0]) || 0;
                return numA - numB;
            });

            // 渲染下拉选单
            const select = document.getElementById('adminStudentSelect');
            if(select) {
                select.innerHTML = '<option value="">-- 請選擇要管理的學號 --</option>' + 
                    adminUserList.filter(u => u.role === 'student')
                    .map(u => `<option value="${u.username}">${u.username}</option>`).join('');
            }
            
            // 渲染小黑屋名单
            renderBannedList();
        } catch(e) {
            console.error(e);
        }
    }

    // --- 渲染小黑屋列表 ---
    function renderBannedList() {
        const ul = document.getElementById('adminBannedList');
        if (!ul) return;

        // 筛选出所有被封号的用户
        const bannedUsers = adminUserList.filter(u => u.banned_until);

        if (bannedUsers.length === 0) {
            ul.innerHTML = '<li class="text-gray-400 text-center mt-4">目前沒有被停用的帳號</li>';
            return;
        }

        ul.innerHTML = bannedUsers.map(u => {
            const isPerm = u.banned_until === 'permanent';
            const statusBadge = isPerm ? '<span class="bg-red-100 text-red-700 px-1 rounded">永久</span>' : '<span class="bg-orange-100 text-orange-700 px-1 rounded">1天</span>';
            return `
                <li class="flex justify-between items-center bg-red-50 p-2 rounded border border-red-100">
                    <div>
                        <span class="font-bold text-gray-800">${u.username}</span>
                        <div class="text-xs mt-1">${statusBadge}</div>
                    </div>
                    <button class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs font-bold shadow transition" 
                        onclick="document.dispatchEvent(new CustomEvent('quickUnban', {detail: '${u.username}'}))">
                        解封
                    </button>
                </li>`;
        }).join('');
    }

    // --- 监听下拉选单变动 ---
    const adminSelect = document.getElementById('adminStudentSelect');
    if(adminSelect) {
        adminSelect.addEventListener('change', (e) => {
            const targetUser = e.target.value;
            const panel = document.getElementById('adminStudentPanel');
            
            if(!targetUser) { 
                panel.classList.add('hidden'); 
                panel.classList.remove('flex'); 
                return; 
            }
            
            const uInfo = adminUserList.find(u => u.username === targetUser);
            panel.classList.remove('hidden'); 
            panel.classList.add('flex');
            
            document.getElementById('adminSelectedStudentName').textContent = targetUser;
            const statusEl = document.getElementById('adminStudentStatus');
            const btnUnban = document.getElementById('btnAdminUnban');
            const btnSus1D = document.getElementById('btnAdminSuspend1D');
            const btnSusPerm = document.getElementById('btnAdminSuspendPerm');

            if(uInfo.banned_until) {
                statusEl.textContent = uInfo.banned_until === 'permanent' ? '🛑 永久停用' : '⚠️ 停用中';
                statusEl.className = 'text-sm font-bold text-red-600';
                btnUnban.classList.remove('hidden'); 
                btnSus1D.classList.add('hidden'); 
                btnSusPerm.classList.add('hidden');
            } else {
                statusEl.textContent = '✅ 正常';
                statusEl.className = 'text-sm font-bold text-green-600';
                btnUnban.classList.add('hidden'); 
                btnSus1D.classList.remove('hidden'); 
                btnSusPerm.classList.remove('hidden');
            }
        });
    }

    // --- 封锁/解封 API 通讯 ---
    async function setBanStatus(targetUsername, duration) {
        if(!targetUsername) return;
        
        let until = "";
        if (duration === '1d') { 
            const d = new Date(); 
            d.setDate(d.getDate()+1); 
            until = d.toISOString(); 
        } else if (duration === 'perm') {
            until = 'permanent';
        }

        await fetch('/api/admin/user-status', { 
            method: 'POST', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({ username: targetUsername, bannedUntil: until }) 
        });
        
        // 刷新列表数据
        await loadAdminUsers();
        
        // 如果当前下拉框选中的人就是被操作的人，更新面板 UI
        const selectEl = document.getElementById('adminStudentSelect');
        if(selectEl.value === targetUsername) {
            selectEl.dispatchEvent(new Event('change'));
        }
    }

    // 绑定面板操作按钮
    document.getElementById('btnAdminSuspend1D')?.addEventListener('click', () => setBanStatus(adminSelect.value, '1d'));
    document.getElementById('btnAdminSuspendPerm')?.addEventListener('click', () => setBanStatus(adminSelect.value, 'perm'));
    document.getElementById('btnAdminUnban')?.addEventListener('click', () => setBanStatus(adminSelect.value, ''));
    
    // 绑定小黑屋列表的快捷解封事件
    document.addEventListener('quickUnban', (e) => {
        const username = e.detail;
        if(confirm(`確定要解除 ${username} 的停用狀態嗎？`)) {
            setBanStatus(username, '');
        }
    });
