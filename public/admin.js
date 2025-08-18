/**
 * AI휴먼 어드민 대시보드 JavaScript
 * 회원 관리, 리드 관리, 분석 기능
 */

// ===== 전역 변수 =====
let currentAdmin = null;
let adminCsrfToken = null;
let dashboardData = {
  users: [],
  leads: [],
  analytics: {},
  filteredUsers: [],
  filteredLeads: []
};

// ===== DOM 요소 선택 =====
const elements = {
  // 인증 관련
  adminLoginRequired: document.getElementById('adminLoginRequired'),
  adminDashboard: document.getElementById('adminDashboard'),
  adminLoginForm: document.getElementById('adminLoginForm'),
  adminLoginBtn: document.getElementById('adminLoginBtn'),
  adminLogoutBtn: document.getElementById('adminLogoutBtn'),
  adminAuthButtons: document.getElementById('adminAuthButtons'),
  adminUserMenu: document.getElementById('adminUserMenu'),
  adminUserName: document.getElementById('adminUserName'),
  
  // 통계
  totalUsers: document.getElementById('totalUsers'),
  totalLeads: document.getElementById('totalLeads'),
  totalChats: document.getElementById('totalChats'),
  todayVisits: document.getElementById('todayVisits'),
  
  // 탭
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  
  // 회원 관리
  userSearch: document.getElementById('userSearch'),
  refreshUsers: document.getElementById('refreshUsers'),
  usersTableBody: document.getElementById('usersTableBody'),
  
  // 리드 관리
  leadStatusFilter: document.getElementById('leadStatusFilter'),
  leadSearch: document.getElementById('leadSearch'),
  refreshLeads: document.getElementById('refreshLeads'),
  leadsTableBody: document.getElementById('leadsTableBody'),
  
  // 분석
  analyticsDateRange: document.getElementById('analyticsDateRange'),
  keywordAnalysis: document.getElementById('keywordAnalysis'),
  conversionStats: document.getElementById('conversionStats'),
  
  // 모달
  leadDetailModal: document.getElementById('leadDetailModal'),
  leadDetailClose: document.getElementById('leadDetailClose'),
  leadDetailBody: document.getElementById('leadDetailBody')
};

// ===== 유틸리티 함수 =====
function showAdminNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 2rem;
    right: 2rem;
    background: ${type === 'error' ? '#EF4444' : type === 'success' ? '#10B981' : '#5EEAD4'};
    color: ${type === 'error' || type === 'success' ? '#FFFFFF' : '#0B0F14'};
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
    z-index: 1060;
    font-weight: 500;
    max-width: 300px;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatPhoneNumber(phone) {
  if (!phone) return '-';
  return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
}

// ===== API 함수 =====
async function adminApiRequest(url, options = {}) {
  const config = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };
  
  if (adminCsrfToken && (config.method === 'POST' || config.method === 'PUT' || config.method === 'DELETE')) {
    config.headers['X-CSRF-Token'] = adminCsrfToken;
  }
  
  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || '요청 처리 중 오류가 발생했습니다.');
    }
    
    return data;
  } catch (error) {
    console.error('Admin API 요청 오류:', error);
    throw error;
  }
}

// ===== 인증 관련 함수 =====
async function checkAdminAuth() {
  try {
    const userData = await adminApiRequest('/api/admin/me');
    currentAdmin = userData;
    updateAdminAuthUI();
    loadDashboardData();
  } catch (error) {
    currentAdmin = null;
    updateAdminAuthUI();
  }
}

function updateAdminAuthUI() {
  if (currentAdmin) {
    elements.adminLoginRequired.style.display = 'none';
    elements.adminDashboard.classList.remove('hidden');
    elements.adminAuthButtons.style.display = 'none';
    elements.adminUserMenu.style.display = 'flex';
    elements.adminUserName.textContent = currentAdmin.username;
  } else {
    elements.adminLoginRequired.style.display = 'flex';
    elements.adminDashboard.classList.add('hidden');
    elements.adminAuthButtons.style.display = 'flex';
    elements.adminUserMenu.style.display = 'none';
  }
}

async function handleAdminLogin(formData) {
  try {
    const result = await adminApiRequest('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: formData.get('username'),
        password: formData.get('password')
      })
    });
    
    adminCsrfToken = result.csrfToken;
    currentAdmin = { username: result.username };
    
    updateAdminAuthUI();
    loadDashboardData();
    showAdminNotification('관리자 로그인되었습니다.', 'success');
    
  } catch (error) {
    showAdminNotification(error.message, 'error');
  }
}

