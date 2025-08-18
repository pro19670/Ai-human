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

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

// 데이터 파일 경로
const USERS_FILE = path.join(DATA_DIR, 'users.jsonl');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.jsonl');
const LEADS_FILE = path.join(DATA_DIR, 'leads.jsonl');

// 메모리 저장소
let users = new Map();
let sessions = new Map();
let rateLimiter = new Map();

// PBKDF2 설정
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 32;
const HASH_LENGTH = 64;

// CSRF 토큰 저장소
const csrfTokens = new Map();

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
  const leadLine = JSON.stringify({ ...lead, timestamp: new Date().toISOString() }) + '\\n';
  fs.appendFileSync(LEADS_FILE, leadLine);
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
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}

function isValidUsername(username) {
  return username && username.length >= 3 && username.length <= 24 && /^[a-zA-Z0-9_]+$/.test(username);
}

function isValidPassword(password) {
  return password && password.length >= 8;
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
      return res.writeHead(400).end(JSON.stringify({ error: '비밀번호는 8자 이상이어야 합니다.' }));
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
  
  // 챗봇
  'POST /api/chat': async (req, res, body) => {
    const cookies = parseCookies(req);
    const session = getSession(cookies.session);
    
    if (!session) {
      return res.writeHead(401).end(JSON.stringify({ error: '로그인이 필요합니다.' }));
    }
    
    const { message, context } = body;
    
    if (!message) {
      return res.writeHead(400).end(JSON.stringify({ error: '메시지를 입력해주세요.' }));
    }
    
    const response = generateChatResponse(message, context || {});
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
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
  }
};

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