/**
 * AI휴먼 플랫폼 - 프론트엔드 JavaScript
 * 기능: 인증, 챗봇, 폼 처리, UI 인터랙션
 */

// ===== 전역 변수 =====
let currentUser = null;
let csrfToken = null;
let chatHistory = [];
let cookieConsent = false;

// ===== DOM 요소 선택 =====
const elements = {
  // 인증 관련
  loginBtn: document.getElementById('loginBtn'),
  registerBtn: document.getElementById('registerBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  userMenu: document.getElementById('userMenu'),
  userName: document.getElementById('userName'),
  authButtons: document.querySelector('.auth-buttons'),
  
  // 모달 관련
  authModal: document.getElementById('authModal'),
  authModalTitle: document.getElementById('authModalTitle'),
  authModalClose: document.getElementById('authModalClose'),
  authToggleText: document.getElementById('authToggleText'),
  authToggleLink: document.getElementById('authToggleLink'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  
  // 챗봇 관련
  chatFloatBtn: document.getElementById('chatFloatBtn'),
  chatOverlay: document.getElementById('chatOverlay'),
  chatClose: document.getElementById('chatClose'),
  chatMessages: document.getElementById('chatMessages'),
  chatInput: document.getElementById('chatInput'),
  chatSend: document.getElementById('chatSend'),
  chatSuggestions: document.getElementById('chatSuggestions'),
  
  // 쿠키 배너
  cookieBanner: document.getElementById('cookieBanner'),
  cookieAccept: document.getElementById('cookieAccept'),
  cookieDecline: document.getElementById('cookieDecline'),
  
  // 기타
  contactForm: document.getElementById('contactForm'),
  quickConsultBtn: document.getElementById('quickConsultBtn'),
  mobileMenuBtn: document.getElementById('mobileMenuBtn')
};

// ===== 유틸리티 함수 =====
function showNotification(message, type = 'info') {
  // 간단한 알림 표시 (실제로는 toast 라이브러리 사용 권장)
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
    word-wrap: break-word;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function validateEmail(email) {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}

function validateUsername(username) {
  return username && username.length >= 3 && username.length <= 24 && /^[a-zA-Z0-9_]+$/.test(username);
}

function validatePassword(password) {
  // 최소 8자 이상 + 숫자/특수문자 포함
  const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/;
  return password && passwordRegex.test(password);
}

function validatePasswordStrength(password) {
  const checks = {
    length: password.length >= 8,
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*]/.test(password),
    letter: /[a-zA-Z]/.test(password)
  };
  
  return {
    isValid: Object.values(checks).every(check => check),
    checks
  };
}

// ===== API 함수 =====
async function apiRequest(url, options = {}) {
  const config = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };
  
  if (csrfToken && (config.method === 'POST' || config.method === 'PUT' || config.method === 'DELETE')) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  
  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || '요청 처리 중 오류가 발생했습니다.');
    }
    
    return data;
  } catch (error) {
    console.error('API 요청 오류:', error);
    throw error;
  }
}

// ===== 인증 관련 함수 =====
async function checkAuthStatus() {
  try {
    const userData = await apiRequest('/api/me');
    currentUser = userData;
    updateAuthUI();
    enableChatbot();
  } catch (error) {
    currentUser = null;
    updateAuthUI();
    disableChatbot();
  }
}

function updateAuthUI() {
  if (currentUser) {
    elements.authButtons.style.display = 'none';
    elements.userMenu.style.display = 'flex';
    elements.userName.textContent = currentUser.username;
  } else {
    elements.authButtons.style.display = 'flex';
    elements.userMenu.style.display = 'none';
  }
}

