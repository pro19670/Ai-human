// 다국어 지원 시스템
class I18n {
    constructor() {
        this.currentLanguage = localStorage.getItem('language') || 'ko';
        // 한국어로 강제 설정
        localStorage.setItem('language', 'ko');
        this.translations = {
            ko: {
                // 헤더 및 네비게이션
                'nav.services': '서비스',
                'nav.pricing': '가격',
                'nav.trust': '신뢰성',
                'nav.contact': '문의',
                'auth.login': '로그인',
                'auth.register': '회원가입',
                'auth.logout': '로그아웃',

                // 히어로 섹션
                'hero.title': '대행은 간단하게,<br><span class="accent">결과는 확실하게.</span>',
                'hero.subtitle': '연구소·벤처·이노비즈부터 나라장터까지,<br>전문가가 원스톱으로 처리합니다.',
                'hero.quickConsult': '빠른 상담 시작',
                'hero.viewServices': '서비스 한눈에',

                // 서비스 섹션
                'services.title': '전문 대행 서비스',
                'services.subtitle': '복잡한 절차, 전문가에게 맡기세요',
                'services.research.title': '연구소 설립',
                'services.research.desc': '기업부설 연구소 설립부터 운영까지 A부터 Z까지 완벽 지원',
                'services.venture.title': '벤처기업 인증',
                'services.venture.desc': '벤처기업 확인, 이노비즈 인증, 메인비즈 등록 원스톱 서비스',
                'services.govt.title': '정부사업',
                'services.govt.desc': 'R&D과제, 정부지원사업, 각종 공모전 신청 및 관리 대행',
                'services.market.title': '나라장터',
                'services.market.desc': '나라장터 등록부터 입찰, 계약까지 공공조달 전 과정 지원',

                // 가격 섹션
                'pricing.title': '투명한 가격 정책',
                'pricing.subtitle': '합리적인 비용으로 전문 서비스를 경험하세요',
                'pricing.basic.title': '기본',
                'pricing.basic.price': '50만원',
                'pricing.basic.period': '건당',
                'pricing.basic.features': [
                    '기본 서류 작성',
                    '1회 수정',
                    '이메일 지원',
                    '30일 보장'
                ],
                'pricing.pro.title': '전문가',
                'pricing.pro.price': '150만원',
                'pricing.pro.period': '건당',
                'pricing.pro.features': [
                    '전문 컨설팅',
                    '무제한 수정',
                    '전화 지원',
                    '90일 보장',
                    '사후 관리'
                ],
                'pricing.enterprise.title': '기업',
                'pricing.enterprise.price': '맞춤 견적',
                'pricing.enterprise.period': '협의',
                'pricing.enterprise.features': [
                    '대량 처리',
                    '전담 매니저',
                    '24시간 지원',
                    '1년 보장',
                    '종합 솔루션'
                ],
                'pricing.selectPlan': '플랜 선택',
                'pricing.contact': '문의하기',

                // 고객 후기 섹션
                'testimonials.title': '고객 성공 스토리',
                'testimonials.subtitle': '실제 고객들의 생생한 경험담을 확인해보세요',

                // 비디오 섹션
                'video.title': '혁신 기술 소개',
                'video.subtitle': '차세대 홀로그램 사이니지와 AI 키오스크를 만나보세요',
                'video.hologram.title': '홀로그램 사이니지 시연',
                'video.hologram.desc': '입체 평면형 액자와 LED 화면형 광고판의 실제 구동 모습을 확인해보세요. 생생한 홀로그램 기술을 경험할 수 있습니다.',
                'video.kiosk.title': '스마트 키오스크 체험',
                'video.kiosk.desc': 'AI 비서, 자리 지정, QR 코드, 타이머 등 다양한 기능이 통합된 키오스크의 실제 사용법을 소개합니다.',
                'video.process.title': '인증 프로세스 안내',
                'video.process.desc': '이노비즈, 벤처기업, 연구소 설립 등 각종 인증 절차를 단계별로 상세하게 설명해드립니다.',
                'video.success.title': '고객 성공 사례',
                'video.success.desc': 'AI휴먼과 함께한 고객들의 실제 성공 스토리와 비즈니스 성과를 영상으로 확인해보세요.',
                'video.cta.title': '더 많은 영상이 궁금하신가요?',
                'video.cta.desc': 'AI휴먼의 다양한 서비스와 기술을 YouTube 채널에서 만나보세요.',
                'video.cta.button': 'YouTube 채널 방문',

                // 신뢰성 섹션
                'trust.title': '왜 AI휴먼인가?',
                'trust.subtitle': '전문성과 신뢰성으로 검증된 파트너',
                'trust.expert.title': '전문성',
                'trust.expert.desc': '10년 이상의 경험을 가진 전문가가 직접 처리',
                'trust.speed.title': '신속성',
                'trust.speed.desc': '평균 처리 기간을 50% 단축하는 효율적인 프로세스',
                'trust.support.title': '지원',
                'trust.support.desc': '처리 완료 후에도 지속적인 사후 관리 서비스',
                'trust.security.title': '보안',
                'trust.security.desc': '기업 정보 보호를 위한 철저한 보안 시스템',

                // 연락처 섹션
                'contact.title': '지금 시작하세요',
                'contact.subtitle': '전문가와 상담하고 최적의 솔루션을 찾아보세요',
                'contact.info.title': '연락처 정보',
                'contact.form.title': '빠른 상담 신청',
                'contact.form.name': '이름',
                'contact.form.email': '이메일',
                'contact.form.company': '회사명',
                'contact.form.service': '서비스 선택',
                'contact.form.message': '상세 내용',
                'contact.form.submit': '상담 신청',
                'contact.form.success': '상담 신청이 접수되었습니다. 빠른 시일 내에 연락드리겠습니다.',

                // 푸터
                'footer.company': '회사 정보',
                'footer.services': '서비스',
                'footer.support': '고객 지원',
                'footer.legal': '약관 및 정책',
                'footer.privacy': '개인정보처리방침',
                'footer.terms': '서비스 이용약관',
                'footer.copyright': '© 2024 AI휴먼. All rights reserved.',

                // 공통
                'common.loading': '로딩 중...',
                'common.error': '오류가 발생했습니다.',
                'common.success': '성공적으로 처리되었습니다.',
                'common.confirm': '확인',
                'common.cancel': '취소',
                'common.close': '닫기'
            },
            en: {
                // Header and Navigation
                'nav.services': 'Services',
                'nav.pricing': 'Pricing',
                'nav.trust': 'Trust',
                'nav.contact': 'Contact',
                'auth.login': 'Login',
                'auth.register': 'Sign Up',
                'auth.logout': 'Logout',

                // Hero Section
                'hero.title': 'Simple process,<br><span class="accent">Guaranteed results.</span>',
                'hero.subtitle': 'From research institutes to venture certification and government marketplace,<br>experts handle everything in one-stop service.',
                'hero.quickConsult': 'Start Quick Consultation',
                'hero.viewServices': 'View Services',

                // Services Section
                'services.title': 'Professional Proxy Services',
                'services.subtitle': 'Leave complex procedures to the experts',
                'services.research.title': 'Research Institute',
                'services.research.desc': 'Complete support from establishment to operation of corporate research institutes',
                'services.venture.title': 'Venture Certification',
                'services.venture.desc': 'One-stop service for venture company confirmation, Innobiz certification, and Mainbiz registration',
                'services.govt.title': 'Government Projects',
                'services.govt.desc': 'Application and management proxy for R&D projects, government support programs, and various competitions',
                'services.market.title': 'Government Marketplace',
                'services.market.desc': 'Full support for public procurement process from marketplace registration to bidding and contracts',

                // Pricing Section
                'pricing.title': 'Transparent Pricing Policy',
                'pricing.subtitle': 'Experience professional services at reasonable costs',
                'pricing.basic.title': 'Basic',
                'pricing.basic.price': '$3,500',
                'pricing.basic.period': 'per case',
                'pricing.basic.features': [
                    'Basic document preparation',
                    '1 revision',
                    'Email support',
                    '30-day guarantee'
                ],
                'pricing.pro.title': 'Professional',
                'pricing.pro.price': '$10,500',
                'pricing.pro.period': 'per case',
                'pricing.pro.features': [
                    'Expert consulting',
                    'Unlimited revisions',
                    'Phone support',
                    '90-day guarantee',
                    'Post-processing management'
                ],
                'pricing.enterprise.title': 'Enterprise',
                'pricing.enterprise.price': 'Custom Quote',
                'pricing.enterprise.period': 'negotiable',
                'pricing.enterprise.features': [
                    'Bulk processing',
                    'Dedicated manager',
                    '24/7 support',
                    '1-year guarantee',
                    'Comprehensive solutions'
                ],
                'pricing.selectPlan': 'Select Plan',
                'pricing.contact': 'Contact Us',

                // Testimonials Section
                'testimonials.title': 'Customer Success Stories',
                'testimonials.subtitle': 'Check out real experiences from our actual customers',

                // Video Section
                'video.title': 'Innovation Technology Introduction',
                'video.subtitle': 'Meet next-generation hologram signage and AI kiosks',
                'video.hologram.title': 'Hologram Signage Demonstration',
                'video.hologram.desc': 'Check out the actual operation of 3D flat-type frames and LED screen-type advertising boards. Experience vivid hologram technology.',
                'video.kiosk.title': 'Smart Kiosk Experience',
                'video.kiosk.desc': 'Introducing the actual usage of kiosks integrating various functions such as AI assistant, seat assignment, QR codes, and timers.',
                'video.process.title': 'Certification Process Guide',
                'video.process.desc': 'We explain various certification procedures such as Innobiz, venture companies, and research institute establishment in detail step by step.',
                'video.success.title': 'Customer Success Cases',
                'video.success.desc': 'Check out real success stories and business results of customers who worked with AI Human through videos.',
                'video.cta.title': 'Curious about more videos?',
                'video.cta.desc': 'Meet AI Human\'s various services and technologies on our YouTube channel.',
                'video.cta.button': 'Visit YouTube Channel',

                // Trust Section
                'trust.title': 'Why AI Human?',
                'trust.subtitle': 'Verified partner with expertise and reliability',
                'trust.expert.title': 'Expertise',
                'trust.expert.desc': 'Directly handled by experts with over 10 years of experience',
                'trust.speed.title': 'Speed',
                'trust.speed.desc': 'Efficient process that reduces average processing time by 50%',
                'trust.support.title': 'Support',
                'trust.support.desc': 'Continuous post-processing management service even after completion',
                'trust.security.title': 'Security',
                'trust.security.desc': 'Thorough security system for corporate information protection',

                // Contact Section
                'contact.title': 'Start Now',
                'contact.subtitle': 'Consult with experts and find the optimal solution',
                'contact.info.title': 'Contact Information',
                'contact.form.title': 'Quick Consultation Request',
                'contact.form.name': 'Name',
                'contact.form.email': 'Email',
                'contact.form.company': 'Company',
                'contact.form.service': 'Select Service',
                'contact.form.message': 'Detailed Content',
                'contact.form.submit': 'Request Consultation',
                'contact.form.success': 'Your consultation request has been received. We will contact you soon.',

                // Footer
                'footer.company': 'Company Info',
                'footer.services': 'Services',
                'footer.support': 'Customer Support',
                'footer.legal': 'Terms & Policies',
                'footer.privacy': 'Privacy Policy',
                'footer.terms': 'Terms of Service',
                'footer.copyright': '© 2024 AI Human. All rights reserved.',

                // Common
                'common.loading': 'Loading...',
                'common.error': 'An error occurred.',
                'common.success': 'Successfully processed.',
                'common.confirm': 'Confirm',
                'common.cancel': 'Cancel',
                'common.close': 'Close'
            }
        };

        this.init();
    }

    init() {
        this.updateLanguageButtons();
        this.translatePage();
        this.bindEvents();
    }

    bindEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('lang-btn')) {
                const lang = e.target.dataset.lang;
                this.switchLanguage(lang);
            }
        });
    }

    switchLanguage(lang) {
        if (this.translations[lang]) {
            this.currentLanguage = lang;
            localStorage.setItem('language', lang);
            this.updateLanguageButtons();
            this.translatePage();
        }
    }

    updateLanguageButtons() {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === this.currentLanguage);
        });
    }

    translatePage() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.dataset.i18n;
            const translation = this.getTranslation(key);
            
            if (translation) {
                if (element.innerHTML.includes('<')) {
                    element.innerHTML = translation;
                } else {
                    element.textContent = translation;
                }
            }
        });

        // 플레이스홀더 번역
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.dataset.i18nPlaceholder;
            const translation = this.getTranslation(key);
            if (translation) {
                element.placeholder = translation;
            }
        });
    }

    getTranslation(key) {
        const keys = key.split('.');
        let translation = this.translations[this.currentLanguage];
        
        for (const k of keys) {
            translation = translation?.[k];
        }
        
        return translation || key;
    }
}

// 페이지 로드 시 다국어 시스템 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.i18n = new I18n();
});