async function handleAdminLogout() {
  try {
    await adminApiRequest('/api/admin/logout', { method: 'POST' });
    currentAdmin = null;
    adminCsrfToken = null;
    dashboardData = { users: [], leads: [], analytics: {}, filteredUsers: [], filteredLeads: [] };
    
    updateAdminAuthUI();
    showAdminNotification('로그아웃되었습니다.', 'success');
    
  } catch (error) {
    showAdminNotification(error.message, 'error');
  }
}

// ===== 대시보드 데이터 로드 =====
async function loadDashboardData() {
  if (!currentAdmin) return;
  
  try {
    // 통계 데이터 로드
    const stats = await adminApiRequest('/api/admin/stats');
    updateDashboardStats(stats);
    
    // 회원 데이터 로드
    await loadUsers();
    
    // 리드 데이터 로드
    await loadLeads();
    
    // 분석 데이터 로드
    await loadAnalytics();
    
  } catch (error) {
    showAdminNotification('데이터 로드 중 오류가 발생했습니다.', 'error');
  }
}

function updateDashboardStats(stats) {
  elements.totalUsers.textContent = stats.totalUsers || 0;
  elements.totalLeads.textContent = stats.totalLeads || 0;
  elements.totalChats.textContent = stats.totalChats || 0;
  elements.todayVisits.textContent = stats.todayVisits || 0;
}

// ===== 회원 관리 =====
async function loadUsers() {
  try {
    const users = await adminApiRequest('/api/admin/users');
    dashboardData.users = users;
    dashboardData.filteredUsers = users;
    renderUsersTable();
  } catch (error) {
    showAdminNotification('회원 데이터 로드 실패', 'error');
  }
}

function renderUsersTable() {
  const tbody = elements.usersTableBody;
  tbody.innerHTML = '';
  
  if (dashboardData.filteredUsers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--color-text-muted);">데이터가 없습니다.</td></tr>';
    return;
  }
  
  dashboardData.filteredUsers.forEach(user => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.username}</td>
      <td>${user.email}</td>
      <td>${formatPhoneNumber(user.phone)}</td>
      <td>${formatDate(user.createdAt)}</td>
      <td>
        <button class="btn action-btn btn-outline" onclick="viewUserDetail('${user.username}')">상세</button>
        <button class="btn action-btn" style="background: rgba(239, 68, 68, 0.2); color: #FCA5A5;" onclick="confirmDeleteUser('${user.username}')">삭제</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function filterUsers() {
  const searchTerm = elements.userSearch.value.toLowerCase();
  
  dashboardData.filteredUsers = dashboardData.users.filter(user => 
    user.username.toLowerCase().includes(searchTerm) ||
    user.email.toLowerCase().includes(searchTerm) ||
    (user.phone && user.phone.includes(searchTerm))
  );
  
  renderUsersTable();
}

async function confirmDeleteUser(username) {
  if (confirm(`정말로 사용자 "${username}"를 삭제하시겠습니까?`)) {
    try {
      await adminApiRequest(`/api/admin/users/${username}`, { method: 'DELETE' });
      showAdminNotification('사용자가 삭제되었습니다.', 'success');
      loadUsers();
    } catch (error) {
      showAdminNotification('사용자 삭제 실패', 'error');
    }
  }
}

// ===== 리드 관리 =====
async function loadLeads() {
  try {
    const leads = await adminApiRequest('/api/admin/leads');
    dashboardData.leads = leads.map(lead => ({
      ...lead,
      status: lead.status || 'new'
    }));
    dashboardData.filteredLeads = dashboardData.leads;
    renderLeadsTable();
  } catch (error) {
    showAdminNotification('리드 데이터 로드 실패', 'error');
  }
}