function enableChatbot() {
  elements.chatInput.disabled = false;
  elements.chatSend.disabled = false;
  elements.chatInput.placeholder = '메시지를 입력하세요...';
  
  // 초기 메시지 업데이트
  if (elements.chatMessages.children.length === 1) {
    elements.chatMessages.innerHTML = `
      <div class="chat-message bot">
        <div class="message-content">
          안녕하세요! AI휴먼 상담 챗봇입니다. 어떤 행정 대행 서비스에 관심이 있으신가요?
          
          주요 서비스:
          • 연구소/벤처기업 등록
          • 이노비즈/메인비즈 인증
          • 나라장터 등록
          • 기타 행정 인증 대행
        </div>
      </div>
    `;
  }
}

function disableChatbot() {
  elements.chatInput.disabled = true;
  elements.chatSend.disabled = true;
  elements.chatInput.placeholder = '로그인 후 이용 가능합니다';
}

async function handleLogin(formData) {
  try {
    const result = await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        username: formData.get('username'),
        password: formData.get('password')
      })
    });
    
    csrfToken = result.csrfToken;
    currentUser = { username: result.username };
    
    closeModal();
    updateAuthUI();
    enableChatbot();
    showNotification('로그인되었습니다.', 'success');
    
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

async function handleRegister(formData) {
  const username = formData.get('username');
  const email = formData.get('email');
  const password = formData.get('password');
  const phone = formData.get('phone');
  const agreePrivacy = formData.get('agreePrivacy');
  
  // 클라이언트 검증
  if (!validateUsername(username)) {
    showNotification('사용자명은 3-24자의 영문, 숫자, 언더스코어만 가능합니다.', 'error');
    return;
  }
  
  if (!validateEmail(email)) {
    showNotification('올바른 이메일 주소를 입력해주세요.', 'error');
    return;
  }
  
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.isValid) {
    let errorMsg = '비밀번호는 다음 조건을 만족해야 합니다:\n';
    if (!passwordValidation.checks.length) errorMsg += '• 8자 이상\n';
    if (!passwordValidation.checks.number) errorMsg += '• 숫자 포함\n';
    if (!passwordValidation.checks.special) errorMsg += '• 특수문자 포함\n';
    if (!passwordValidation.checks.letter) errorMsg += '• 영문자 포함\n';
    
    showNotification(errorMsg, 'error');
    return;
  }
  
  if (!agreePrivacy) {
    showNotification('개인정보 처리방침에 동의해주세요.', 'error');
    return;
  }
  
  try {
    const result = await apiRequest('/api/register', {
      method: 'POST',
      body: JSON.stringify({
        username,
        email,
        password,
        phone,
        agreePrivacy: true
      })
    });
    
    showNotification('회원가입이 완료되었습니다. 로그인해주세요.', 'success');
    switchToLogin();
    
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

async function handleLogout() {
  try {
    await apiRequest('/api/logout', { method: 'POST' });
    currentUser = null;
    csrfToken = null;
    chatHistory = [];
    
    updateAuthUI();
    disableChatbot();
    
    // 챗봇 메시지 초기화
    elements.chatMessages.innerHTML = `
      <div class="chat-message bot">
        <div class="message-content">
          안녕하세요! AI휴먼 상담 챗봇입니다. 로그인 후 이용 가능합니다.
        </div>
      </div>
    `;
    
    showNotification('로그아웃되었습니다.', 'success');
    
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// ===== 챗봇 관련 함수 =====
async function sendChatMessage(message, aiMode = false) {
  if (!currentUser) {
    showNotification('로그인이 필요합니다.', 'error');
    return;
  }
  
  try {
    // 사용자 메시지 표시
    addChatMessage(message, 'user');
    
    // 로딩 메시지 표시
    const loadingId = addChatMessage('...', 'bot', true);
    
    const startTime = Date.now();
    
    const response = await apiRequest('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        context: { history: chatHistory },
        aiMode: aiMode || getChatAIMode()
      })
    });
    
    const responseTime = Date.now() - startTime;
    
    // 로딩 메시지 제거
    removeChatMessage(loadingId);
    
    // 봇 응답 표시 (AI 모드 배지 포함)
    addChatMessage(response.message, 'bot', false, {
      mode: response.mode,
      sources: response.sources,
      responseTime,
      cached: response.cached
    });
    
    // 제안 버튼 업데이트
    if (response.suggestions && response.suggestions.length > 0) {
      updateChatSuggestions(response.suggestions);
    }
    
    // 히스토리 저장
    chatHistory.push(
      { role: 'user', message },
      { role: 'bot', message: response.message, intent: response.intent, mode: response.mode }
    );
    
    // 히스토리 길이 제한
    if (chatHistory.length > 20) {
      chatHistory = chatHistory.slice(-20);
    }
    
  } catch (error) {
    addChatMessage('죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'bot');
    showNotification(error.message, 'error');
  }
}

function addChatMessage(message, sender, isLoading = false, metadata = {}) {
  const messageElement = document.createElement('div');
  const messageId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  messageElement.id = messageId;
  messageElement.className = `chat-message ${sender}`;
  
  let content = '';
  
  if (isLoading) {
    content = `
      <div class="message-content loading">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
  } else {
    // AI 모드 배지 추가
    let badge = '';
    if (sender === 'bot' && metadata.mode) {
      if (metadata.mode === 'ai') {
        badge = '<div class="ai-badge">🤖 AI 보강 응답</div>';
      } else if (metadata.mode === 'fallback') {
        badge = '<div class="fallback-badge">⚠️ 규칙 기반 응답</div>';
      }
    }
    
    content = `
      ${badge}
      <div class="message-content">${message.replace(/\\n/g, '<br>')}</div>
    `;
    
    // 소스 정보 추가
    if (metadata.sources && metadata.sources.length > 0) {
      content += `
        <div class="message-sources">
          <div class="sources-label">참고:</div>
          <div class="sources-list">
            ${metadata.sources.map(source => `<span class="source-item">${source}</span>`).join(', ')}
          </div>
        </div>
      `;
    }
    
    // 응답 시간 및 캐시 정보
    if (metadata.responseTime) {
      let timeInfo = `${metadata.responseTime}ms`;
      if (metadata.cached) {
        timeInfo += ' (캐시됨)';
      }
      content += `<div class="response-time">${timeInfo}</div>`;
    }
  }
  
  messageElement.innerHTML = content;
  
  elements.chatMessages.appendChild(messageElement);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  
  return messageId;
}

function removeChatMessage(messageId) {
  const messageElement = document.getElementById(messageId);
  if (messageElement) {
    messageElement.remove();
  }
}

// AI 모드 상태 관리
function getChatAIMode() {
  const toggle = document.getElementById('aiModeToggle');
  return toggle ? toggle.checked : false;
}

function toggleAIMode() {
  const toggle = document.getElementById('aiModeToggle');
  if (toggle) {
    toggle.checked = !toggle.checked;
    updateAIModeUI();
  }
}

function updateAIModeUI() {
  const isAIMode = getChatAIMode();
  const indicator = document.getElementById('aiModeIndicator');
  
  if (indicator) {
    indicator.textContent = isAIMode ? 'AI 모드' : '규칙 모드';
    indicator.className = `ai-mode-indicator ${isAIMode ? 'ai-active' : 'rule-active'}`;
  }
}

function updateChatSuggestions(suggestions) {
  elements.chatSuggestions.innerHTML = '';
  suggestions.forEach(suggestion => {
    const button = document.createElement('button');
    button.className = 'suggestion-btn';
    button.textContent = suggestion;
    button.onclick = () => {
      elements.chatInput.value = suggestion;
      handleChatSend();
    };
    elements.chatSuggestions.appendChild(button);
  });
}

function handleChatSend() {
  const message = elements.chatInput.value.trim();
  if (!message) return;
  
  elements.chatInput.value = '';
  sendChatMessage(message);
}

// ===== 폼 처리 =====
async function handleContactForm(formData) {
  const name = formData.get('name');
  const email = formData.get('email');
  const phone = formData.get('phone');
  const interest = formData.getAll('interest');
  const memo = formData.get('memo');
  const agreePrivacy = formData.get('agreePrivacy');
  
  // 스팸 방지 검사
  if (!checkSpamPrevention()) {
    showNotification('너무 빠른 제출입니다. 잠시 후 다시 시도해주세요.', 'error');
    return;
  }
  
  // 검증
  if (!name || !email) {
    showNotification('이름과 이메일은 필수입니다.', 'error');
    return;
  }
  
  if (!validateEmail(email)) {
    showNotification('올바른 이메일 주소를 입력해주세요.', 'error');
    return;
  }
  
  if (!agreePrivacy) {
    showNotification('개인정보 처리방침에 동의해주세요.', 'error');
    return;
  }
  
  try {
    recordFormSubmission();
    
    const result = await apiRequest('/api/lead', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        phone,
        interest,
        memo,
        agreePrivacy: true
      })
    });
    
    showNotification(result.message, 'success');
    elements.contactForm.reset();
    
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// ===== 모달 관련 함수 =====
function openModal(type = 'login') {
  elements.authModal.classList.remove('hidden');
  
  if (type === 'login') {
    switchToLogin();
  } else {
    switchToRegister();
  }
  
  // 첫 번째 입력 필드에 포커스
  setTimeout(() => {
    const firstInput = elements.authModal.querySelector('input:not([type="checkbox"])');
    if (firstInput) firstInput.focus();
  }, 100);
}

function closeModal() {
  elements.authModal.classList.add('hidden');
  
  // 폼 리셋
  elements.loginForm.reset();
  elements.registerForm.reset();
}

function switchToLogin() {
  elements.authModalTitle.textContent = '로그인';
  elements.loginForm.classList.remove('hidden');
  elements.registerForm.classList.add('hidden');
  elements.authToggleText.innerHTML = '계정이 없으신가요? <a href="#" id="authToggleLink">회원가입</a>';
  
  // 이벤트 리스너 재연결
  const newToggleLink = document.getElementById('authToggleLink');
  newToggleLink.onclick = (e) => {
    e.preventDefault();
    switchToRegister();
  };
}

function switchToRegister() {
  elements.authModalTitle.textContent = '회원가입';
  elements.loginForm.classList.add('hidden');
  elements.registerForm.classList.remove('hidden');
  elements.authToggleText.innerHTML = '이미 계정이 있으신가요? <a href="#" id="authToggleLink">로그인</a>';
  
  // 이벤트 리스너 재연결
  const newToggleLink = document.getElementById('authToggleLink');
  newToggleLink.onclick = (e) => {
    e.preventDefault();
    switchToLogin();
  };
}

// ===== FAQ 아코디언 =====
function initFAQ() {
  const faqItems = document.querySelectorAll('.faq-item');
  
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    question.onclick = () => {
      const isActive = item.classList.contains('active');
      
      // 모든 FAQ 항목 닫기
      faqItems.forEach(faqItem => {
        faqItem.classList.remove('active');
      });
      
      // 클릭된 항목 토글
      if (!isActive) {
        item.classList.add('active');
      }
    };
  });
}

// ===== 쿠키 관리 =====
function checkCookieConsent() {
  const consent = localStorage.getItem('cookieConsent');
  if (consent === 'true') {
    cookieConsent = true;
    return true;
  } else if (consent === 'false') {
    cookieConsent = false;
    return false;
  }
  
  // 첫 방문자 - 배너 표시
  if (elements.cookieBanner) {
    setTimeout(() => {
      elements.cookieBanner.classList.add('show');
    }, 2000); // 2초 후 표시
  }
  return null;
}

function setCookieConsent(consent) {
  cookieConsent = consent;
  localStorage.setItem('cookieConsent', consent.toString());
  
  if (elements.cookieBanner) {
    elements.cookieBanner.classList.remove('show');
  }
  
  if (consent) {
    // 쿠키 동의 시 분석 스크립트 등 활성화
    enableAnalytics();
  }
}

function enableAnalytics() {
  // 간단한 방문자 추적 (쿠키 동의 시에만)
  if (cookieConsent) {
    const visitData = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      page: window.location.pathname
    };
    
    // 서버로 전송 (실제 구현 시)
    console.log('Analytics data:', visitData);
  }
}

// ===== 스팸 방지 기능 =====
let formSubmissionCount = 0;
let lastSubmissionTime = 0;

function checkSpamPrevention() {
  const now = Date.now();
  const timeSinceLastSubmission = now - lastSubmissionTime;
  
  // 5초 이내 재제출 방지
  if (timeSinceLastSubmission < 5000) {
    return false;
  }
  
  // 1분 내 3회 이상 제출 방지
  if (formSubmissionCount >= 3 && timeSinceLastSubmission < 60000) {
    return false;
  }
  
  return true;
}

function recordFormSubmission() {
  const now = Date.now();
  
  // 1분이 지났으면 카운트 리셋
  if (now - lastSubmissionTime > 60000) {
    formSubmissionCount = 0;
  }
  
  formSubmissionCount++;
  lastSubmissionTime = now;
}

function generateSimpleCaptcha() {
  const num1 = Math.floor(Math.random() * 9) + 1;
  const num2 = Math.floor(Math.random() * 9) + 1;
  const operations = ['+', '-', '*'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  
  let answer;
  switch (operation) {
    case '+':
      answer = num1 + num2;
      break;
    case '-':
      answer = Math.abs(num1 - num2);
      break;
    case '*':
      answer = num1 * num2;
      break;
  }
  
  return {
    question: `${num1} ${operation} ${num2} = ?`,
    answer: answer
  };
}

// ===== 스크롤 애니메이션 =====
function initScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'slideUp 0.6s ease-out forwards';
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  // 애니메이션 대상 요소들
  const animatedElements = document.querySelectorAll(
    '.service-card, .pricing-card, .product-card, .trust-card'
  );
  
  animatedElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(1rem)';
    observer.observe(el);
  });
}

// ===== 반응형 네비게이션 =====
function initMobileMenu() {
  if (!elements.mobileMenuBtn) return;
  
  elements.mobileMenuBtn.onclick = () => {
    const navLinks = document.querySelector('.nav-links');
    const isOpen = navLinks.style.display === 'flex';
    
    if (isOpen) {
      navLinks.style.display = 'none';
    } else {
      navLinks.style.display = 'flex';
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.top = '100%';
      navLinks.style.left = '0';
      navLinks.style.right = '0';
      navLinks.style.backgroundColor = 'var(--color-bg-card)';
      navLinks.style.padding = 'var(--spacing-md)';
      navLinks.style.border = '1px solid var(--color-border)';
      navLinks.style.borderRadius = 'var(--radius-md)';
      navLinks.style.margin = 'var(--spacing-sm)';
      navLinks.style.boxShadow = 'var(--shadow-lg)';
    }
  };
}

// ===== 이벤트 리스너 설정 =====
function initEventListeners() {
  // 인증 버튼들
  if (elements.loginBtn) {
    elements.loginBtn.onclick = () => openModal('login');
  }
  
  if (elements.registerBtn) {
    elements.registerBtn.onclick = () => openModal('register');
  }
  
  if (elements.logoutBtn) {
    elements.logoutBtn.onclick = handleLogout;
  }
  
  // 모달 관련
  if (elements.authModalClose) {
    elements.authModalClose.onclick = closeModal;
  }
  
  if (elements.authModal) {
    elements.authModal.onclick = (e) => {
      if (e.target === elements.authModal) {
        closeModal();
      }
    };
  }
  
  if (elements.authToggleLink) {
    elements.authToggleLink.onclick = (e) => {
      e.preventDefault();
      const isLogin = elements.loginForm.classList.contains('hidden');
      if (isLogin) {
        switchToLogin();
      } else {
        switchToRegister();
      }
    };
  }
  
  // 폼 제출
  if (elements.loginForm) {
    elements.loginForm.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      await handleLogin(formData);
    };
  }
  
  if (elements.registerForm) {
    elements.registerForm.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      await handleRegister(formData);
    };
  }
  
  if (elements.contactForm) {
    elements.contactForm.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      await handleContactForm(formData);
    };
  }
  
  // 챗봇 관련
  if (elements.chatFloatBtn) {
    elements.chatFloatBtn.onclick = () => {
      elements.chatOverlay.classList.remove('hidden');
      setTimeout(() => {
        if (currentUser) {
          elements.chatInput.focus();
        }
      }, 100);
    };
  }
  
  if (elements.chatClose) {
    elements.chatClose.onclick = () => {
      elements.chatOverlay.classList.add('hidden');
    };
  }
  
  if (elements.chatOverlay) {
    elements.chatOverlay.onclick = (e) => {
      if (e.target === elements.chatOverlay) {
        elements.chatOverlay.classList.add('hidden');
      }
    };
  }
  
  if (elements.chatSend) {
    elements.chatSend.onclick = handleChatSend;
  }
  
  if (elements.chatInput) {
    elements.chatInput.onkeypress = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleChatSend();
      }
    };
  }
  
  // AI 모드 토글
  const aiModeToggle = document.getElementById('aiModeToggle');
  if (aiModeToggle) {
    aiModeToggle.onchange = updateAIModeUI;
    updateAIModeUI(); // 초기 상태 설정
  }

  // 쿠키 배너
  if (elements.cookieAccept) {
    elements.cookieAccept.onclick = () => setCookieConsent(true);
  }
  
  if (elements.cookieDecline) {
    elements.cookieDecline.onclick = () => setCookieConsent(false);
  }
  
  // 빠른 상담 버튼
  if (elements.quickConsultBtn) {
    elements.quickConsultBtn.onclick = () => {
      if (currentUser) {
        elements.chatOverlay.classList.remove('hidden');
        setTimeout(() => elements.chatInput.focus(), 100);
      } else {
        openModal('login');
      }
    };
  }
  
  // 키보드 이벤트
  document.addEventListener('keydown', (e) => {
    // ESC 키로 모달 닫기
    if (e.key === 'Escape') {
      if (!elements.authModal.classList.contains('hidden')) {
        closeModal();
      }
      if (!elements.chatOverlay.classList.contains('hidden')) {
        elements.chatOverlay.classList.add('hidden');
      }
    }
  });
  
  // 윈도우 크기 변경 시 모바일 메뉴 초기화
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      const navLinks = document.querySelector('.nav-links');
      if (navLinks) {
        navLinks.style.display = '';
        navLinks.style.flexDirection = '';
        navLinks.style.position = '';
        navLinks.style.top = '';
        navLinks.style.left = '';
        navLinks.style.right = '';
        navLinks.style.backgroundColor = '';
        navLinks.style.padding = '';
        navLinks.style.border = '';
        navLinks.style.borderRadius = '';
        navLinks.style.margin = '';
        navLinks.style.boxShadow = '';
      }
    }
  });
}

// ===== 초기화 =====
function init() {
  console.log('🚀 AI휴먼 플랫폼 초기화 중...');
  
  // 기본 기능 초기화
  initEventListeners();
  initFAQ();
  initMobileMenu();
  
  // 쿠키 동의 상태 확인
  checkCookieConsent();
  
  // 인증 상태 확인
  checkAuthStatus();
  
  // 시각적 효과 (브라우저가 지원하는 경우에만)
  if ('IntersectionObserver' in window) {
    initScrollAnimations();
  }
  
  console.log('✅ 초기화 완료');
}

// ===== 페이지 로드 후 초기화 =====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ===== 전역 함수 노출 (디버깅용) =====
window.AIHuman = {
  currentUser: () => currentUser,
  chatHistory: () => chatHistory,
  sendMessage: sendChatMessage,
  showNotification,
  checkAuth: checkAuthStatus
};