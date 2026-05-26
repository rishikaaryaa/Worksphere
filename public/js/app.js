document.addEventListener('DOMContentLoaded', () => {
  const authContainer = document.getElementById('auth-container');
  const portalContainer = document.getElementById('portal-container');
  const screenLogin = document.getElementById('screen-login');
  const screenSignup = document.getElementById('screen-signup');
  const screenForgot = document.getElementById('screen-forgot');
  const screenReset = document.getElementById('screen-reset');
  const authAlert = document.getElementById('auth-alert');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const forgotForm = document.getElementById('forgot-form');
  const resetForm = document.getElementById('reset-form');
  const sidebarUserName = document.getElementById('sidebar-user-name');
  const sidebarUserRole = document.getElementById('sidebar-user-role');
  const sidebarUserAvatar = document.getElementById('sidebar-user-avatar');
  const topbarPageTitle = document.getElementById('topbar-page-title');
  const topbarPageSubtitle = document.getElementById('topbar-page-subtitle');
  const topbarRoleBadge = document.getElementById('topbar-role-badge');
  const topbarAvatar = document.getElementById('topbar-avatar');
  const navItems = document.querySelectorAll('.nav-item');
  const dashboardPanels = document.querySelectorAll('.dashboard-panel');
  const btnLogout = document.getElementById('btn-logout');
  const workForm = document.getElementById('work-form');
  const workTableBody = document.getElementById('work-table-body');
  const workListSummary = document.getElementById('work-list-summary');
  const btnRefreshWork = document.getElementById('btn-refresh-work');
  const adminCreateUserForm = document.getElementById('admin-create-user-form');
  const usersTableBody = document.getElementById('users-table-body');
  const btnRefreshUsers = document.getElementById('btn-refresh-users');
  const logsTableBody = document.getElementById('logs-table-body');
  const logsListSummary = document.getElementById('logs-list-summary');
  const btnRefreshLogs = document.getElementById('btn-refresh-logs');
  const modalChangePassword = document.getElementById('modal-change-password');
  const adminChangePasswordForm = document.getElementById('admin-change-password-form');
  const changePwdUserid = document.getElementById('change-pwd-userid');
  const changePwdEmail = document.getElementById('change-pwd-email');
  const btnClosePwdModal = document.getElementById('btn-close-pwd-modal');
  const btnCancelPwdModal = document.getElementById('btn-cancel-pwd-modal');
  const btnToggleMailbox = document.getElementById('btn-toggle-mailbox');
  const mailboxDrawer = document.getElementById('mailbox-drawer');
  const btnCloseMailbox = document.getElementById('btn-close-mailbox');
  const btnClearMailbox = document.getElementById('btn-clear-mailbox');
  const mailboxList = document.getElementById('mailbox-list');
  const mailUnreadDot = document.getElementById('mail-unread-dot');

  let currentUser = null;
  let emailPollInterval = null;
  let knownEmailIds = new Set();
  let forgotEmailInput = '';

  function showAuthScreen(screen) {
    [screenLogin, screenSignup, screenForgot, screenReset].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
    authAlert.style.display = 'none';
    authAlert.innerText = '';
  }
  function showAuthAlert(message, type = 'error') {
    authAlert.innerText = message;
    authAlert.className = `auth-alert-banner ${type}`;
  }
  function applyRoleTheme(role) {
    if (role) {
      document.body.setAttribute('data-role', role);
      const greeting = document.getElementById('topbar-greeting');
      if (greeting) {
        if (role === 'super_admin') {
          greeting.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Command Center Active';
        } else if (role === 'admin') {
          greeting.innerHTML = '<i class="fa-solid fa-gauge-high"></i> Operations Dashboard';
        } else {
          greeting.innerHTML = '<i class="fa-solid fa-hand"></i> Welcome back!';
        }
      }
    } else {
      document.body.removeAttribute('data-role');
      const greeting = document.getElementById('topbar-greeting');
      if (greeting) greeting.innerHTML = '';
    }
  }
  function renderSkeletonRows(cols, rows = 4) {
    let html = '';
    for (let r = 0; r < rows; r++) {
      html += '<tr class="skeleton-row">';
      for (let c = 0; c < cols; c++) {
        const width = 60 + Math.floor(Math.random() * 30);
        html += `<td><div class="skeleton-loader" style="width:${width}%;height:14px"></div></td>`;
      }
      html += '</tr>';
    }
    return html;
  }
  function togglePortalView(showPortal) {
    if (showPortal) { authContainer.classList.add('hidden'); portalContainer.classList.remove('hidden'); initDashboard(); startEmailPolling(); }
    else { authContainer.classList.remove('hidden'); portalContainer.classList.add('hidden'); applyRoleTheme(null); currentUser = null; stopEmailPolling(); }
  }

  document.getElementById('link-to-signup').addEventListener('click', e => { e.preventDefault(); forgotEmailInput = ''; showAuthScreen(screenSignup); });
  document.getElementById('link-to-forgot').addEventListener('click', e => { e.preventDefault(); forgotEmailInput = ''; showAuthScreen(screenForgot); });
  document.getElementById('link-to-login').addEventListener('click', e => { e.preventDefault(); forgotEmailInput = ''; showAuthScreen(screenLogin); });
  document.getElementById('link-forgot-to-login').addEventListener('click', e => { e.preventDefault(); forgotEmailInput = ''; showAuthScreen(screenLogin); });
  document.getElementById('link-reset-to-login').addEventListener('click', e => { e.preventDefault(); forgotEmailInput = ''; showAuthScreen(screenLogin); });

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      dashboardPanels.forEach(p => { p.id === target ? p.classList.add('active') : p.classList.remove('active'); });
      if (target === 'panel-work') { topbarPageTitle.innerText = 'Work Portal'; topbarPageSubtitle.innerText = 'Submit and review operations'; loadWorkData(); }
      else if (target === 'panel-users') { topbarPageTitle.innerText = 'User Management'; topbarPageSubtitle.innerText = 'Administrative actions & RBAC controls'; loadUsersData(); }
      else if (target === 'panel-logs') { topbarPageTitle.innerText = 'Security Audit Logs'; topbarPageSubtitle.innerText = 'Audited actions recorded on the server'; loadLogsData(); }
    });
  });

  btnToggleMailbox.addEventListener('click', () => { mailboxDrawer.classList.toggle('active'); mailUnreadDot.classList.add('hidden'); loadSimulatedEmails(); });
  btnCloseMailbox.addEventListener('click', () => { mailboxDrawer.classList.remove('active'); });

  // AUTH
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('btn-login');
    try { btn.disabled = true; btn.innerText = 'Signing in...';
      const data = await API.login(document.getElementById('login-email').value, document.getElementById('login-password').value);
      currentUser = data.user; loginForm.reset(); togglePortalView(true);
    } catch (err) { showAuthAlert(err.message, 'error'); } finally { btn.disabled = false; btn.innerText = 'Sign in'; }
  });
  signupForm.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('btn-signup');
    try { btn.disabled = true; btn.innerText = 'Registering...';
      await API.signup(document.getElementById('signup-name').value, document.getElementById('signup-email').value, document.getElementById('signup-password').value);
      showAuthAlert('Account created! Check simulated mailbox.', 'success'); signupForm.reset();
      setTimeout(() => showAuthScreen(screenLogin), 2000);
    } catch (err) { showAuthAlert(err.message, 'error'); } finally { btn.disabled = false; btn.innerText = 'Register'; }
  });
  forgotForm.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('btn-send-otp');
    try { btn.disabled = true; btn.innerText = 'Sending OTP...';
      const email = document.getElementById('forgot-email').value;
      await API.forgotPassword(email); forgotEmailInput = email; forgotForm.reset();
      showAuthScreen(screenReset); showAuthAlert('OTP sent! Check simulated mailbox drawer.', 'success');
    } catch (err) { showAuthAlert(err.message, 'error'); } finally { btn.disabled = false; btn.innerText = 'Send OTP'; }
  });
  resetForm.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('btn-reset-pw');
    try { btn.disabled = true; btn.innerText = 'Resetting...';
      await API.resetPassword(forgotEmailInput, document.getElementById('reset-otp').value, document.getElementById('reset-password').value);
      resetForm.reset(); forgotEmailInput = ''; showAuthScreen(screenLogin); showAuthAlert('Password reset! Sign in with new password.', 'success');
    } catch (err) { showAuthAlert(err.message, 'error'); } finally { btn.disabled = false; btn.innerText = 'Reset Password'; }
  });
  btnLogout.addEventListener('click', async () => { try { await API.logout(); } catch(e){} finally { togglePortalView(false); } });

  // DASHBOARD
  async function initDashboard() {
    currentUser = API.getSavedUser();
    if (!currentUser) { togglePortalView(false); return; }
    applyRoleTheme(currentUser.role);
    const role = currentUser.role.replace('_', ' ');
    sidebarUserName.innerText = currentUser.name;
    sidebarUserRole.innerText = role; sidebarUserRole.className = `badge ${currentUser.role}`;
    sidebarUserAvatar.innerText = currentUser.name.charAt(0).toUpperCase();
    topbarRoleBadge.innerText = `Role: ${role}`; topbarRoleBadge.className = `role-badge ${currentUser.role}`;
    topbarAvatar.innerText = currentUser.name.charAt(0).toUpperCase();
    updateRbacTierUI(currentUser.role);
    const isAdmin = currentUser.role === 'admin', isSuperAdmin = currentUser.role === 'super_admin';
    const adminNav = document.querySelector('.nav-item[data-target="panel-users"]');
    if (isAdmin || isSuperAdmin) {
      adminNav.classList.remove('hidden');
      const saOnly = document.querySelectorAll('.superadmin-only');
      if (isSuperAdmin) { saOnly.forEach(el => el.classList.remove('hidden')); document.getElementById('admin-controls-grid').style.gridTemplateColumns = ''; }
      else { saOnly.forEach(el => el.classList.add('hidden')); document.getElementById('admin-controls-grid').style.gridTemplateColumns = '1fr'; }
    } else { adminNav.classList.add('hidden'); }
    loadWorkData();
  }
  function updateRbacTierUI(role) {
    const u = document.getElementById('tier-node-user'), a = document.getElementById('tier-node-admin'), s = document.getElementById('tier-node-superadmin');
    u.classList.remove('active-tier'); a.classList.remove('active-tier'); s.classList.remove('active-tier');
    u.classList.add('active-tier');
    if (role === 'admin') a.classList.add('active-tier');
    else if (role === 'super_admin') { a.classList.add('active-tier'); s.classList.add('active-tier'); }
  }

  // WORK
  workForm.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = workForm.querySelector('button[type="submit"]');
    try { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
      await API.submitWork(document.getElementById('work-client-name').value, document.getElementById('work-client-email').value, document.getElementById('work-notes').value);
      workForm.reset(); loadWorkData();
    } catch (err) { alert('Failed: ' + err.message); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Submit Client Record'; }
  });
  async function loadWorkData() {
    const cols = currentUser && currentUser.role === 'super_admin' ? 7 : 6;
    workTableBody.innerHTML = renderSkeletonRows(cols);
    try {
      const recs = await API.getWorkList();
      const sa = currentUser && currentUser.role === 'super_admin';
      workListSummary.innerText = currentUser && currentUser.role === 'user' ? `Your records (${recs.length})` : `All records (${recs.length})`;
      if (!recs.length) { workTableBody.innerHTML = `<tr><td colspan="${sa?7:6}" class="loading-cell">No records.</td></tr>`; return; }
      workTableBody.innerHTML = '';
      recs.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${r.id.slice(0,8)}...</strong></td><td>${r.userName}</td><td>${r.clientName}</td><td>${r.clientEmail}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.notes||'<em style="color:#6b7280">None</em>'}</td><td>${new Date(r.createdAt).toLocaleString()}</td>${sa?`<td><div class="action-btns"><button class="btn-action delete btn-del-w" data-id="${r.id}"><i class="fa-solid fa-trash-can"></i></button></div></td>`:''}`;
        workTableBody.appendChild(tr);
      });
      if (sa) document.querySelectorAll('.btn-del-w').forEach(b => b.addEventListener('click', async () => { if(confirm('Delete this record?')) { await API.deleteWork(b.dataset.id); loadWorkData(); } }));
    } catch(e) { workTableBody.innerHTML = `<tr><td colspan="7" class="loading-cell text-danger">${e.message}</td></tr>`; }
  }
  btnRefreshWork.addEventListener('click', loadWorkData);

  // USERS
  adminCreateUserForm.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = adminCreateUserForm.querySelector('button[type="submit"]');
    try { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Provisioning...';
      await API.createUser(document.getElementById('admin-user-name').value, document.getElementById('admin-user-email').value, document.getElementById('admin-user-password').value, document.getElementById('admin-user-role').value);
      adminCreateUserForm.reset(); loadUsersData(); alert('Account created! Welcome email sent.');
    } catch(err) { alert('Failed: ' + err.message); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-shield"></i> Provision Account & Send Mail'; }
  });
  async function loadUsersData() {
    const cols = currentUser && currentUser.role === 'super_admin' ? 6 : 5;
    usersTableBody.innerHTML = renderSkeletonRows(cols);
    try {
      const users = await API.getUsers();
      const sa = currentUser && currentUser.role === 'super_admin';
      if (!users.length) { usersTableBody.innerHTML = '<tr><td colspan="6" class="loading-cell">No users.</td></tr>'; return; }
      usersTableBody.innerHTML = '';
      users.forEach(u => {
        const isSelf = currentUser && u.id === currentUser.id;
        const isMaster = u.id === 'usr_superadmin';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${u.id.slice(0,12)}...</strong></td><td>${u.name}${isSelf?' <span class="text-primary" style="font-size:10px;font-weight:700">(YOU)</span>':''}</td><td>${u.email}</td><td><span class="badge ${u.role}">${u.role.replace('_',' ')}</span></td><td>${new Date(u.createdAt).toLocaleDateString()}</td>${sa?`<td><div class="action-btns"><button class="btn-action edit-pw btn-pw" data-id="${u.id}" data-email="${u.email}"><i class="fa-solid fa-key"></i></button>${(!isMaster&&!isSelf)?`<button class="btn-action delete btn-del-u" data-id="${u.id}" data-name="${u.name}"><i class="fa-solid fa-user-slash"></i></button>`:''}</div></td>`:''}`;
        usersTableBody.appendChild(tr);
      });
      if (sa) {
        document.querySelectorAll('.btn-pw').forEach(b => b.addEventListener('click', () => { changePwdUserid.value=b.dataset.id; changePwdEmail.value=b.dataset.email; document.getElementById('change-pwd-newpwd').value=''; modalChangePassword.classList.add('active'); }));
        document.querySelectorAll('.btn-del-u').forEach(b => b.addEventListener('click', async () => { if(confirm(`Delete ${b.dataset.name}?`)) { await API.deleteUser(b.dataset.id); loadUsersData(); } }));
      }
    } catch(e) { usersTableBody.innerHTML = `<tr><td colspan="6" class="loading-cell text-danger">${e.message}</td></tr>`; }
  }
  btnRefreshUsers.addEventListener('click', loadUsersData);
  function closeModal() { modalChangePassword.classList.remove('active'); adminChangePasswordForm.reset(); }
  btnClosePwdModal.addEventListener('click', closeModal);
  btnCancelPwdModal.addEventListener('click', closeModal);
  adminChangePasswordForm.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = adminChangePasswordForm.querySelector('button[type="submit"]');
    try { btn.disabled = true; btn.innerText = 'Updating...';
      await API.changeUserPassword(changePwdUserid.value, document.getElementById('change-pwd-newpwd').value);
      closeModal(); alert('Password updated.');
    } catch(err) { alert('Failed: ' + err.message); } finally { btn.disabled = false; btn.innerText = 'Update Password'; }
  });

  // LOGS
  async function loadLogsData() {
    logsTableBody.innerHTML = renderSkeletonRows(8);
    try {
      const logs = await API.getLogs();
      logsListSummary.innerText = currentUser && currentUser.role === 'user' ? `Your logs (${logs.length})` : `Audit trail (${logs.length} events)`;
      if (!logs.length) { logsTableBody.innerHTML = '<tr><td colspan="8" class="loading-cell">No logs.</td></tr>'; return; }
      logsTableBody.innerHTML = '';
      logs.forEach(l => {
        let bc = 'info';
        if (l.action.includes('SIGNUP')||l.action.includes('CREATED')) bc='success';
        if (l.action.includes('DELETED')) bc='danger';
        if (l.action.includes('RESET')||l.action.includes('CHANGED')) bc='warning';
        if (l.action==='LOGIN') bc='primary';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><code style="color:#9ca3af">${l.id.slice(0,8)}</code></td><td><strong>${l.userName}</strong></td><td>${l.email}</td><td><span class="badge ${l.role}" style="font-size:10px">${l.role.replace('_',' ')}</span></td><td><span class="badge ${bc}" style="font-size:10px">${l.action}</span></td><td>${l.details}</td><td><code style="color:#0ea5e9">${l.ip}</code></td><td>${new Date(l.timestamp).toLocaleString()}</td>`;
        logsTableBody.appendChild(tr);
      });
    } catch(e) { logsTableBody.innerHTML = `<tr><td colspan="8" class="loading-cell text-danger">${e.message}</td></tr>`; }
  }
  btnRefreshLogs.addEventListener('click', loadLogsData);

  function getActiveFormEmail() {
    if (currentUser) return null;
    if (forgotEmailInput) return forgotEmailInput.toLowerCase().trim();
    const forgotEmail = document.getElementById('forgot-email')?.value;
    if (forgotEmail) return forgotEmail.toLowerCase().trim();
    const signupEmail = document.getElementById('signup-email')?.value;
    if (signupEmail) return signupEmail.toLowerCase().trim();
    const loginEmail = document.getElementById('login-email')?.value;
    if (loginEmail) return loginEmail.toLowerCase().trim();
    return null;
  }

  // MAILBOX
  async function loadSimulatedEmails() {
    try {
      const email = getActiveFormEmail();
      const emails = await API.getSimulatedEmails(email);
      if (!emails.length) {
        if (!currentUser && !email) {
          mailboxList.innerHTML = '<div class="empty-mailbox-msg"><i class="fa-solid fa-envelope-open"></i><p>Inbox Secure</p><span>Enter your email in the sign-in/reset form to view your incoming messages.</span></div>';
        } else {
          mailboxList.innerHTML = '<div class="empty-mailbox-msg"><i class="fa-solid fa-envelope-open"></i><p>Inbox Empty</p><span>Notifications appear here on signup/reset.</span></div>';
        }
        return;
      }
      mailboxList.innerHTML = '';
      emails.forEach(em => {
        const d = document.createElement('div'); d.className = 'mail-item';
        let body = em.body;
        if (em.type === 'otp' && em.otp) body = em.body.replace(em.otp, `<div class="otp-highlight">${em.otp}</div>`);
        else body = body.replace(/\n/g, '<br>');
        d.innerHTML = `<div class="mail-item-header"><span class="mail-subject">${em.subject}</span><span class="mail-date">${new Date(em.timestamp).toLocaleTimeString()}</span></div><div class="mail-to">To: ${em.to}</div><div class="mail-snippet">${body}</div>`;
        d.addEventListener('click', () => d.classList.toggle('expanded'));
        mailboxList.appendChild(d);
      });
    } catch(e) { mailboxList.innerHTML = `<div class="empty-mailbox-msg text-danger"><p>Error</p><span>${e.message}</span></div>`; }
  }
  btnClearMailbox.addEventListener('click', async () => {
    const email = getActiveFormEmail();
    const confirmMsg = currentUser ? 'Clear your visible mailbox?' : (email ? `Clear mailbox for ${email}?` : 'Clear mailbox?');
    if (!currentUser && !email) {
      alert('Enter your email in the form to clear your specific mailbox.');
      return;
    }
    if (confirm(confirmMsg)) {
      await API.clearSimulatedEmails(email);
      loadSimulatedEmails();
    }
  });
  function startEmailPolling() {
    const email = getActiveFormEmail();
    API.getSimulatedEmails(email).then(es => es.forEach(e => knownEmailIds.add(e.id)));
    emailPollInterval = setInterval(async () => {
      try {
        const currentEmail = getActiveFormEmail();
        const es = await API.getSimulatedEmails(currentEmail); let hasNew = false;
        es.forEach(e => { if (!knownEmailIds.has(e.id)) { knownEmailIds.add(e.id); hasNew = true; } });
        if (hasNew) { if (!mailboxDrawer.classList.contains('active')) mailUnreadDot.classList.remove('hidden'); else loadSimulatedEmails(); }
      } catch(e) {}
    }, 3000);
  }
  function stopEmailPolling() { if (emailPollInterval) { clearInterval(emailPollInterval); emailPollInterval = null; } knownEmailIds.clear(); }

  // INIT
  const cached = API.getToken();
  if (cached) { API.getProfile().then(() => togglePortalView(true)).catch(() => { togglePortalView(false); showAuthScreen(screenLogin); }); }
  else { togglePortalView(false); showAuthScreen(screenLogin); }
  startEmailPolling();
});