function renderLeadsTable() {
  const tbody = elements.leadsTableBody;
  tbody.innerHTML = '';
  
  if (dashboardData.filteredLeads.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--color-text-muted);">데이터가 없습니다.</td></tr>';
    return;
  }
  
  dashboardData.filteredLeads.forEach((lead, index) => {
    const row = document.createElement('tr');
    const statusClass = `status-${lead.status}`;
    const statusText = {
      new: '신규',
      contacted: '연락완료',
      completed: '처리완료'
    }[lead.status] || '신규';
    
    row.innerHTML = `
      <td>${lead.name}</td>
      <td>${lead.email}</td>
      <td>${formatPhoneNumber(lead.phone)}</td>
      <td>${Array.isArray(lead.interest) ? lead.interest.join(', ') : lead.interest || '-'}</td>
      <td>${formatDate(lead.timestamp)}</td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      <td>
        <button class="btn action-btn btn-outline" onclick="viewLeadDetail(${index})">상세</button>
        <select class="action-btn" onchange="updateLeadStatus(${index}, this.value)" style="padding: 0.25rem; font-size: 0.75rem; background: var(--color-bg-primary); color: var(--color-text-primary); border: 1px solid var(--color-border); border-radius: 0.25rem;">
          <option value="new" ${lead.status === 'new' ? 'selected' : ''}>신규</option>
          <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>연락완료</option>
          <option value="completed" ${lead.status === 'completed' ? 'selected' : ''}>처리완료</option>
        </select>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function filterLeads() {
  const searchTerm = elements.leadSearch.value.toLowerCase();
  const statusFilter = elements.leadStatusFilter.value;
  
  dashboardData.filteredLeads = dashboardData.leads.filter(lead => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm) ||
      lead.email.toLowerCase().includes(searchTerm) ||
      (lead.phone && lead.phone.includes(searchTerm)) ||
      (lead.memo && lead.memo.toLowerCase().includes(searchTerm));
    
    const matchesStatus = !statusFilter || lead.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  renderLeadsTable();
}

async function updateLeadStatus(index, newStatus) {
  const lead = dashboardData.filteredLeads[index];
  try {
    await adminApiRequest(`/api/admin/leads/${lead.email}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });
    
    lead.status = newStatus;
    renderLeadsTable();
    showAdminNotification('상태가 업데이트되었습니다.', 'success');
  } catch (error) {
    showAdminNotification('상태 업데이트 실패', 'error');
  }
}

function viewLeadDetail(index) {
  const lead = dashboardData.filteredLeads[index];
  
  elements.leadDetailBody.innerHTML = `
    <div class="lead-detail">
      <div class="detail-group">
        <label>이름</label>
        <p>${lead.name}</p>
      </div>
      <div class="detail-group">
        <label>이메일</label>
        <p>${lead.email}</p>
      </div>
      <div class="detail-group">
        <label>연락처</label>
        <p>${formatPhoneNumber(lead.phone)}</p>
      </div>
      <div class="detail-group">
        <label>관심 서비스</label>
        <p>${Array.isArray(lead.interest) ? lead.interest.join(', ') : lead.interest || '-'}</p>
      </div>
      <div class="detail-group">
        <label>상세 내용</label>
        <p>${lead.memo || '없음'}</p>
      </div>
      <div class="detail-group">
        <label>개인정보 동의</label>
        <p>${lead.agreePrivacy ? '동의' : '미동의'}</p>
      </div>
      <div class="detail-group">
        <label>신청일시</label>
        <p>${formatDate(lead.timestamp)}</p>
      </div>
      <div class="detail-group">
        <label>IP 주소</label>
        <p>${lead.ip || '-'}</p>
      </div>
    </div>
  `;
  
  elements.leadDetailModal.classList.remove('hidden');
}

// ===== 분석 기능 =====
async function loadAnalytics() {
  try {
    const dateRange = elements.analyticsDateRange.value;
    const analytics = await adminApiRequest(`/api/admin/analytics?days=${dateRange}`);
    
    dashboardData.analytics = analytics;
    renderAnalytics();
  } catch (error) {
    showAdminNotification('분석 데이터 로드 실패', 'error');
  }
}

function renderAnalytics() {
  const analytics = dashboardData.analytics;
  
  // 키워드 분석
  if (analytics.keywords && elements.keywordAnalysis) {
    elements.keywordAnalysis.innerHTML = '';
    analytics.keywords.forEach(keyword => {
      const item = document.createElement('div');
      item.className = 'keyword-item';
      item.innerHTML = `
        <span class="keyword-name">${keyword.word}</span>
        <span class="keyword-count">${keyword.count}회</span>
      `;
      elements.keywordAnalysis.appendChild(item);
    });
  }
  
  // 전환율 통계
  if (analytics.conversion && elements.conversionStats) {
    const conversionItems = elements.conversionStats.querySelectorAll('.conversion-rate');
    if (conversionItems.length >= 3) {
      conversionItems[0].textContent = `${analytics.conversion.visitorToSignup || 0}%`;
      conversionItems[1].textContent = `${analytics.conversion.signupToLead || 0}%`;
      conversionItems[2].textContent = `${analytics.conversion.chatToLead || 0}%`;
    }
  }
}

// ===== 탭 관리 =====
function switchTab(tabName) {
  // 탭 버튼 업데이트
  elements.tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // 탭 컨텐츠 업데이트
  elements.tabContents.forEach(content => {
    content.classList.toggle('active', content.id === tabName + 'Tab');
  });
  
  // 탭별 데이터 로드
  switch (tabName) {
    case 'users':
      if (dashboardData.users.length === 0) loadUsers();
      break;
    case 'leads':
      if (dashboardData.leads.length === 0) loadLeads();
      break;
    case 'analytics':
      loadAnalytics();
      break;
  }
}

