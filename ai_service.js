// AI 서비스 모듈 (LLM 통합)
const https = require('https');
const fs = require('fs');
const path = require('path');

class AIService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY || null;
        this.baseURL = 'api.openai.com';
        this.model = 'gpt-3.5-turbo';
        this.maxTokens = 500;
        this.temperature = 0.7;
        
        // 세션별 토큰 사용량 추적
        this.sessionTokenUsage = new Map();
        this.sessionCostLimit = 1000; // 원 단위
        this.tokenCostPer1K = 2; // 1000토큰당 2원 (예시)
        
        // 응답 캐시 (10분)
        this.responseCache = new Map();
        this.cacheTimeout = 10 * 60 * 1000; // 10분
        
        // 지식 베이스
        this.knowledgeBase = new Map();
        this.pricingData = null;
        
        this.loadKnowledgeBase();
        this.loadPricingData();
    }

    // 지식 베이스 로드
    loadKnowledgeBase() {
        try {
            const knowledgeDir = path.join(__dirname, 'data', 'knowledge');
            if (fs.existsSync(knowledgeDir)) {
                const files = fs.readdirSync(knowledgeDir);
                files.forEach(file => {
                    if (file.endsWith('.md')) {
                        const filePath = path.join(knowledgeDir, file);
                        const content = fs.readFileSync(filePath, 'utf8');
                        const key = file.replace('.md', '');
                        this.knowledgeBase.set(key, content);
                    }
                });
                console.log(`✅ 지식 베이스 ${this.knowledgeBase.size}개 파일 로드`);
            }
        } catch (error) {
            console.error('지식 베이스 로드 오류:', error);
        }
    }

    // 가격 데이터 로드
    loadPricingData() {
        try {
            const pricingPath = path.join(__dirname, 'data', 'pricing.json');
            if (fs.existsSync(pricingPath)) {
                const content = fs.readFileSync(pricingPath, 'utf8');
                this.pricingData = JSON.parse(content);
                console.log('✅ 가격 데이터 로드 완료');
            }
        } catch (error) {
            console.error('가격 데이터 로드 오류:', error);
        }
    }

    // 지식 베이스에서 관련 정보 검색
    searchKnowledge(query, maxSnippets = 3) {
        const results = [];
        const queryLower = query.toLowerCase();

        // 키워드 매칭으로 관련 문서 찾기
        for (const [key, content] of this.knowledgeBase.entries()) {
            const contentLower = content.toLowerCase();
            let score = 0;
            
            // 쿼리 단어들이 문서에 포함된 정도로 점수 계산
            const queryWords = queryLower.split(/\\s+/);
            queryWords.forEach(word => {
                const matches = (contentLower.match(new RegExp(word, 'g')) || []).length;
                score += matches;
            });

            if (score > 0) {
                // 관련 섹션 추출 (1000자 이내)
                const snippets = this.extractRelevantSnippets(content, queryWords);
                results.push({
                    key,
                    score,
                    snippets: snippets.slice(0, 2) // 최대 2개 스니펫
                });
            }
        }

        // 점수 순으로 정렬하고 상위 결과 반환
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, maxSnippets);
    }

    // 관련 스니펫 추출
    extractRelevantSnippets(content, queryWords) {
        const lines = content.split('\\n');
        const snippets = [];
        let currentSnippet = [];
        let snippetScore = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineLower = line.toLowerCase();
            let lineScore = 0;

            // 라인별 관련도 점수 계산
            queryWords.forEach(word => {
                if (lineLower.includes(word)) {
                    lineScore += 1;
                }
            });

            if (lineScore > 0 || currentSnippet.length > 0) {
                currentSnippet.push(line);
                snippetScore += lineScore;

                // 스니펫이 너무 길어지면 종료
                if (currentSnippet.join('\\n').length > 500) {
                    if (snippetScore > 0) {
                        snippets.push({
                            text: currentSnippet.join('\\n').substring(0, 500) + '...',
                            score: snippetScore
                        });
                    }
                    currentSnippet = [];
                    snippetScore = 0;
                }
            } else if (currentSnippet.length > 0) {
                // 관련성이 떨어지는 라인이 나오면 현재 스니펫 저장
                if (snippetScore > 0) {
                    snippets.push({
                        text: currentSnippet.join('\\n'),
                        score: snippetScore
                    });
                }
                currentSnippet = [];
                snippetScore = 0;
            }
        }

        // 마지막 스니펫 처리
        if (currentSnippet.length > 0 && snippetScore > 0) {
            snippets.push({
                text: currentSnippet.join('\\n'),
                score: snippetScore
            });
        }

        return snippets.sort((a, b) => b.score - a.score);
    }

    // 가격 정보 검색
    searchPricing(serviceKeywords) {
        if (!this.pricingData) return null;

        const results = [];
        const keywordsLower = serviceKeywords.map(k => k.toLowerCase());

        this.pricingData.services.forEach(service => {
            let score = 0;
            const searchText = (service.name + ' ' + service.description).toLowerCase();
            
            keywordsLower.forEach(keyword => {
                if (searchText.includes(keyword)) {
                    score += 1;
                }
            });

            if (score > 0) {
                results.push({
                    ...service,
                    score
                });
            }
        });

        return results.sort((a, b) => b.score - a.score).slice(0, 3);
    }

    // 세션별 비용 한도 확인
    checkCostLimit(sessionId, estimatedTokens) {
        const currentUsage = this.sessionTokenUsage.get(sessionId) || 0;
        const estimatedCost = (estimatedTokens / 1000) * this.tokenCostPer1K;
        const totalCost = currentUsage + estimatedCost;

        return totalCost <= this.sessionCostLimit;
    }

    // 토큰 사용량 기록
    recordTokenUsage(sessionId, tokens) {
        const currentUsage = this.sessionTokenUsage.get(sessionId) || 0;
        const cost = (tokens / 1000) * this.tokenCostPer1K;
        this.sessionTokenUsage.set(sessionId, currentUsage + cost);
    }

    // 캐시 키 생성
    generateCacheKey(query, mode) {
        const cleanQuery = query.toLowerCase().replace(/[^a-z0-9가-힣\\s]/g, '');
        return `${mode}-${cleanQuery}`;
    }

    // 캐시에서 응답 조회
    getCachedResponse(cacheKey) {
        const cached = this.responseCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.response;
        }
        return null;
    }

    // 캐시에 응답 저장
    setCachedResponse(cacheKey, response) {
        this.responseCache.set(cacheKey, {
            response,
            timestamp: Date.now()
        });

        // 메모리 관리: 오래된 캐시 정리
        if (this.responseCache.size > 100) {
            const oldestKey = this.responseCache.keys().next().value;
            this.responseCache.delete(oldestKey);
        }
    }

    // 개인정보 마스킹
    maskPersonalInfo(text) {
        return text
            .replace(/\\b[0-9]{2,3}-[0-9]{3,4}-[0-9]{4}\\b/g, '***-****-****') // 전화번호
            .replace(/\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b/g, '***@***.***') // 이메일
            .replace(/\\b[가-힣]{2,4}\\b(?=\\s*(님|씨|대표|이사|과장|부장))/g, '***'); // 이름
    }

    // LLM API 호출
    async callLLM(messages, sessionId, timeout = 2500) {
        if (!this.apiKey) {
            throw new Error('OpenAI API 키가 설정되지 않았습니다.');
        }

        // 비용 한도 확인
        const estimatedTokens = messages.reduce((sum, msg) => sum + msg.content.length / 4, 0);
        if (!this.checkCostLimit(sessionId, estimatedTokens)) {
            throw new Error('세션별 비용 한도를 초과했습니다.');
        }

        const requestData = {
            model: this.model,
            messages: messages,
            max_tokens: this.maxTokens,
            temperature: this.temperature,
            timeout: timeout / 1000
        };

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('LLM 응답 시간 초과'));
            }, timeout);

            const postData = JSON.stringify(requestData);
            
            const options = {
                hostname: this.baseURL,
                port: 443,
                path: '/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    clearTimeout(timeoutId);
                    
                    try {
                        const response = JSON.parse(data);
                        
                        if (response.error) {
                            reject(new Error(response.error.message));
                        } else {
                            // 토큰 사용량 기록
                            if (response.usage) {
                                this.recordTokenUsage(sessionId, response.usage.total_tokens);
                            }
                            
                            resolve(response.choices[0].message.content);
                        }
                    } catch (error) {
                        reject(new Error('LLM 응답 파싱 오류: ' + error.message));
                    }
                });
            });

            req.on('error', (error) => {
                clearTimeout(timeoutId);
                reject(new Error('LLM API 호출 오류: ' + error.message));
            });

            req.write(postData);
            req.end();
        });
    }

    // AI 모드 챗봇 응답 생성
    async generateAIResponse(query, sessionId, userInfo = null) {
        try {
            // 개인정보 마스킹
            const maskedQuery = this.maskPersonalInfo(query);
            
            // 캐시 확인 (개인정보가 포함되지 않은 경우에만)
            const cacheKey = this.generateCacheKey(maskedQuery, 'ai');
            const cached = this.getCachedResponse(cacheKey);
            if (cached && !this.containsPersonalInfo(query)) {
                return {
                    ...cached,
                    cached: true
                };
            }

            // 지식 베이스에서 관련 정보 검색
            const knowledgeResults = this.searchKnowledge(maskedQuery);
            
            // 가격 정보 검색
            const serviceKeywords = this.extractServiceKeywords(maskedQuery);
            const pricingResults = this.searchPricing(serviceKeywords);

            // 시스템 프롬프트 구성
            const systemPrompt = this.buildSystemPrompt(knowledgeResults, pricingResults);
            
            // 메시지 구성
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: maskedQuery }
            ];

            // LLM 호출
            const response = await this.callLLM(messages, sessionId);
            
            const result = {
                content: response,
                mode: 'ai',
                sources: this.buildSourcesInfo(knowledgeResults, pricingResults),
                cached: false
            };

            // 캐시 저장 (개인정보가 없는 경우에만)
            if (!this.containsPersonalInfo(query)) {
                this.setCachedResponse(cacheKey, result);
            }

            return result;

        } catch (error) {
            console.error('AI 응답 생성 오류:', error);
            
            // 폴백: 규칙 기반 응답
            return {
                content: '죄송합니다. 현재 AI 분석이 일시적으로 불가합니다. 규칙 기반으로 답변드리겠습니다.\\n\\n' + 
                        this.generateRuleBasedResponse(query),
                mode: 'fallback',
                error: error.message
            };
        }
    }

    // 시스템 프롬프트 구성
    buildSystemPrompt(knowledgeResults, pricingResults) {
        let prompt = `너는 'AI휴먼'의 B2B 대행 플랫폼 상담원이다.

## 역할과 서비스
- 서비스: 행정·인증 대행(연구소·벤처·이노·메인비즈·GS·나라장터 등), 홀로그램 사이니지, 키오스크
- 답변 원칙: 정확·간결·정중, 한국어 기본, 과장 금지, 법적 확정 표현 금지
- 개인정보 요청 시 동의 고지 필수

## 답변 가이드라인
- 결과는 "예시/일반적 범주" 기준으로 안내
- 구체 견적은 상담으로 유도
- 자료가 불충분하면 추가질문 후 요약·선택지 제시
- 응답 형식: 짧은 요약 → 항목형 단계(최대 5개) → CTA("빠른 상담 시작")

## 법적 한계
- "가능/예시/권장" 등의 표현 사용
- 법률·행정 확정 표현 피하기
- 민감 주제 시 일반 가이드 + 전문가 상담 권유`;

        // 지식 베이스 정보 추가
        if (knowledgeResults.length > 0) {
            prompt += '\\n\\n## 참고 자료\\n';
            knowledgeResults.forEach((result, index) => {
                prompt += `### ${result.key}\\n`;
                result.snippets.forEach(snippet => {
                    prompt += snippet.text + '\\n\\n';
                });
            });
        }

        // 가격 정보 추가
        if (pricingResults && pricingResults.length > 0) {
            prompt += '\\n## 가격 정보 (참고용)\\n';
            pricingResults.forEach(service => {
                prompt += `- ${service.name}: ${service.basePrice.toLocaleString()}원 (${service.timeframe})\\n`;
                prompt += `  ${service.description}\\n`;
            });
        }

        return prompt;
    }

    // 소스 정보 구성
    buildSourcesInfo(knowledgeResults, pricingResults) {
        const sources = [];
        
        if (knowledgeResults.length > 0) {
            knowledgeResults.forEach(result => {
                sources.push(`서비스 가이드 v2025-08`);
            });
        }
        
        if (pricingResults && pricingResults.length > 0) {
            sources.push('가격표 v1.2');
        }

        return sources;
    }

    // 서비스 키워드 추출
    extractServiceKeywords(query) {
        const keywords = [];
        const queryLower = query.toLowerCase();
        
        const serviceTerms = [
            '연구소', '벤처', '이노비즈', '메인비즈', 'gs인증', '나라장터', 
            '중소기업', '직접생산', '하이서울', '강소기업', '공장등록',
            '통신판매', '차량등록', '소프트웨어'
        ];

        serviceTerms.forEach(term => {
            if (queryLower.includes(term)) {
                keywords.push(term);
            }
        });

        return keywords;
    }

    // 개인정보 포함 여부 확인
    containsPersonalInfo(text) {
        const patterns = [
            /\\b[0-9]{2,3}-[0-9]{3,4}-[0-9]{4}\\b/, // 전화번호
            /\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b/, // 이메일
            /\\b[가-힣]{2,4}\\s*(님|씨|대표|이사|과장|부장)\\b/ // 이름+호칭
        ];

        return patterns.some(pattern => pattern.test(text));
    }

    // 규칙 기반 응답 생성 (폴백용)
    generateRuleBasedResponse(query) {
        const queryLower = query.toLowerCase();
        
        // 간단한 키워드 매칭
        if (queryLower.includes('가격') || queryLower.includes('비용')) {
            return '서비스별 가격은 복잡도와 처리 기간에 따라 다릅니다. 정확한 견적은 상담을 통해 제공해드립니다.';
        }
        
        if (queryLower.includes('기간') || queryLower.includes('시간')) {
            return '처리 기간은 서비스 종류와 서류 완비 상태에 따라 차이가 있습니다. 일반적으로 15일~90일 소요됩니다.';
        }
        
        return '구체적인 상담을 위해 전문가와 연결해드리겠습니다. 빠른 상담을 원하시면 상담 신청을 해주세요.';
    }
}

module.exports = AIService;