// 방문자 추적 및 분석 시스템
class Analytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.userId = this.getUserId();
        this.trackingEnabled = false;
        this.events = [];
        this.pageStartTime = Date.now();
        this.scrollDepth = 0;
        this.maxScrollDepth = 0;
        
        this.init();
    }

    init() {
        // 쿠키 동의 확인
        this.checkConsentAndInitialize();
        
        // 이벤트 리스너 바인딩
        this.bindEvents();
        
        // 주기적으로 이벤트 전송
        setInterval(() => {
            this.flushEvents();
        }, 30000); // 30초마다
    }

    checkConsentAndInitialize() {
        const consent = localStorage.getItem('cookieConsent');
        if (consent === 'accepted') {
            this.trackingEnabled = true;
            this.trackPageView();
        }
        
        // 쿠키 동의 상태 변경 감지
        window.addEventListener('storage', (e) => {
            if (e.key === 'cookieConsent' && e.newValue === 'accepted') {
                this.trackingEnabled = true;
                this.trackPageView();
            } else if (e.key === 'cookieConsent' && e.newValue === 'declined') {
                this.trackingEnabled = false;
                this.clearTrackingData();
            }
        });

        // 쿠키 동의 버튼 클릭 감지
        document.addEventListener('click', (e) => {
            if (e.target.id === 'cookieAccept') {
                setTimeout(() => {
                    this.trackingEnabled = true;
                    this.trackPageView();
                }, 100);
            }
        });
    }

    bindEvents() {
        // 페이지 이탈 시 데이터 전송
        window.addEventListener('beforeunload', () => {
            this.trackPageLeave();
            this.flushEvents(true); // 즉시 전송
        });

        // 스크롤 깊이 추적
        window.addEventListener('scroll', this.throttle(() => {
            this.updateScrollDepth();
        }, 1000));

        // 클릭 이벤트 추적
        document.addEventListener('click', (e) => {
            this.trackClick(e);
        });

        // 폼 제출 추적
        document.addEventListener('submit', (e) => {
            this.trackFormSubmission(e);
        });

        // 링크 클릭 추적
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                this.trackLinkClick(e);
            }
        });

        // 페이지 가시성 변경 추적
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.trackEvent('page_hidden', {
                    timeOnPage: Date.now() - this.pageStartTime
                });
            } else {
                this.trackEvent('page_visible', {});
            }
        });
    }

    generateSessionId() {
        let sessionId = sessionStorage.getItem('analyticsSessionId');
        if (!sessionId) {
            sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('analyticsSessionId', sessionId);
        }
        return sessionId;
    }

    getUserId() {
        let userId = localStorage.getItem('analyticsUserId');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('analyticsUserId', userId);
        }
        return userId;
    }

    trackPageView() {
        if (!this.trackingEnabled) return;

        const data = {
            page: window.location.pathname,
            title: document.title,
            referrer: document.referrer,
            userAgent: navigator.userAgent,
            language: navigator.language,
            screenResolution: `${screen.width}x${screen.height}`,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`,
            timestamp: new Date().toISOString()
        };

        this.trackEvent('page_view', data);
    }

    trackPageLeave() {
        if (!this.trackingEnabled) return;

        const timeOnPage = Date.now() - this.pageStartTime;
        
        this.trackEvent('page_leave', {
            timeOnPage,
            maxScrollDepth: this.maxScrollDepth,
            finalScrollPosition: window.pageYOffset
        });
    }

    updateScrollDepth() {
        if (!this.trackingEnabled) return;

        const scrollTop = window.pageYOffset;
        const documentHeight = Math.max(
            document.body.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.clientHeight,
            document.documentElement.scrollHeight,
            document.documentElement.offsetHeight
        );
        const windowHeight = window.innerHeight;
        
        const scrollPercent = Math.round((scrollTop + windowHeight) / documentHeight * 100);
        this.scrollDepth = Math.min(scrollPercent, 100);
        
        if (this.scrollDepth > this.maxScrollDepth) {
            this.maxScrollDepth = this.scrollDepth;
            
            // 스크롤 마일스톤 추적 (25%, 50%, 75%, 100%)
            const milestones = [25, 50, 75, 100];
            for (const milestone of milestones) {
                if (this.maxScrollDepth >= milestone && !this[`scroll${milestone}Tracked`]) {
                    this.trackEvent('scroll_depth', { depth: milestone });
                    this[`scroll${milestone}Tracked`] = true;
                }
            }
        }
    }

    trackClick(event) {
        if (!this.trackingEnabled) return;

        const target = event.target;
        const data = {
            element: target.tagName.toLowerCase(),
            text: target.textContent?.trim().substring(0, 100) || '',
            id: target.id || '',
            className: target.className || '',
            x: event.clientX,
            y: event.clientY
        };

        // 중요한 버튼들 특별 추적
        if (target.classList.contains('btn') || target.closest('.btn')) {
            const btn = target.classList.contains('btn') ? target : target.closest('.btn');
            data.buttonType = btn.classList.contains('btn-primary') ? 'primary' : 
                            btn.classList.contains('btn-secondary') ? 'secondary' : 'other';
            
            this.trackEvent('button_click', data);
        } else if (target.matches('.nav-link, .filter-btn, .lang-btn')) {
            this.trackEvent('navigation_click', data);
        }
    }

    trackLinkClick(event) {
        if (!this.trackingEnabled) return;

        const link = event.target.tagName === 'A' ? event.target : event.target.closest('a');
        if (!link) return;

        const data = {
            url: link.href,
            text: link.textContent?.trim() || '',
            isExternal: link.hostname !== window.location.hostname,
            target: link.target || '_self'
        };

        this.trackEvent('link_click', data);
    }

    trackFormSubmission(event) {
        if (!this.trackingEnabled) return;

        const form = event.target;
        const data = {
            formId: form.id || '',
            action: form.action || '',
            method: form.method || 'get',
            fieldCount: form.elements.length
        };

        this.trackEvent('form_submit', data);
    }

    trackEvent(eventType, data = {}) {
        if (!this.trackingEnabled) return;

        const event = {
            sessionId: this.sessionId,
            userId: this.userId,
            eventType,
            data,
            timestamp: new Date().toISOString(),
            page: window.location.pathname,
            userAgent: navigator.userAgent
        };

        this.events.push(event);

        // 중요한 이벤트는 즉시 전송
        if (['form_submit', 'button_click'].includes(eventType)) {
            this.flushEvents();
        }
    }

    async flushEvents(immediate = false) {
        if (!this.trackingEnabled || this.events.length === 0) return;

        const eventsToSend = [...this.events];
        this.events = [];

        try {
            const response = await fetch('/api/analytics/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ events: eventsToSend }),
                keepalive: immediate // 페이지 이탈 시에도 전송 보장
            });

            if (!response.ok) {
                // 실패한 이벤트는 다시 큐에 추가 (최대 재시도 3회)
                eventsToSend.forEach(event => {
                    event.retryCount = (event.retryCount || 0) + 1;
                    if (event.retryCount <= 3) {
                        this.events.push(event);
                    }
                });
            }
        } catch (error) {
            console.debug('Analytics 전송 실패:', error);
            // 네트워크 오류 시 이벤트를 다시 큐에 추가
            eventsToSend.forEach(event => {
                event.retryCount = (event.retryCount || 0) + 1;
                if (event.retryCount <= 3) {
                    this.events.push(event);
                }
            });
        }
    }

    clearTrackingData() {
        this.events = [];
        sessionStorage.removeItem('analyticsSessionId');
        localStorage.removeItem('analyticsUserId');
    }

    // 커스텀 이벤트 추적을 위한 공개 메서드
    track(eventType, data = {}) {
        this.trackEvent(eventType, data);
    }

    // 전환 추적
    trackConversion(conversionType, value = null) {
        this.trackEvent('conversion', {
            type: conversionType,
            value
        });
    }

    // 성능 메트릭 추적
    trackPerformance() {
        if (!this.trackingEnabled) return;

        if (window.performance && window.performance.timing) {
            const timing = window.performance.timing;
            const data = {
                loadTime: timing.loadEventEnd - timing.navigationStart,
                domContentLoadedTime: timing.domContentLoadedEventEnd - timing.navigationStart,
                firstByteTime: timing.responseStart - timing.navigationStart,
                dnsLookupTime: timing.domainLookupEnd - timing.domainLookupStart,
                connectTime: timing.connectEnd - timing.connectStart
            };

            this.trackEvent('performance_metrics', data);
        }
    }

    // 유틸리티 메서드
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// 페이지 로드 완료 후 분석 시스템 시작
document.addEventListener('DOMContentLoaded', () => {
    window.analytics = new Analytics();
    
    // 페이지 로드 성능 추적
    window.addEventListener('load', () => {
        setTimeout(() => {
            window.analytics.trackPerformance();
        }, 1000);
    });
});

// A/B 테스트 시스템
class ABTesting {
    constructor() {
        this.activeTests = [];
        this.userVariants = {};
        this.init();
    }

    init() {
        this.loadUserVariants();
        this.runActiveTests();
    }

    loadUserVariants() {
        const stored = localStorage.getItem('abTestVariants');
        if (stored) {
            try {
                this.userVariants = JSON.parse(stored);
            } catch (e) {
                this.userVariants = {};
            }
        }
    }

    saveUserVariants() {
        localStorage.setItem('abTestVariants', JSON.stringify(this.userVariants));
    }

    runActiveTests() {
        // CTA 버튼 텍스트 A/B 테스트
        this.runTest('cta-button-text', {
            control: '빠른 상담 시작',
            variant: '무료 상담 받기'
        }, '#quickConsultBtn');

        // 가격 표시 A/B 테스트
        this.runTest('pricing-display', {
            control: 'original',
            variant: 'highlighted'
        }, '.pricing-grid');
    }

    runTest(testId, variants, selector) {
        // 이미 사용자에게 할당된 변형이 있는지 확인
        if (!this.userVariants[testId]) {
            // 50:50 분할
            const variantKey = Math.random() < 0.5 ? 'control' : 'variant';
            this.userVariants[testId] = variantKey;
            this.saveUserVariants();
        }

        const userVariant = this.userVariants[testId];
        const element = document.querySelector(selector);

        if (element) {
            this.applyVariant(testId, userVariant, variants, element);
            
            // 분석 시스템에 변형 정보 전송
            if (window.analytics) {
                window.analytics.track('ab_test_variant', {
                    testId,
                    variant: userVariant,
                    value: variants[userVariant]
                });
            }
        }
    }

    applyVariant(testId, variant, variants, element) {
        switch (testId) {
            case 'cta-button-text':
                if (element) {
                    element.textContent = variants[variant];
                }
                break;
                
            case 'pricing-display':
                if (variant === 'variant' && element) {
                    // 프로 플랜 강조
                    const proCard = element.querySelector('.pricing-card:nth-child(2)');
                    if (proCard) {
                        proCard.classList.add('highlighted');
                        proCard.style.transform = 'scale(1.05)';
                        proCard.style.zIndex = '10';
                    }
                }
                break;
        }
    }

    trackConversion(testId, conversionValue = 1) {
        if (window.analytics) {
            window.analytics.track('ab_test_conversion', {
                testId,
                variant: this.userVariants[testId],
                conversionValue
            });
        }
    }
}

// A/B 테스트 시스템 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.abTesting = new ABTesting();
});