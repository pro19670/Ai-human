/**
 * 입찰 제안서 대행 서비스 - 전용 JavaScript
 * 기능: 패키지 선택, 견적 문의, UI 인터랙션
 */

// ===== 전역 변수 =====
let selectedPackage = null;
let leadScore = 0;

// ===== DOM 요소 선택 =====
const biddingElements = {
  packageBtns: document.querySelectorAll('.btn-package'),
  inquiryForm: document.getElementById('biddingInquiryForm'),
  deadlineInput: document.getElementById('inquiry-deadline'),
  budgetSelect: document.getElementById('inquiry-budget'),
  packageSelect: document.getElementById('inquiry-package')
};

// ===== 패키지 선택 핸들러 =====
function initPackageSelection() {
  biddingElements.packageBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const packageType = e.target.dataset.package;
      selectPackage(packageType);
    });
  });
}

function selectPackage(packageType) {
  selectedPackage = packageType;
  
  // 비주얼 업데이트
  document.querySelectorAl('.package-card').forEach(card => {
    card.classList.remove('selected');
  });
  
  const selectedCard = document.querySelector(`[data-package="${packageType}"]`).closest('.package-card');
  selectedCard.classList.add('selected');
  
  // 폼에 자동 설정
  if (biddingElements.packageSelect) {
    biddingElements.packageSelect.value = packageType;
  }
  
  // 문의 폼으로 스크롤
  scrollToSection('inquiry-form');
  
  // 분석 이벤트
  if (window.gtag) {
    gtag('event', 'package_select', {
      'event_category': 'bidding',
      'event_label': `package_${packageType}`,
      'value': packageType
    });
  }
}

// ===== 리드 스코어링 =====
function calculateLeadScore() {
  let score = 0;
  
  // 마감일 점수
  const deadline = biddingElements.deadlineInput?.value;
  if (deadline) {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const daysLeft = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysLeft >= 10) score += 3;
    else if (daysLeft >= 3) score += 1;
    
    // D-2 이하는 경고 표시
    if (daysLeft <= 2) {
      showWarning('마감일이 임박했습니다. 급행 서비스가 필요할 수 있습니다.');
    }
  }
  
  // 예산 점수
  const budget = biddingElements.budgetSelect?.value;
  if (budget && budget !== '협의' && budget !== '') {
    score += 2;
  }
  
  // RFP 파일 점수
  const rfpFile = document.getElementById('inquiry-rfp')?.value;
  if (rfpFile) {
    score += 1;
  }
  
  leadScore = score;
  return score;
}

// ===== 폼 제출 핸들러 =====
function initInquiryForm() {
  if (!biddingElements.inquiryForm) return;
  
  biddingElements.inquiryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(elements.inquiryForm);
    const data = Object.fromEntries(formData.entries());
    
    // 리드 스코어 계산
    const score = calculateLeadScore();
    
    // 로딩 상태
    const submitBtn = biddingElements.inquiryForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '전송 중...';
    submitBtn.disabled = true;
    
    try {
      const response = await fetch('/api/bidding/inquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        showSuccess(`견적 문의가 접수되었습니다! (리드 스코어: ${result.score}/6점)`);
        biddingElements.inquiryForm.reset();
        
        // 분석 이벤트
        if (window.gtag) {
          gtag('event', 'bidding_inquiry', {
            'event_category': 'lead',
            'event_label': data.package_type,
            'value': result.score
          });
        }
        
        // 성공 페이지로 이동하거나 추가 안내
        setTimeout(() => {
          showBiddingSuccessModal(result);
        }, 1000);
        
      } else {
        throw new Error(result.error || '전송에 실패했습니다.');
      }
      
    } catch (error) {
      console.error('문의 전송 오류:', error);
      showError(error.message);
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
  
  // 실시간 스코어링
  biddingElements.deadlineInput?.addEventListener('change', calculateLeadScore);
  biddingElements.budgetSelect?.addEventListener('change', calculateLeadScore);
  document.getElementById('inquiry-rfp')?.addEventListener('input', calculateLeadScore);
}

// ===== 성공 모달 표시 =====
function showBiddingSuccessModal(result) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content success-modal">
      <div class="modal-header">
        <h3>✅ 견적 문의 접수 완료</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="success-info">
          <div class="info-item">
            <strong>문의 번호:</strong> ${result.leadId}
          </div>
          <div class="info-item">
            <strong>리드 스코어:</strong> ${result.score}/6점
          </div>
          <div class="info-item">
            <strong>예상 응답:</strong> 24시간 이내
          </div>
        </div>
        
        <div class="next-steps">
          <h4>📋 다음 단계</h4>
          <ol>
            <li>담당자가 24시간 내 연락드립니다</li>
            <li>프로젝트 상세 논의 및 견적 제공</li>
            <li>계약 체결 및 킥오프 미팅</li>
            <li>14일 프로세스 진행</li>
          </ol>
        </div>
        
        <div class="contact-info">
          <h4>🔔 급한 문의</h4>
          <p>📞 <a href="tel:02-0000-0000">02-0000-0000</a></p>
          <p>📧 <a href="mailto:bidding@aihuman.example">bidding@aihuman.example</a></p>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary modal-confirm">확인</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // 모달 닫기 이벤트
  const closeModal = () => {
    document.body.removeChild(modal);
  };
  
  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.querySelector('.modal-confirm').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
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
        entry.target.classList.add('animate-in');
      }
    });
  }, observerOptions);
  
  // 애니메이션 대상 요소들
  const animateElements = document.querySelectorAll(`
    .package-card,
    .timeline-item,
    .diff-item,
    .info-card
  `);
  
  animateElements.forEach(el => {
    observer.observe(el);
  });
}