// ===== 이벤트 리스너 설정 =====
function initAdminEventListeners() {
  // 관리자 로그인
  if (elements.adminLoginForm) {
    elements.adminLoginForm.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      await handleAdminLogin(formData);
    };
  }
  
  // 로그아웃
  if (elements.adminLogoutBtn) {
    elements.adminLogoutBtn.onclick = handleAdminLogout;
  }
  
  // 탭 전환
  elements.tabBtns.forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });
  
  // 검색 및 필터링
  if (elements.userSearch) {
    elements.userSearch.oninput = filterUsers;
  }
  
  if (elements.leadSearch) {
    elements.leadSearch.oninput = filterLeads;
  }
  
  if (elements.leadStatusFilter) {
    elements.leadStatusFilter.onchange = filterLeads;
  }
  
  // 새로고침 버튼
  if (elements.refreshUsers) {
    elements.refreshUsers.onclick = loadUsers;
  }
  
  if (elements.refreshLeads) {
    elements.refreshLeads.onclick = loadLeads;
  }
  
  // 분석 기간 변경
  if (elements.analyticsDateRange) {
    elements.analyticsDateRange.onchange = loadAnalytics;
  }
  
  // 모달 닫기
  if (elements.leadDetailClose) {
    elements.leadDetailClose.onclick = () => {
      elements.leadDetailModal.classList.add('hidden');
    };
  }
  
  if (elements.leadDetailModal) {
    elements.leadDetailModal.onclick = (e) => {
      if (e.target === elements.leadDetailModal) {
        elements.leadDetailModal.classList.add('hidden');
      }
    };
  }
  
  // ESC 키로 모달 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      elements.leadDetailModal.classList.add('hidden');
    }
  });
}

// ===== AI 기능 =====

// AI 요약 데이터 새로고침
async function refreshAISummary() {
  try {
    const response = await adminApiRequest('/api/admin/analytics/dashboard');
    
    // AI 요약 업데이트
    const weeklyChats = response.overview?.totalSessions || 0;
    const topService = response.topPages?.[0]?.title || '연구소 설립';
    const revenueRange = calculateRevenueRange(response.overview?.totalPageViews || 0);
    
    document.getElementById('aiWeeklyChats').textContent = weeklyChats + '건';
    document.getElementById('topService').textContent = topService;
    document.getElementById('revenueRange').textContent = revenueRange;
    
    showNotification('AI 요약이 업데이트되었습니다.', 'success');
  } catch (error) {
    showNotification('AI 요약 업데이트 실패: ' + error.message, 'error');
  }
}

// 매출 범주 계산
function calculateRevenueRange(pageViews) {
  if (pageViews < 100) return '100-300만원';
  if (pageViews < 500) return '300-600만원';
  if (pageViews < 1000) return '500-800만원';
  return '800만원+';
}

// 자동 FAQ 생성
async function generateAutoFAQ() {
  try {
    const response = await adminApiRequest('/api/admin/ai/faq');
    
    const faqList = document.getElementById('autoFAQList');
    if (response.length === 0) {
      faqList.innerHTML = '<div class="no-data">생성할 FAQ가 없습니다. 충분한 대화 로그가 쌓인 후 시도해주세요.</div>';
      return;
    }
    
    faqList.innerHTML = response.map(faq => `
      <div class="faq-item suggested" data-question="${faq.question}">
        <div class="faq-question">${faq.question}</div>
        <div class="faq-stats">
          <span class="frequency">${faq.frequency}회 질문</span>
          <span class="confidence">95% 신뢰도</span>
        </div>
        <div class="faq-actions">
          <button class="btn btn-outline btn-sm" onclick="approveAutoFAQ(this)">승인</button>
          <button class="btn btn-outline btn-sm" onclick="rejectAutoFAQ(this)">거부</button>
        </div>
      </div>
    `).join('');
    
    showNotification(`${response.length}개의 FAQ 후보가 생성되었습니다.`, 'success');
  } catch (error) {
    showNotification('FAQ 생성 실패: ' + error.message, 'error');
  }
}

// FAQ 승인
function approveAutoFAQ(button) {
  const faqItem = button.closest('.faq-item');
  const question = faqItem.dataset.question;
  
  // 실제 구현에서는 서버에 저장
  faqItem.style.background = 'var(--color-accent-light)';
  faqItem.querySelector('.faq-actions').innerHTML = '<span class="approved">✓ 승인됨</span>';
  
  showNotification(`FAQ가 승인되었습니다: ${question}`, 'success');
}

