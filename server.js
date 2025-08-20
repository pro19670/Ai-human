/**
 * AI휴먼 플랫폼 서버 - 무패키지 Node.js 구현
 * 기능: 회원가입/로그인(PBKDF2), AI챗봇, 리드수집, 정적파일 서빙
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');
const querystring = require('querystring');

// AI 서비스 모듈
const AIService = require('./ai_service');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

// 데이터 파일 경로
const USERS_FILE = path.join(DATA_DIR, 'users.jsonl');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.jsonl');
const LEADS_FILE = path.join(DATA_DIR, 'leads.jsonl');
const BIDDING_PROJECTS_FILE = path.join(DATA_DIR, 'bidding_projects.jsonl'); // 입찰 프로젝트 데이터

// 메모리 저장소
let users = new Map();
let sessions = new Map();
let rateLimiter = new Map();
let leads = [];
let chatLogs = [];
let biddingProjects = new Map(); // 입찰 프로젝트 저장소
let analytics = {
  visitors: [],
  keywords: new Map(),
  conversions: { visitorToSignup: 0, signupToLead: 0, chatToLead: 0 }
};

// PBKDF2 설정
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 32;
const HASH_LENGTH = 64;

// CSRF 토큰 저장소
const csrfTokens = new Map();

// AI 서비스 초기화
let aiService = null;
try {
  aiService = new AIService();
  console.log('✅ AI 서비스 초기화 완료');
} catch (error) {
  console.log('⚠️  AI 서비스 초기화 실패:', error.message);
}

// 서비스 목록 (챗봇용)
const SERVICES = [
  { name: '연구소 신설·연장', difficulty: '상', price: '100만', description: '연구소 설립 및 연장 신청 대행' },
  { name: '벤처기업 등록·연장', difficulty: '상', price: '100만', description: '벤처기업 확인 등록 및 연장' },
  { name: '전문연구기관 등록·연장', difficulty: '상', price: '200만', description: '전문연구기관 신규 등록 및 연장' },
  { name: '이노비즈 등록·연장', difficulty: '중', price: '50만', description: '기술혁신형 중소기업 인증' },
  { name: '메인비즈 등록·연장', difficulty: '중', price: '50만', description: '주력기업 확인 등록' },
  { name: '중소기업확인증 등록·연장', difficulty: '중', price: '30만', description: '중소기업 확인서 발급 대행' },
  { name: '직접생산증명원 등록·연장', difficulty: '중', price: '30만', description: '직접생산 증명서 발급' },
  { name: '하이서울 인증', difficulty: '상', price: '100만', description: '서울시 우수기업 인증' },
  { name: '강소기업 등록', difficulty: '상', price: '100만', description: '강소기업 확인 등록' },
  { name: 'GS 인증 등록', difficulty: '극상', price: '200만', description: 'GS(Good Software) 인증' },
  { name: '나라장터 등록', difficulty: '상', price: '300만', description: '국가종합전자조달시스템 등록' },
  { name: '소프트웨어 사업자 등록', difficulty: '중', price: '30만', description: 'SW사업자 신고 대행' },
  { name: '차량 등록·이전', difficulty: '하', price: '20만', description: '자동차 등록 및 이전 대행' },
  { name: '통신판매업 신고', difficulty: '중', price: '30만', description: '온라인 판매업 신고' },
  { name: '공장등록', difficulty: '중', price: '50만', description: '제조업 공장 등록 신청' }
];

// 블로그 포스트 데이터
let blogPosts = new Map();
const BLOG_DATA_FILE = path.join(__dirname, 'data', 'blog_posts.jsonl');

// 입찰 프로젝트 데이터
let biddingProjectsData = new Map();
const BIDDING_DATA_FILE = path.join(__dirname, 'data', 'bidding_projects.jsonl');

// 블로그 데이터 로드
function loadBlogPosts() {
  try {
    if (fs.existsSync(BLOG_DATA_FILE)) {
      const data = fs.readFileSync(BLOG_DATA_FILE, 'utf8');
      const lines = data.trim().split('\\n');
      
      lines.forEach(line => {
        if (line.trim()) {
          const post = JSON.parse(line);
          blogPosts.set(post.id, post);
        }
      });
      
      console.log(`✅ 블로그 포스트 ${blogPosts.size}개 로드됨`);
    } else {
      console.log('📝 블로그 데이터 파일이 없습니다. 새로 생성됩니다.');
      ensureBlogDataDirectory();
    }
  } catch (error) {
    console.error('블로그 데이터 로드 오류:', error);
  }
}

// 입찰 프로젝트 데이터 로드
function loadBiddingProjects() {
  try {
    if (fs.existsSync(BIDDING_DATA_FILE)) {
      const data = fs.readFileSync(BIDDING_DATA_FILE, 'utf8');
      const lines = data.trim().split('\\n');
      
      lines.forEach(line => {
        if (line.trim()) {
          const project = JSON.parse(line);
          biddingProjectsData.set(project.id, project);
        }
      });
      
      console.log(`✅ 입찰 프로젝트 ${biddingProjectsData.size}개 로드됨`);
    } else {
      console.log('📝 입찰 프로젝트 데이터 파일이 없습니다. 새로 생성됩니다.');
      ensureBiddingDataDirectory();
    }
  } catch (error) {
    console.error('입찰 프로젝트 데이터 로드 오류:', error);
  }
}

// 입찰 프로젝트 데이터 저장
function saveBiddingProject(project) {
  try {
    biddingProjectsData.set(project.id, project);
    
    // 전체 데이터를 다시 저장 (업데이트 지원)
    const allProjects = Array.from(biddingProjectsData.values());
    const dataLines = allProjects.map(p => JSON.stringify(p)).join('\\n');
    
    if (!fs.existsSync(path.dirname(BIDDING_DATA_FILE))) {
      fs.mkdirSync(path.dirname(BIDDING_DATA_FILE), { recursive: true });
    }
    
    fs.writeFileSync(BIDDING_DATA_FILE, dataLines + '\\n', 'utf8');
    return true;
  } catch (error) {
    console.error('입찰 프로젝트 저장 오류:', error);
    return false;
  }
}

function ensureBiddingDataDirectory() {
  if (!fs.existsSync(path.dirname(BIDDING_DATA_FILE))) {
    fs.mkdirSync(path.dirname(BIDDING_DATA_FILE), { recursive: true });
  }
  
  // 기본 데모 프로젝트 생성
  const demoProject = {
    id: 'demo-project-001',
    title: 'AI 기반 스마트시티 플랫폼 구축 제안서',
    client: '○○시청',
    status: 'completed',
    package: 'C',
    deadline: '2025-09-15',
    budget: 500,
    phase: 'delivered',
    score: 87.5,
    created: '2025-08-01T09:00:00.000Z',
    updated: '2025-08-15T18:30:00.000Z',
    manager: 'admin',
    description: '스마트시티 통합 플랫폼 구축을 위한 기술제안서 작성 및 발표 대행',
    deliverables: [
      { type: 'analysis', name: 'RFP 분석보고서', status: 'completed', file: 'RFP_분석보고서_v1.0.pdf', updated: '2025-08-05' },
      { type: 'proposal', name: '기술제안서', status: 'completed', file: '기술제안서_최종본_v3.2.hwp', updated: '2025-08-12' },
      { type: 'presentation', name: '발표자료', status: 'completed', file: '발표자료_PT_v2.1.pptx', updated: '2025-08-14' }
    ],
    milestones: [
      { phase: 'kickoff', name: '킥오프 미팅', status: 'completed', date: '2025-08-01' },
      { phase: 'analysis', name: 'RFP 분석 완료', status: 'completed', date: '2025-08-05' },
      { phase: 'draft1', name: '1차 초안 완료', status: 'completed', date: '2025-08-08' },
      { phase: 'draft2', name: '2차 초안 완료', status: 'completed', date: '2025-08-11' },
      { phase: 'final', name: '최종 납품', status: 'completed', date: '2025-08-15' }
    ],
    requirements: {
      pages: 120,
      sections: 8,
      attachments: 15,
      presentation_time: 20
    },
    evaluation: {
      technical: 45,
      business: 30,
      price: 25,
      total_score: 87.5,
      rank: 2,
      feedback: '기술적 우수성과 사업성이 높게 평가됨. 가격 경쟁력 보완 필요.'
    }
  };
  
  saveBiddingProject(demoProject);
}

// 블로그 데이터 저장
function saveBlogPosts() {
  try {
    ensureBlogDataDirectory();
    const lines = Array.from(blogPosts.values()).map(post => JSON.stringify(post));
    fs.writeFileSync(BLOG_DATA_FILE, lines.join('\\n') + '\\n');
  } catch (error) {
    console.error('블로그 데이터 저장 오류:', error);
  }
}

// 블로그 데이터 디렉토리 확인
function ensureBlogDataDirectory() {
  const dataDir = path.dirname(BLOG_DATA_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// 유틸리티 함수들
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadData() {
  ensureDataDir();
  
  // 사용자 데이터 로드
  if (fs.existsSync(USERS_FILE)) {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    data.split('\\n').filter(line => line.trim()).forEach(line => {
      try {
        const user = JSON.parse(line);
        users.set(user.username, user);
      } catch (e) {
        console.error('사용자 데이터 파싱 오류:', e);
      }
    });
  }
}

function saveUser(user) {
  const userLine = JSON.stringify(user) + '\\n';
  fs.appendFileSync(USERS_FILE, userLine);
}

function saveLead(lead) {
  ensureDataDir();
  const leadWithTimestamp = { ...lead, timestamp: new Date().toISOString() };
  const leadLine = JSON.stringify(leadWithTimestamp) + '\\n';
  fs.appendFileSync(LEADS_FILE, leadLine);
  
  // 메모리에도 저장 (어드민용)
  leads.push(leadWithTimestamp);
}

function loadLeads() {
  if (fs.existsSync(LEADS_FILE)) {
    const data = fs.readFileSync(LEADS_FILE, 'utf8');
    leads = data.split('\\n').filter(line => line.trim()).map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.error('리드 데이터 파싱 오류:', e);
        return null;
      }
    }).filter(Boolean);
  }
}

function saveChatLog(log) {
  chatLogs.push({...log, timestamp: new Date().toISOString()});
  
  // 키워드 분석
  if (log.message) {
    const words = log.message.toLowerCase().split(/\\s+/);
    words.forEach(word => {
      if (word.length > 2) { // 3글자 이상만
        analytics.keywords.set(word, (analytics.keywords.get(word) || 0) + 1);
      }
    });
  }
  
  // 로그 개수 제한 (메모리 관리)
  if (chatLogs.length > 10000) {
    chatLogs = chatLogs.slice(-5000);
  }
}

function isAdmin(username) {
  // 간단한 어드민 체크 (실제 운영시에는 더 안전한 방법 사용)
  return username === 'admin' || username === 'administrator';
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, HASH_LENGTH, 'sha256');
}

function generateSalt() {
  return crypto.randomBytes(SALT_LENGTH);
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidUsername(username) {
  return username && username.length >= 3 && username.length <= 24 && /^[a-zA-Z0-9_]+$/.test(username);
}

function isValidPassword(password) {
  // 최소 8자 이상 + 숫자/특수문자 포함
  const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/;
  return password && passwordRegex.test(password);
}

// Rate limiting (간단한 메모리 기반)
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60000; // 1분
  const maxRequests = 60; // 분당 60회
  
  if (!rateLimiter.has(ip)) {
    rateLimiter.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  const limiter = rateLimiter.get(ip);
  if (now > limiter.resetTime) {
    limiter.count = 1;
    limiter.resetTime = now + windowMs;
    return true;
  }
  
  if (limiter.count >= maxRequests) {
    return false;
  }
  
  limiter.count++;
  return true;
}

// 세션 관리
function createSession(username) {
  const sessionId = generateToken();
  const session = {
    id: sessionId,
    username,
    createdAt: Date.now(),
    expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24시간
  };
  sessions.set(sessionId, session);
  return sessionId;
}

function getSession(sessionId) {
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

function deleteSession(sessionId) {
  sessions.delete(sessionId);
}

// 쿠키 파싱
function parseCookies(req) {
  const cookies = {};
  if (req.headers.cookie) {
    req.headers.cookie.split(';').forEach(cookie => {
      const parts = cookie.trim().split('=');
      if (parts.length === 2) {
        cookies[parts[0]] = decodeURIComponent(parts[1]);
      }
    });
  }
  return cookies;
}

// 요청 본문 파싱
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          resolve(JSON.parse(body));
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          resolve(querystring.parse(body));
        } else {
          resolve(body);
        }
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// MIME 타입 결정
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// 챗봇 응답 생성
function generateChatResponse(message, userContext = {}) {
  const msg = message.toLowerCase();
  
  // 인사말 처리
  if (msg.includes('안녕') || msg.includes('hello') || msg.includes('hi')) {
    return {
      message: "안녕하세요! AI휴먼 상담 챗봇입니다. 어떤 행정 대행 서비스에 관심이 있으신가요?\\n\\n주요 서비스:\\n• 연구소/벤처기업 등록\\n• 이노비즈/메인비즈 인증\\n• 나라장터 등록\\n• 기타 행정 인증 대행",
      intent: 'greeting',
      suggestions: ['서비스 목록 보기', '가격 문의', '필요 서류 안내']
    };
  }
  
  // 서비스 문의
  if (msg.includes('서비스') || msg.includes('목록') || msg.includes('뭐가') || msg.includes('어떤')) {
    const serviceList = SERVICES.slice(0, 8).map(s => 
      `• ${s.name} (${s.difficulty}급 · ${s.price}원)`
    ).join('\\n');
    
    return {
      message: `주요 대행 서비스 목록입니다:\\n\\n${serviceList}\\n\\n더 자세한 정보가 필요하시면 구체적인 서비스명을 말씀해 주세요.`,
      intent: 'service_info',
      suggestions: ['가격 범주 설명', '필요 서류', '상담 신청']
    };
  }
  
  // 가격 문의
  if (msg.includes('가격') || msg.includes('비용') || msg.includes('얼마') || msg.includes('요금')) {
    return {
      message: "대행 서비스 가격 범주입니다:\\n\\n• 하급: 20-30만원 (차량등록, 간단한 신고)\\n• 중급: 30-50만원 (이노비즈, 소프트웨어사업자)\\n• 상급: 100-300만원 (연구소, 벤처기업, 나라장터)\\n• 극상급: 200만원+ (GS인증 등 고난도)\\n\\n※ 실제 견적은 서류 상태와 진행 난이도에 따라 달라집니다.",
      intent: 'pricing_scope',
      suggestions: ['구체적 견적 문의', '서류 안내', '상담 예약']
    };
  }
  
  // 서류 문의
  if (msg.includes('서류') || msg.includes('문서') || msg.includes('준비') || msg.includes('필요')) {
    return {
      message: "일반적으로 필요한 서류들입니다:\\n\\n• 기본: 사업자등록증, 법인등기부등본\\n• 재무: 재무제표, 세무신고서\\n• 기술: 기술보유현황, 연구개발비 내역\\n• 기타: 각 인증별 특수 서류\\n\\n정확한 서류 목록은 신청하시는 서비스에 따라 달라집니다. 구체적인 안내를 위해 상담을 신청해 주세요.",
      intent: 'document_check',
      suggestions: ['상담 신청', '처리 기간 문의', '서비스 선택']
    };
  }
  
  // 기간 문의
  if (msg.includes('기간') || msg.includes('시간') || msg.includes('언제') || msg.includes('얼마나')) {
    return {
      message: "일반적인 처리 기간입니다:\\n\\n• 하급 서비스: 1-2주\\n• 중급 서비스: 2-4주\\n• 상급 서비스: 4-8주\\n• 극상급 서비스: 2-3개월\\n\\n※ 서류 준비 상태와 관련 기관 심사 일정에 따라 달라질 수 있습니다.",
      intent: 'timeline',
      suggestions: ['상담 예약', '서비스 선택', '견적 문의']
    };
  }
  
  // 입찰 제안서 대행 관련
  if (msg.includes('입찰') || msg.includes('제안서') || msg.includes('발표') || msg.includes('공고') || msg.includes('bid')) {
    return {
      message: "입찰 제안서 대행 서비스 안내입니다:\\n\\n🔍 **입찰 제안서 분석**\\n• 입찰공고문 정밀 분석\\n• 평가기준 및 배점표 해석\\n• 처리기간: 3-5일\\n• 비용: 50만원~200만원\\n\\n✍️ **입찰 제안서 작성**\\n• 기술제안서 전문 작성\\n• 사업수행계획서 작성\\n• 처리기간: 7-14일\\n• 비용: 200만원~1,000만원\\n\\n🎤 **입찰 제안서 발표 대행**\\n• 발표용 PPT 제작\\n• 발표자 트레이닝\\n• 처리기간: 3-7일\\n• 비용: 100만원~500만원\\n\\n※ 프로젝트 규모에 따라 견적이 달라집니다. 상담을 통해 확정합니다.",
      intent: 'bid_proposal',
      suggestions: ['입찰 분석 상담', '제안서 작성 문의', '발표 대행 상담']
    };
  }
  
  // 상담 신청 의도
  if (msg.includes('상담') || msg.includes('문의') || msg.includes('신청') || msg.includes('예약')) {
    return {
      message: "전문 상담을 도와드리겠습니다!\\n\\n상담 신청을 위해 다음 정보를 알려주세요:\\n• 성함\\n• 연락처 (이메일 또는 전화번호)\\n• 관심 있는 서비스\\n• 희망 상담 일정\\n\\n입력하신 정보는 상담 목적으로만 사용되며, 개인정보 보호정책에 따라 안전하게 관리됩니다.",
      intent: 'lead_capture',
      suggestions: ['개인정보 동의 후 신청', '서비스 더 알아보기']
    };
  }
  
  // 특정 서비스 검색
  const matchedService = SERVICES.find(s => 
    msg.includes(s.name.toLowerCase()) || 
    s.name.toLowerCase().includes(msg)
  );
  
  if (matchedService) {
    return {
      message: `${matchedService.name} 서비스 안내입니다:\\n\\n• 난이도: ${matchedService.difficulty}급\\n• 예시 비용: ${matchedService.price}원\\n• 설명: ${matchedService.description}\\n\\n정확한 견적과 일정은 현재 상황에 따라 달라집니다. 상담을 통해 자세히 안내해 드리겠습니다.`,
      intent: 'service_detail',
      suggestions: ['상담 신청', '다른 서비스 보기', '필요 서류 안내']
    };
  }
  
  // 기본 응답
  return {
    message: "죄송합니다. 정확히 이해하지 못했습니다.\\n\\n다음과 같이 도움을 드릴 수 있습니다:\\n• 서비스 목록 안내\\n• 가격 범주 설명\\n• 필요 서류 안내\\n• 처리 기간 안내\\n• 상담 예약\\n\\n구체적으로 어떤 도움이 필요하신가요?",
    intent: 'fallback',
    suggestions: ['서비스 목록', '가격 문의', '상담 신청']
  };
}

// 컨텍스트 기반 제안 생성
function generateContextualSuggestions(message) {
  const msg = message.toLowerCase();
  
  if (msg.includes('연구소') || msg.includes('research')) {
    return ['연구소 설립 요건', '연구소 연장 절차', '연구개발비 혜택'];
  }
  
  if (msg.includes('벤처') || msg.includes('venture')) {
    return ['벤처기업 인증 유형', '벤처 투자 요건', '벤처 세제혜택'];
  }
  
  if (msg.includes('이노비즈') || msg.includes('innobiz')) {
    return ['이노비즈 신청 조건', '이노비즈 평가 기준', '이노비즈 혜택'];
  }
  
  if (msg.includes('입찰') || msg.includes('제안서') || msg.includes('발표') || msg.includes('bid')) {
    return ['입찰 분석 상담', '제안서 작성 문의', '발표 대행 상담'];
  }
  
  if (msg.includes('나라장터') || msg.includes('조달')) {
    return ['나라장터 등록 절차', '조달청 입찰', '공공조달 경험'];
  }
  
  if (msg.includes('가격') || msg.includes('비용')) {
    return ['구체적 견적 문의', '할인 프로그램', '패키지 상품'];
  }
  
  return ['빠른 상담 시작', '서비스 목록 보기', '성공 사례 보기'];
}

// AI 자동 FAQ 생성 (관리자 대시보드용)
function generateAutoFAQ() {
  if (chatLogs.length < 10) return [];

  const questionFrequency = new Map();
  
  chatLogs.forEach(log => {
    const question = log.message.toLowerCase();
    
    // 간단한 정규화
    const normalized = question
      .replace(/[?.!,]/g, '')
      .replace(/\\s+/g, ' ')
      .trim();
    
    if (normalized.length > 10) { // 너무 짧은 질문 제외
      const count = questionFrequency.get(normalized) || 0;
      questionFrequency.set(normalized, count + 1);
    }
  });

  // 빈도순으로 정렬하고 상위 5개 추출
  const topQuestions = Array.from(questionFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .filter(([question, count]) => count >= 3); // 최소 3회 이상

  return topQuestions.map(([question, count]) => ({
    question,
    frequency: count,
    suggested: true,
    approved: false
  }));
}

// AI 서비스 추천 생성
function generateServiceRecommendations(userQuery, visitedPages = []) {
  const recommendations = [];
  const queryLower = userQuery.toLowerCase();
  
  // 현재 질문 기반 추천
  if (queryLower.includes('연구소')) {
    recommendations.push({
      service: '이노비즈 인증',
      reason: '연구소와 함께 신청하면 시너지 효과',
      discount: '패키지 할인 10%'
    });
  }
  
  if (queryLower.includes('벤처')) {
    recommendations.push({
      service: '연구소 설립',
      reason: '벤처기업 R&D 역량 강화',
      discount: '동시 신청 할인'
    });
  }
  
  // 방문 페이지 기반 추천
  if (visitedPages.includes('innobiz')) {
    recommendations.push({
      service: '메인비즈 등록',
      reason: '이노비즈와 메인비즈 동시 보유 시 혜택 증대',
      discount: '연관 서비스 5% 할인'
    });
  }
  
  return recommendations.slice(0, 3); // 최대 3개
}

// AI 홍보 문구 생성
function generateMarketingContent(serviceInfo) {
  // 입찰 제안서 대행 서비스 특별 처리
  if (serviceInfo.name && (serviceInfo.name.includes('입찰') || serviceInfo.name.includes('제안서'))) {
    const bidTemplates = {
      short: [
        `입찰 성공률을 높이는 전문 제안서 대행!`,
        `입찰 제안서 작성, 전문가에게 맡기세요!`,
        `입찰 발표까지 완벽 지원하는 원스톱 서비스`
      ],
      long: [
        `입찰 제안서 대행 서비스로 경쟁력을 높이세요. 공고 분석부터 제안서 작성, 발표 준비까지 전문가가 모든 과정을 지원합니다. 프로젝트 규모에 따라 맞춤형 견적을 제공합니다.`,
        `입찰 성공의 핵심은 전문적인 제안서입니다. AI휴먼의 입찰 전문가가 공고 분석, 제안서 작성, 발표 대행까지 원스톱으로 처리해드립니다. 견적은 상담을 통해 확정됩니다.`
      ],
      hashtag: [
        `#입찰제안서대행 #제안서작성 #입찰발표 #입찰성공 #전문가서비스 #AI휴먼`,
        `#입찰분석 #제안서전문가 #발표대행 #입찰컨설팅 #원스톱서비스 #견적상담`
      ]
    };

    return {
      shortVersions: bidTemplates.short,
      longVersions: bidTemplates.long,
      hashtagVersions: bidTemplates.hashtag
    };
  }

  // 기존 서비스용 템플릿
  const templates = {
    short: [
      `${serviceInfo.name}로 비즈니스 성장의 기회를 잡으세요!`,
      `${serviceInfo.name}, 전문가와 함께 간편하게!`,
      `${serviceInfo.name} 대행으로 시간과 비용을 절약하세요`
    ],
    long: [
      `${serviceInfo.name}는 복잡한 절차를 전문가가 대신 처리해드립니다. 평균 처리 기간 ${serviceInfo.timeframe}으로 빠르고 정확한 서비스를 제공합니다.`,
      `${serviceInfo.name} 신청이 어려우신가요? AI휴먼의 전문 컨설턴트가 A부터 Z까지 모든 과정을 책임집니다. 성공률 98%의 검증된 노하우를 경험하세요.`
    ],
    hashtag: [
      `#${serviceInfo.name} #행정대행 #AI휴먼 #전문가서비스 #비즈니스성장`,
      `#대행서비스 #${serviceInfo.name} #원스톱서비스 #전문상담 #성공보장`
    ]
  };

  return {
    shortVersions: templates.short,
    longVersions: templates.long,
    hashtagVersions: templates.hashtag
  };
}

// 라우터 핸들러들
const routes = {
  // 회원가입
  'POST /api/register': async (req, res, body) => {
    const { username, password, email, phone, agreePrivacy } = body;
    
    // 입력 검증
    if (!isValidUsername(username)) {
      return res.writeHead(400).end(JSON.stringify({ error: '사용자명은 3-24자의 영문, 숫자, 언더스코어만 가능합니다.' }));
    }
    
    if (!isValidPassword(password)) {
      return res.writeHead(400).end(JSON.stringify({ error: '비밀번호는 8자 이상이며 숫자와 특수문자를 포함해야 합니다.' }));
    }
    
    if (!isValidEmail(email)) {
      return res.writeHead(400).end(JSON.stringify({ error: '올바른 이메일 주소를 입력해주세요.' }));
    }
    
    if (!agreePrivacy) {
      return res.writeHead(400).end(JSON.stringify({ error: '개인정보 처리방침에 동의해주세요.' }));
    }
    
    // 중복 체크
    if (users.has(username)) {
      return res.writeHead(409).end(JSON.stringify({ error: '이미 존재하는 사용자명입니다.' }));
    }
    
    // 이메일 중복 체크
    for (let user of users.values()) {
      if (user.email === email) {
        return res.writeHead(409).end(JSON.stringify({ error: '이미 등록된 이메일입니다.' }));
      }
    }
    
    // 비밀번호 해시화
    const salt = generateSalt();
    const hash = hashPassword(password, salt);
    
    const user = {
      username,
      email,
      phone,
      salt: salt.toString('hex'),
      hash: hash.toString('hex'),
      createdAt: new Date().toISOString(),
      agreePrivacy: true
    };
    
    users.set(username, user);
    saveUser(user);
    
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: '회원가입이 완료되었습니다.',
      username: user.username,
      email: user.email
    }));
  },
  
  // 로그인
  'POST /api/login': async (req, res, body) => {
    const { username, password } = body;
    
    if (!username || !password) {
      return res.writeHead(400).end(JSON.stringify({ error: '사용자명과 비밀번호를 입력해주세요.' }));
    }
    
    const user = users.get(username);
    if (!user) {
      return res.writeHead(401).end(JSON.stringify({ error: '사용자를 찾을 수 없습니다.' }));
    }
    
    // 비밀번호 검증
    const salt = Buffer.from(user.salt, 'hex');
    const hash = hashPassword(password, salt);
    
    if (hash.toString('hex') !== user.hash) {
      return res.writeHead(401).end(JSON.stringify({ error: '비밀번호가 일치하지 않습니다.' }));
    }
    
    // 세션 생성
    const sessionId = createSession(username);
    const csrfToken = generateCSRFToken();
    csrfTokens.set(sessionId, csrfToken);
    
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': `session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400`
    });
    res.end(JSON.stringify({ 
      message: '로그인 성공',
      username: user.username,
      csrfToken
    }));
  },
  
  // 로그아웃
  'POST /api/logout': async (req, res) => {
    const cookies = parseCookies(req);
    const sessionId = cookies.session;
    
    if (sessionId) {
      deleteSession(sessionId);
      csrfTokens.delete(sessionId);
    }
    
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'
    });
    res.end(JSON.stringify({ message: '로그아웃 되었습니다.' }));
  },
  
  // 내 정보
  'GET /api/me': async (req, res) => {
    const cookies = parseCookies(req);
    const session = getSession(cookies.session);
    
    if (!session) {
      return res.writeHead(401).end(JSON.stringify({ error: '로그인이 필요합니다.' }));
    }
    
    const user = users.get(session.username);
    if (!user) {
      return res.writeHead(404).end(JSON.stringify({ error: '사용자를 찾을 수 없습니다.' }));
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      username: user.username,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt
    }));
  },
  
  // 챗봇 (규칙 기반 + AI 모드)
  'POST /api/chat': async (req, res, body) => {
    const cookies = parseCookies(req);
    const session = getSession(cookies.session);
    
    if (!session) {
      return res.writeHead(401).end(JSON.stringify({ error: '로그인이 필요합니다.' }));
    }
    
    const { message, context, aiMode = false } = body;
    
    if (!message) {
      return res.writeHead(400).end(JSON.stringify({ error: '메시지를 입력해주세요.' }));
    }

    let response;
    const startTime = Date.now();

    try {
      if (aiMode && aiService) {
        // AI 모드: LLM 기반 응답
        try {
          const aiResponse = await aiService.generateAIResponse(
            message, 
            session.sessionId,
            { username: session.username }
          );
          
          response = {
            message: aiResponse.content,
            intent: 'ai_response',
            mode: 'ai',
            sources: aiResponse.sources || [],
            cached: aiResponse.cached || false,
            suggestions: generateContextualSuggestions(message)
          };

          // AI 응답이 실패하면 규칙 기반으로 폴백
        } catch (aiError) {
          console.error('AI 모드 오류:', aiError.message);
          response = generateChatResponse(message, context || {});
          response.mode = 'fallback';
          response.aiError = aiError.message;
        }
      } else {
        // 규칙 기반 모드
        response = generateChatResponse(message, context || {});
        response.mode = 'rule';
      }

      const responseTime = Date.now() - startTime;
      response.responseTime = responseTime;

      // 챗봇 로그 저장
      saveChatLog({
        username: session.username,
        message,
        response: response.message,
        intent: response.intent,
        mode: response.mode,
        responseTime,
        aiMode,
        sessionId: session.sessionId
      });
      
    } catch (error) {
      console.error('챗봇 오류:', error);
      response = {
        message: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        intent: 'error',
        mode: 'error'
      };
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  },
  
  // ===== 어드민 API =====
  // 어드민 로그인
  'POST /api/admin/login': async (req, res, body) => {
    const { username, password } = body;
    
    if (!username || !password) {
      return res.writeHead(400).end(JSON.stringify({ error: '사용자명과 비밀번호를 입력해주세요.' }));
    }
    
    // 간단한 어드민 계정 체크 (실제 운영시에는 더 안전한 방법 사용)
    if (username !== 'admin' || password !== 'admin123!') {
      return res.writeHead(401).end(JSON.stringify({ error: '관리자 권한이 없습니다.' }));
    }
    
    // 세션 생성
    const sessionId = createSession(username);
    const csrfToken = generateCSRFToken();
    csrfTokens.set(sessionId, csrfToken);
    
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': `session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400`
    });
    res.end(JSON.stringify({ 
      message: '관리자 로그인 성공',
      username,
      csrfToken
    }));
  },
  
  // 어드민 로그아웃
  'POST /api/admin/logout': async (req, res) => {
    const cookies = parseCookies(req);
    const sessionId = cookies.session;
    
    if (sessionId) {
      deleteSession(sessionId);
      csrfTokens.delete(sessionId);
    }
    
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'
    });
    res.end(JSON.stringify({ message: '로그아웃 되었습니다.' }));
  },
  
  // 어드민 정보 확인
  'GET /api/admin/me': async (req, res) => {
    const cookies = parseCookies(req);
    const session = getSession(cookies.session);
    
    if (!session || !isAdmin(session.username)) {
      return res.writeHead(401).end(JSON.stringify({ error: '관리자 권한이 필요합니다.' }));
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ username: session.username }));
  },
  
  // 대시보드 통계
  'GET /api/admin/stats': async (req, res) => {
    const cookies = parseCookies(req);
    const session = getSession(cookies.session);
    
    if (!session || !isAdmin(session.username)) {
      return res.writeHead(401).end(JSON.stringify({ error: '관리자 권한이 필요합니다.' }));
    }
    
    const today = new Date().toISOString().split('T')[0];
    const todayVisits = analytics.visitors.filter(v => v.date === today).length;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalUsers: users.size,
      totalLeads: leads.length,
      totalChats: chatLogs.length,
      todayVisits
    }));
  },
  
  // 회원 목록 조회
  'GET /api/admin/users': async (req, res) => {
    const cookies = parseCookies(req);
    const session = getSession(cookies.session);
    
    if (!session || !isAdmin(session.username)) {
      return res.writeHead(401).end(JSON.stringify({ error: '관리자 권한이 필요합니다.' }));
    }
    
    const userList = Array.from(users.values()).map(user => ({
      username: user.username,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt
    }));
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(userList));
  },
  
  // 회원 삭제
  'DELETE /api/admin/users/:username': async (req, res) => {
    const cookies = parseCookies(req);
    const session = getSession(cookies.session);
    
    if (!session || !isAdmin(session.username)) {
      return res.writeHead(401).end(JSON.stringify({ error: '관리자 권한이 필요합니다.' }));
    }
    
    const username = req.url.split('/').pop();
    if (!users.has(username)) {
      return res.writeHead(404).end(JSON.stringify({ error: '사용자를 찾을 수 없습니다.' }));
    }
    
    users.delete(username);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: '사용자가 삭제되었습니다.' }));
  },
  
  // 리드 목록 조회
  'GET /api/admin/leads': async (req, res) => {
    const cookies = parseCookies(req);
    const session = getSession(cookies.session);
    
    if (!session || !isAdmin(session.username)) {
      return res.writeHead(401).end(JSON.stringify({ error: '관리자 권한이 필요합니다.' }));
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(leads));
  },
  
  // 리드 상태 업데이트
  'PUT /api/admin/leads/:email': async (req, res, body) => {
    const cookies = parseCookies(req);
    const session = getSession(cookies.session);
    
    if (!session || !isAdmin(session.username)) {
      return res.writeHead(401).end(JSON.stringify({ error: '관리자 권한이 필요합니다.' }));
    }
    
    const email = decodeURIComponent(req.url.split('/').pop());
    const { status } = body;
    
    const leadIndex = leads.findIndex(lead => lead.email === email);
    if (leadIndex === -1) {
      return res.writeHead(404).end(JSON.stringify({ error: '리드를 찾을 수 없습니다.' }));
    }
    
    leads[leadIndex].status = status;
    leads[leadIndex].updatedAt = new Date().toISOString();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: '상태가 업데이트되었습니다.' }));
  },
  
  // 분석 데이터 조회
  'GET /api/admin/analytics': async (req, res) => {
    const cookies = parseCookies(req);
    const session = getSession(cookies.session);
    
    if (!session || !isAdmin(session.username)) {
      return res.writeHead(401).end(JSON.stringify({ error: '관리자 권한이 필요합니다.' }));
    }
    
    const parsedUrl = url.parse(req.url, true);
    const days = parseInt(parsedUrl.query.days) || 7;
    
    // 키워드 분석 (상위 10개)
    const keywords = Array.from(analytics.keywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));
    
    // 전환율 계산 (간단한 예시)
    const totalUsers = users.size;
    const totalLeads = leads.length;
    const totalChats = chatLogs.length;
    
    const conversion = {
      visitorToSignup: totalUsers > 0 ? ((totalUsers / (totalUsers + 100)) * 100).toFixed(1) : 0,
      signupToLead: totalUsers > 0 ? ((totalLeads / totalUsers) * 100).toFixed(1) : 0,
      chatToLead: totalChats > 0 ? ((totalLeads / totalChats) * 100).toFixed(1) : 0
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      keywords,
      conversion,
      period: `${days}일`
    }));
  },
  
  // 리드 저장
  'POST /api/lead': async (req, res, body) => {
    const { name, email, phone, interest, memo, agreePrivacy } = body;
    
    if (!name || !email) {
      return res.writeHead(400).end(JSON.stringify({ error: '이름과 이메일은 필수입니다.' }));
    }
    
    if (!isValidEmail(email)) {
      return res.writeHead(400).end(JSON.stringify({ error: '올바른 이메일 주소를 입력해주세요.' }));
    }
    
    if (!agreePrivacy) {
      return res.writeHead(400).end(JSON.stringify({ error: '개인정보 처리방침에 동의해주세요.' }));
    }
    
    const lead = {
      name,
      email,
      phone,
      interest: Array.isArray(interest) ? interest : [interest].filter(Boolean),
      memo,
      agreePrivacy: true,
      ip: req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };
    
    saveLead(lead);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: '상담 신청이 완료되었습니다. 빠른 시일 내에 연락드리겠습니다.',
      leadId: crypto.randomBytes(8).toString('hex')
    }));
  },

  // 블로그 포스트 목록 조회
  'GET /api/blog/posts': async (req, res) => {
    const posts = Array.from(blogPosts.values())
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(posts));
  },

  // 특정 블로그 포스트 조회
  'GET /api/blog/post': async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const postId = parsedUrl.query.id;

    if (!postId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '포스트 ID가 필요합니다.' }));
      return;
    }

    const post = blogPosts.get(postId);
    if (!post) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '포스트를 찾을 수 없습니다.' }));
      return;
    }

    // 조회수 증가
    post.views = (post.views || 0) + 1;
    blogPosts.set(postId, post);
    saveBlogPosts();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(post));
  },

  // 블로그 포스트 생성 (관리자 전용)
  'POST /api/admin/blog/post': async (req, res, body) => {
    const session = verifySession(req);
    if (!session || !session.isAdmin) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '관리자 권한이 필요합니다.' }));
      return;
    }

    const { title, slug, excerpt, content, category, tags, featured, image } = body;

    if (!title || !content || !category) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '제목, 내용, 카테고리는 필수입니다.' }));
      return;
    }

    const postId = crypto.randomBytes(8).toString('hex');
    const now = new Date().toISOString();
    
    const post = {
      id: postId,
      title: title.trim(),
      slug: slug || title.toLowerCase().replace(/[^a-z0-9가-힣]/g, '-').replace(/-+/g, '-'),
      excerpt: excerpt || content.substring(0, 200) + '...',
      content,
      category,
      tags: Array.isArray(tags) ? tags : [],
      author: session.username,
      publishedAt: now,
      updatedAt: now,
      views: 0,
      featured: !!featured,
      image: image || '/assets/blog/default.jpg',
      readTime: Math.ceil(content.length / 1000) // 대략적인 읽기 시간 (분)
    };

    blogPosts.set(postId, post);
    saveBlogPosts();

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(post));
  },

  // 블로그 포스트 수정 (관리자 전용)
  'PUT /api/admin/blog/post': async (req, res, body) => {
    const session = verifySession(req);
    if (!session || !session.isAdmin) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '관리자 권한이 필요합니다.' }));
      return;
    }

    const { id, title, slug, excerpt, content, category, tags, featured, image } = body;

    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '포스트 ID가 필요합니다.' }));
      return;
    }

    const existingPost = blogPosts.get(id);
    if (!existingPost) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '포스트를 찾을 수 없습니다.' }));
      return;
    }

    const updatedPost = {
      ...existingPost,
      title: title || existingPost.title,
      slug: slug || existingPost.slug,
      excerpt: excerpt || existingPost.excerpt,
      content: content || existingPost.content,
      category: category || existingPost.category,
      tags: tags ? (Array.isArray(tags) ? tags : []) : existingPost.tags,
      featured: featured !== undefined ? !!featured : existingPost.featured,
      image: image || existingPost.image,
      updatedAt: new Date().toISOString(),
      readTime: content ? Math.ceil(content.length / 1000) : existingPost.readTime
    };

    blogPosts.set(id, updatedPost);
    saveBlogPosts();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(updatedPost));
  },

  // 블로그 포스트 삭제 (관리자 전용)
  'DELETE /api/admin/blog/post': async (req, res) => {
    const session = verifySession(req);
    if (!session || !session.isAdmin) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '관리자 권한이 필요합니다.' }));
      return;
    }

    const parsedUrl = url.parse(req.url, true);
    const postId = parsedUrl.query.id;

    if (!postId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '포스트 ID가 필요합니다.' }));
      return;
    }

    if (!blogPosts.has(postId)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '포스트를 찾을 수 없습니다.' }));
      return;
    }

    blogPosts.delete(postId);
    saveBlogPosts();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: '포스트가 삭제되었습니다.' }));
  },

  // AI 서비스 추천
  'GET /api/recommendations': async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const { query, page } = parsedUrl.query;

    const recommendations = generateServiceRecommendations(
      query || '', 
      page ? [page] : []
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(recommendations));
  },

  // AI 자동 FAQ 생성 (관리자 전용)
  'GET /api/admin/ai/faq': async (req, res) => {
    const session = verifySession(req);
    if (!session || !session.isAdmin) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '관리자 권한이 필요합니다.' }));
      return;
    }

    const autoFAQ = generateAutoFAQ();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(autoFAQ));
  },

  // AI 홍보 문구 생성 (관리자 전용)
  'POST /api/admin/ai/marketing': async (req, res, body) => {
    const session = verifySession(req);
    if (!session || !session.isAdmin) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '관리자 권한이 필요합니다.' }));
      return;
    }

    const { serviceId } = body;
    
    if (!serviceId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '서비스 ID가 필요합니다.' }));
      return;
    }

    // 기존 서비스에서 찾기
    let service = SERVICES.find(s => s.name === serviceId);
    
    // 입찰 제안서 대행 서비스 특별 처리
    if (!service && (serviceId.includes('입찰') || serviceId.includes('제안서'))) {
      service = {
        name: serviceId,
        description: '입찰 제안서 대행 전문 서비스',
        timeframe: '프로젝트 규모에 따라 상이',
        price: 'POA (견적 상담)'
      };
    }
    
    if (!service) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '서비스를 찾을 수 없습니다.' }));
      return;
    }

    const marketingContent = generateMarketingContent(service);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(marketingContent));
  },

  // 입찰 프로젝트 목록 조회 (관리자 전용)
  'GET /api/admin/bidding/projects': async (req, res) => {
    const session = verifySession(req);
    if (!session || !session.isAdmin) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '관리자 권한이 필요합니다.' }));
      return;
    }
    
    const projects = Array.from(biddingProjectsData.values())
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ projects }));
  },
  
  // 입찰 프로젝트 상세 조회 (관리자 전용)
  'GET /api/admin/bidding/project': async (req, res) => {
    const session = verifySession(req);
    if (!session || !session.isAdmin) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '관리자 권한이 필요합니다.' }));
      return;
    }
    
    const urlParts = url.parse(req.url, true);
    const projectId = urlParts.query.id;
    
    if (!projectId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '프로젝트 ID가 필요합니다.' }));
      return;
    }
    
    const project = biddingProjectsData.get(projectId);
    if (!project) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '프로젝트를 찾을 수 없습니다.' }));
      return;
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ project }));
  },
  
  // 입찰 프로젝트 생성/업데이트 (관리자 전용)
  'POST /api/admin/bidding/project': async (req, res, body) => {
    const session = verifySession(req);
    if (!session || !session.isAdmin) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '관리자 권한이 필요합니다.' }));
      return;
    }
    
    const { id, title, client, package: packageType, deadline, budget, description } = body;
    
    if (!title || !client || !packageType || !deadline) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '필수 필드가 뺄락습니다.' }));
      return;
    }
    
    const projectId = id || `bid-${Date.now()}`;
    const project = {
      id: projectId,
      title,
      client,
      package: packageType,
      deadline,
      budget: parseInt(budget) || 0,
      description: description || '',
      status: 'active',
      phase: 'kickoff',
      manager: session.username,
      created: id ? (biddingProjectsData.get(id)?.created || new Date().toISOString()) : new Date().toISOString(),
      updated: new Date().toISOString(),
      deliverables: [
        { type: 'analysis', name: 'RFP 분석보고서', status: 'pending', file: '', updated: '' },
        { type: 'proposal', name: '제안서', status: 'pending', file: '', updated: '' }
      ],
      milestones: [
        { phase: 'kickoff', name: '킥오프 미팅', status: 'pending', date: '' },
        { phase: 'analysis', name: 'RFP 분석 완료', status: 'pending', date: '' },
        { phase: 'draft1', name: '1차 초안 완료', status: 'pending', date: '' },
        { phase: 'draft2', name: '2차 초안 완료', status: 'pending', date: '' },
        { phase: 'final', name: '최종 납품', status: 'pending', date: '' }
      ]
    };
    
    // 패키지 C인 경우 발표 추가
    if (packageType === 'C') {
      project.deliverables.push({
        type: 'presentation', 
        name: '발표자료', 
        status: 'pending', 
        file: '', 
        updated: ''
      });
    }
    
    const success = saveBiddingProject(project);
    
    if (success) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: '프로젝트가 저장되었습니다.', project }));
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '프로젝트 저장에 실패했습니다.' }));
    }
  },
  
  // 입찰 서비스 문의 (공개 API)
  'POST /api/bidding/inquiry': async (req, res, body) => {
    const { name, email, company, phone, project_title, deadline, package_type, budget, rfp_file, message } = body;
    
    if (!name || !email || !company || !project_title || !deadline || !package_type) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '필수 정보를 모두 입력해주세요.' }));
      return;
    }
    
    // 리드 스코어링
    let score = 0;
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const daysLeft = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysLeft >= 10) score += 3;
    else if (daysLeft >= 3) score += 1;
    
    if (budget && budget !== '협의') score += 2;
    if (rfp_file) score += 1;
    
    const lead = {
      id: 'bid-' + Date.now(),
      type: 'bidding',
      name,
      email,
      company,
      phone: phone || '',
      project_title,
      deadline,
      package_type,
      budget: budget || '협의',
      rfp_file: rfp_file || '',
      message: message || '',
      score,
      days_left: daysLeft,
      status: 'new',
      created: new Date().toISOString(),
      source: 'bidding_form'
    };
    
    leads.push(lead);
    saveLeads();
    
    // 애널리틱스 이벤트 기록
    analytics.conversions.chatToLead++;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: '입찰 서비스 문의가 접수되었습니다. 빠른 시일 내에 연락드리겠습니다.',
      leadId: lead.id,
      score: lead.score
    }));
  },

  // 지식 베이스 업데이트 (관리자 전용)
  'POST /api/admin/ai/knowledge': async (req, res, body) => {
    const session = verifySession(req);
    if (!session || !session.isAdmin) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '관리자 권한이 필요합니다.' }));
      return;
    }

    const { fileName, content } = body;
    
    if (!fileName || !content) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '파일명과 내용이 필요합니다.' }));
      return;
    }

    try {
      const knowledgeDir = path.join(__dirname, 'data', 'knowledge');
      if (!fs.existsSync(knowledgeDir)) {
        fs.mkdirSync(knowledgeDir, { recursive: true });
      }

      const filePath = path.join(knowledgeDir, fileName + '.md');
      fs.writeFileSync(filePath, content);

      // AI 서비스 지식 베이스 재로드
      if (aiService) {
        aiService.loadKnowledgeBase();
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: '지식 베이스가 업데이트되었습니다.' }));

    } catch (error) {
      console.error('지식 베이스 업데이트 오류:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '업데이트에 실패했습니다.' }));
    }
  },

  // 분석 이벤트 수집
  'POST /api/analytics/events': async (req, res, body) => {
    const { events } = body;

    if (!Array.isArray(events)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '이벤트 배열이 필요합니다.' }));
      return;
    }

    // 분석 데이터 저장
    events.forEach(event => {
      saveAnalyticsEvent(event);
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ received: events.length }));
  },

  // 분석 대시보드 데이터 조회 (관리자 전용)
  'GET /api/admin/analytics/dashboard': async (req, res) => {
    const session = verifySession(req);
    if (!session || !session.isAdmin) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '관리자 권한이 필요합니다.' }));
      return;
    }

    const dashboardData = generateAnalyticsDashboard();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(dashboardData));
  }
};

// 분석 이벤트 저장
function saveAnalyticsEvent(event) {
  try {
    ensureDataDir();
    const analyticsFile = path.join(DATA_DIR, 'analytics_events.jsonl');
    
    // IP 주소 추가
    event.ip = event.ip || 'unknown';
    event.timestamp = event.timestamp || new Date().toISOString();
    
    fs.appendFileSync(analyticsFile, JSON.stringify(event) + '\\n');
    
    // 메모리 통계 업데이트
    updateAnalyticsStats(event);
  } catch (error) {
    console.error('분석 이벤트 저장 오류:', error);
  }
}

// 분석 통계 업데이트
function updateAnalyticsStats(event) {
  const today = new Date().toISOString().split('T')[0];
  
  if (!analyticsData.dailyStats.has(today)) {
    analyticsData.dailyStats.set(today, {
      pageViews: 0,
      visitors: new Set(),
      sessions: new Set(),
      events: 0,
      conversions: 0,
      avgSessionTime: 0,
      bounceRate: 0
    });
  }
  
  const dayStats = analyticsData.dailyStats.get(today);
  dayStats.events++;
  
  if (event.eventType === 'page_view') {
    dayStats.pageViews++;
    dayStats.visitors.add(event.userId);
    dayStats.sessions.add(event.sessionId);
  }
  
  if (event.eventType === 'conversion') {
    dayStats.conversions++;
  }
  
  // 글로벌 통계 업데이트
  analyticsData.totalPageViews++;
  analyticsData.uniqueVisitors.add(event.userId);
  analyticsData.totalSessions.add(event.sessionId);
}

// 분석 대시보드 데이터 생성
function generateAnalyticsDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  const todayStats = analyticsData.dailyStats.get(today) || {
    pageViews: 0,
    visitors: new Set(),
    sessions: new Set(),
    events: 0,
    conversions: 0
  };
  
  const yesterdayStats = analyticsData.dailyStats.get(yesterday) || {
    pageViews: 0,
    visitors: new Set(),
    sessions: new Set(),
    events: 0,
    conversions: 0
  };
  
  // 최근 30일 데이터
  const last30Days = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
    const stats = analyticsData.dailyStats.get(date);
    last30Days.push({
      date,
      pageViews: stats ? stats.pageViews : 0,
      visitors: stats ? stats.visitors.size : 0,
      conversions: stats ? stats.conversions : 0
    });
  }
  
  return {
    overview: {
      totalPageViews: analyticsData.totalPageViews,
      uniqueVisitors: analyticsData.uniqueVisitors.size,
      totalSessions: analyticsData.totalSessions.size,
      conversionRate: analyticsData.totalPageViews > 0 ? 
        (analyticsData.conversions.visitorToSignup / analyticsData.totalPageViews * 100).toFixed(2) : 0
    },
    today: {
      pageViews: todayStats.pageViews,
      visitors: todayStats.visitors.size,
      sessions: todayStats.sessions.size,
      conversions: todayStats.conversions,
      changeFromYesterday: {
        pageViews: yesterdayStats.pageViews > 0 ? 
          (((todayStats.pageViews - yesterdayStats.pageViews) / yesterdayStats.pageViews) * 100).toFixed(1) : 0,
        visitors: yesterdayStats.visitors.size > 0 ? 
          (((todayStats.visitors.size - yesterdayStats.visitors.size) / yesterdayStats.visitors.size) * 100).toFixed(1) : 0
      }
    },
    chartData: last30Days,
    topPages: getTopPages(),
    abTestResults: getABTestResults()
  };
}

// 인기 페이지 조회
function getTopPages() {
  // 실제 구현에서는 analytics_events.jsonl 파일을 읽어서 처리
  return [
    { page: '/', views: 1250, title: 'AI휴먼 - 메인' },
    { page: '/blog.html', views: 340, title: 'AI휴먼 블로그' },
    { page: '/privacy.html', views: 180, title: '개인정보처리방침' },
    { page: '/terms.html', views: 120, title: '서비스 이용약관' }
  ];
}

// A/B 테스트 결과 조회
function getABTestResults() {
  return [
    {
      testId: 'cta-button-text',
      name: 'CTA 버튼 텍스트',
      variants: {
        control: { name: '빠른 상담 시작', visitors: 523, conversions: 34, rate: 6.5 },
        variant: { name: '무료 상담 받기', visitors: 487, conversions: 41, rate: 8.4 }
      },
      status: 'running',
      winner: 'variant'
    },
    {
      testId: 'pricing-display',
      name: '가격 표시 방식',
      variants: {
        control: { name: '기본 표시', visitors: 502, conversions: 28, rate: 5.6 },
        variant: { name: '프로 플랜 강조', visitors: 498, conversions: 35, rate: 7.0 }
      },
      status: 'running',
      winner: 'variant'
    }
  ];
}

// 메인 서버 함수
const server = http.createServer(async (req, res) => {
  const clientIp = req.connection.remoteAddress;
  
  // Rate limiting 체크
  if (!checkRateLimit(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }));
    return;
  }
  
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url, true);
  const routeKey = `${req.method} ${parsedUrl.pathname}`;
  
  try {
    // API 라우트 처리
    if (routes[routeKey]) {
      let body = null;
      if (req.method === 'POST' || req.method === 'PUT') {
        body = await parseBody(req);
      }
      return await routes[routeKey](req, res, body);
    }
    
    // 정적 파일 서빙
    let filePath = path.join(PUBLIC_DIR, parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);
    
    // 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 Not Found</h1>');
      return;
    }
    
    // 디렉토리 접근 방지
    if (fs.statSync(filePath).isDirectory()) {
      res.writeHead(403, { 'Content-Type': 'text/html' });
      res.end('<h1>403 Forbidden</h1>');
      return;
    }
    
    const mimeType = getMimeType(filePath);
    const fileContent = fs.readFileSync(filePath);
    
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(fileContent);
    
  } catch (error) {
    console.error('서버 오류:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '서버 내부 오류가 발생했습니다.' }));
  }
});

// 서버 시작
loadData(); // 데이터 로드
loadLeads(); // 리드 데이터 로드
loadBlogPosts(); // 블로그 포스트 로드
loadBiddingProjects(); // 입찰 프로젝트 로드

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 AI휴먼 플랫폼 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`   http://localhost:${PORT}`);
  console.log('\\n📊 서비스 통계:');
  console.log(`   등록된 사용자: ${users.size}명`);
  console.log(`   활성 세션: ${sessions.size}개`);
  console.log(`   제공 서비스: ${SERVICES.length}개`);
});

// 정리 작업
process.on('SIGINT', () => {
  console.log('\\n서버를 종료합니다...');
  server.close(() => {
    console.log('서버가 안전하게 종료되었습니다.');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  console.error('예상치 못한 오류:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('처리되지 않은 Promise 거부:', reason);
  process.exit(1);
});