// ===== 유틸리티 함수들 =====
function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}

function showWarning(message) {
  showNotification(message, 'warning');
}

function showSuccess(message) {
  showNotification(message, 'success');
}

function showError(message) {
  showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-message">${message}</span>
      <button class="notification-close">&times;</button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // 자동 제거
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
  
  // 수동 제거
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.remove();
  });
}

// ===== 마감일 입력 제한 =====
function initDateRestrictions() {
  if (biddingElements.deadlineInput) {
    // 오늘 날짜부터만 선택 가능
    const today = new Date().toISOString().split('T')[0];
    biddingElements.deadlineInput.min = today;
    
    // 1년 후까지만 선택 가능
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 1);
    biddingElements.deadlineInput.max = maxDate.toISOString().split('T')[0];
  }
}

// ===== 패키지별 가격 계산기 =====
function initPriceCalculator() {
  const packageCards = document.querySelectorAll('.package-card');
  
  packageCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      // 호버 시 상세 정보 표시
      const packageType = card.querySelector('.btn-package')?.dataset.package;
      if (packageType) {
        showPackageDetails(packageType, card);
      }
    });
  });
}

function showPackageDetails(packageType, card) {
  const details = {
    'A': {
      basePrice: 50,
      maxPrice: 200,
      days: '3-5일',
      features: ['RFP 분석', '경쟁 분석', 'Win Theme']
    },
    'B': {
      basePrice: 200,
      maxPrice: 1000,
      days: '7-14일',
      features: ['패키지 A + 제안서 작성', '디자인', '2회 수정']
    },
    'C': {
      basePrice: 300,
      maxPrice: 1500,
      days: '10-14일',
      features: ['패키지 B + 발표 자료', '코칭', '현장 대행']
    }
  };
  
  const detail = details[packageType];
  if (!detail) return;
  
  // 툴팁 또는 상세 정보 표시 로직
  console.log(`패키지 ${packageType} 상세:`, detail);
}

// ===== 초기화 =====
function initBiddingPage() {
  console.log('🎯 입찰 페이지 초기화 중...');
  
  // 기본 기능 초기화
  initPackageSelection();
  initInquiryForm();
  initDateRestrictions();
  initPriceCalculator();
  
  // 시각적 효과
  if ('IntersectionObserver' in window) {
    initScrollAnimations();
  }
  
  // URL 파라미터 처리 (외부 링크에서 특정 패키지로 이동)
  const urlParams = new URLSearchParams(window.location.search);
  const selectedPkg = urlParams.get('package');
  if (selectedPkg && ['A', 'B', 'C'].includes(selectedPkg)) {
    setTimeout(() => selectPackage(selectedPkg), 500);
  }
  
  console.log('✅ 입찰 페이지 초기화 완료');
}

// ===== 페이지 로드 후 초기화 =====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBiddingPage);
} else {
  initBiddingPage();
}

// ===== 전역 함수 노출 (디버깅용) =====
window.BiddingService = {
  selectPackage,
  calculateLeadScore,
  scrollToSection,
  leadScore: () => leadScore,
  selectedPackage: () => selectedPackage
};