// FAQ 거부
function rejectAutoFAQ(button) {
  const faqItem = button.closest('.faq-item');
  faqItem.remove();
  showNotification('FAQ가 거부되었습니다.', 'info');
}

// 마케팅 문구 생성
async function generateMarketingContent() {
  const serviceSelect = document.getElementById('serviceSelect');
  const serviceId = serviceSelect.value;
  
  if (!serviceId) {
    showNotification('서비스를 선택해주세요.', 'error');
    return;
  }
  
  try {
    const response = await adminApiRequest('/api/admin/ai/marketing', {
      method: 'POST',
      body: JSON.stringify({ serviceId })
    });
    
    // 결과 표시
    document.getElementById('shortMarketing').textContent = response.shortVersions[0];
    document.getElementById('longMarketing').textContent = response.longVersions[0];
    document.getElementById('hashtagMarketing').textContent = response.hashtagVersions[0];
    
    document.getElementById('marketingResults').classList.remove('hidden');
    showNotification('홍보 문구가 생성되었습니다.', 'success');
  } catch (error) {
    showNotification('홍보 문구 생성 실패: ' + error.message, 'error');
  }
}

// 클립보드 복사
function copyToClipboard(elementId) {
  const element = document.getElementById(elementId);
  const text = element.textContent;
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showNotification('클립보드에 복사되었습니다.', 'success');
    }).catch(() => {
      fallbackCopyText(text);
    });
  } else {
    fallbackCopyText(text);
  }
}

// 클립보드 복사 폴백
function fallbackCopyText(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showNotification('클립보드에 복사되었습니다.', 'success');
  } catch (err) {
    showNotification('복사에 실패했습니다.', 'error');
  }
  document.body.removeChild(textarea);
}

// 지식 베이스 업데이트
async function updateKnowledgeBase() {
  const fileName = document.getElementById('knowledgeFileName').value.trim();
  const content = document.getElementById('knowledgeContent').value.trim();
  
  if (!fileName || !content) {
    showNotification('파일명과 내용을 모두 입력해주세요.', 'error');
    return;
  }
  
  try {
    await adminApiRequest('/api/admin/ai/knowledge', {
      method: 'POST',
      body: JSON.stringify({ fileName, content })
    });
    
    // 폼 초기화
    document.getElementById('knowledgeFileName').value = '';
    document.getElementById('knowledgeContent').value = '';
    
    showNotification('지식 베이스가 업데이트되었습니다.', 'success');
  } catch (error) {
    showNotification('지식 베이스 업데이트 실패: ' + error.message, 'error');
  }
}

// AI 기능 이벤트 리스너 초기화
function initAIEventListeners() {
  // AI 요약 새로고침
  const refreshAISummaryBtn = document.getElementById('refreshAISummary');
  if (refreshAISummaryBtn) {
    refreshAISummaryBtn.onclick = refreshAISummary;
  }
  
  // FAQ 생성
  const generateFAQBtn = document.getElementById('generateFAQ');
  if (generateFAQBtn) {
    generateFAQBtn.onclick = generateAutoFAQ;
  }
  
  // 마케팅 문구 생성
  const generateMarketingBtn = document.getElementById('generateMarketingBtn');
  if (generateMarketingBtn) {
    generateMarketingBtn.onclick = generateMarketingContent;
  }
  
  // 지식 베이스 업데이트
  const updateKnowledgeBtn = document.getElementById('updateKnowledgeBtn');
  if (updateKnowledgeBtn) {
    updateKnowledgeBtn.onclick = updateKnowledgeBase;
  }
}

// ===== 초기화 =====
function initAdmin() {
  console.log('🔧 어드민 대시보드 초기화 중...');
  
  initAdminEventListeners();
  initAIEventListeners();
  checkAdminAuth();
  
  console.log('✅ 어드민 초기화 완료');
}

// ===== 전역 함수 노출 =====
window.viewLeadDetail = viewLeadDetail;
window.updateLeadStatus = updateLeadStatus;
window.confirmDeleteUser = confirmDeleteUser;
window.viewUserDetail = (username) => {
  alert(`사용자 상세 기능은 추후 구현 예정입니다: ${username}`);
};
window.approveAutoFAQ = approveAutoFAQ;
window.rejectAutoFAQ = rejectAutoFAQ;
window.copyToClipboard = copyToClipboard;

// ===== 페이지 로드 후 초기화 =====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin;
}