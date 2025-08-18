// 블로그 시스템
class BlogSystem {
    constructor() {
        this.posts = [];
        this.currentPage = 1;
        this.postsPerPage = 6;
        this.currentCategory = 'all';
        this.currentSort = 'date-desc';
        this.searchQuery = '';
        
        this.init();
    }

    async init() {
        await this.loadPosts();
        this.bindEvents();
        this.renderFeaturedPosts();
        this.renderPosts();
        this.renderPagination();
    }

    bindEvents() {
        // 카테고리 필터
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentCategory = e.target.dataset.category;
                this.currentPage = 1;
                this.renderPosts();
                this.renderPagination();
            });
        });

        // 검색
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        
        const handleSearch = () => {
            this.searchQuery = searchInput.value.trim();
            this.currentPage = 1;
            this.renderPosts();
            this.renderPagination();
        };

        searchBtn.addEventListener('click', handleSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });

        // 정렬
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.renderPosts();
        });
    }

    async loadPosts() {
        try {
            const response = await fetch('/api/blog/posts');
            if (response.ok) {
                this.posts = await response.json();
            } else {
                // 서버에서 데이터를 가져올 수 없으면 더미 데이터 사용
                this.posts = this.getDummyPosts();
            }
        } catch (error) {
            console.error('Failed to load posts:', error);
            this.posts = this.getDummyPosts();
        }
    }

    getDummyPosts() {
        return [
            {
                id: '1',
                title: '2024년 이노비즈 인증 변경사항 완벽 가이드',
                slug: 'innobiz-2024-guide',
                excerpt: '올해 새롭게 변경된 이노비즈 인증 요건과 절차를 상세히 알아보고, 성공적인 인증을 위한 핵심 포인트를 확인하세요.',
                content: '이노비즈 인증은 혁신형 중소기업을 선별하여 지원하는 정부 제도입니다...',
                category: 'guide',
                tags: ['이노비즈', '인증', '가이드', '2024'],
                author: 'AI휴먼 전문팀',
                publishedAt: '2024-01-15T10:00:00Z',
                updatedAt: '2024-01-15T10:00:00Z',
                views: 1250,
                featured: true,
                image: '/assets/blog/innobiz-guide.jpg',
                readTime: 8
            },
            {
                id: '2',
                title: '벤처기업 등록 시 자주 묻는 질문 TOP 10',
                slug: 'venture-faq-top10',
                excerpt: '벤처기업 등록 과정에서 가장 많이 받는 질문들과 명확한 답변을 정리했습니다. 등록 전 반드시 확인하세요!',
                content: '벤처기업 등록은 스타트업의 중요한 첫 걸음입니다...',
                category: 'tips',
                tags: ['벤처기업', 'FAQ', '등록', '스타트업'],
                author: '김전문',
                publishedAt: '2024-01-10T14:30:00Z',
                updatedAt: '2024-01-10T14:30:00Z',
                views: 980,
                featured: true,
                image: '/assets/blog/venture-faq.jpg',
                readTime: 6
            },
            {
                id: '3',
                title: '나라장터 등록 완료! A기업 성공 사례 분석',
                slug: 'nps-success-case-study',
                excerpt: 'IT 솔루션 회사 A기업이 나라장터 등록을 통해 매출 300% 증가를 달성한 실제 사례를 분석해보겠습니다.',
                content: 'A기업은 중소 IT 솔루션 회사로 민간 시장에서만 활동하고 있었습니다...',
                category: 'case-study',
                tags: ['나라장터', '성공사례', '매출증가', 'IT'],
                author: '박사례',
                publishedAt: '2024-01-08T09:15:00Z',
                updatedAt: '2024-01-08T09:15:00Z',
                views: 756,
                featured: true,
                image: '/assets/blog/nps-case.jpg',
                readTime: 10
            },
            {
                id: '4',
                title: '연구소 신설 시 놓치면 안 되는 법적 요건들',
                slug: 'research-institute-legal-requirements',
                excerpt: '기업부설 연구소 신설 과정에서 반드시 준수해야 할 법적 요건들을 체크리스트 형태로 정리했습니다.',
                content: '기업부설 연구소 신설은 단순히 공간을 마련하는 것이 아닙니다...',
                category: 'guide',
                tags: ['연구소', '법적요건', '신설', '체크리스트'],
                author: '이연구',
                publishedAt: '2024-01-05T16:45:00Z',
                updatedAt: '2024-01-05T16:45:00Z',
                views: 642,
                featured: false,
                image: '/assets/blog/research-legal.jpg',
                readTime: 7
            },
            {
                id: '5',
                title: '정부지원사업 신청 전 준비해야 할 서류 총정리',
                slug: 'government-support-documents',
                excerpt: '정부지원사업 신청 시 필요한 서류들을 사업 유형별로 분류하고, 준비 시 주의사항을 상세히 안내합니다.',
                content: '정부지원사업은 기업의 성장에 큰 도움이 되지만, 복잡한 서류 준비가 필요합니다...',
                category: 'guide',
                tags: ['정부지원사업', '서류', '신청', '준비'],
                author: 'AI휴먼 전문팀',
                publishedAt: '2024-01-03T11:20:00Z',
                updatedAt: '2024-01-03T11:20:00Z',
                views: 534,
                featured: false,
                image: '/assets/blog/govt-documents.jpg',
                readTime: 9
            },
            {
                id: '6',
                title: '2024년 행정대행 업계 동향과 전망',
                slug: 'industry-trends-2024',
                excerpt: '디지털 전환이 가속화되면서 행정대행 업계에도 큰 변화가 일어나고 있습니다. 2024년 주요 동향을 분석합니다.',
                content: '코로나19 이후 디지털 전환이 가속화되면서 행정 절차의 온라인화가 빠르게 진행되고 있습니다...',
                category: 'news',
                tags: ['업계동향', '디지털전환', '2024', '전망'],
                author: '최동향',
                publishedAt: '2024-01-01T08:00:00Z',
                updatedAt: '2024-01-01T08:00:00Z',
                views: 423,
                featured: false,
                image: '/assets/blog/industry-trends.jpg',
                readTime: 5
            }
        ];
    }

    getFilteredPosts() {
        let filtered = [...this.posts];

        // 카테고리 필터링
        if (this.currentCategory !== 'all') {
            filtered = filtered.filter(post => post.category === this.currentCategory);
        }

        // 검색 필터링
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(post => 
                post.title.toLowerCase().includes(query) ||
                post.excerpt.toLowerCase().includes(query) ||
                post.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }

        // 정렬
        filtered.sort((a, b) => {
            switch (this.currentSort) {
                case 'date-desc':
                    return new Date(b.publishedAt) - new Date(a.publishedAt);
                case 'date-asc':
                    return new Date(a.publishedAt) - new Date(b.publishedAt);
                case 'title-asc':
                    return a.title.localeCompare(b.title);
                case 'views-desc':
                    return b.views - a.views;
                default:
                    return new Date(b.publishedAt) - new Date(a.publishedAt);
            }
        });

        return filtered;
    }

    renderFeaturedPosts() {
        const container = document.getElementById('featuredPosts');
        const featuredPosts = this.posts.filter(post => post.featured).slice(0, 3);

        if (featuredPosts.length === 0) {
            container.innerHTML = '<p class="no-posts">주요 포스트가 없습니다.</p>';
            return;
        }

        container.innerHTML = featuredPosts.map(post => `
            <article class="featured-post">
                <div class="featured-post-image">
                    <img src="${post.image}" alt="${post.title}" onerror="this.src='/assets/blog/default.jpg'">
                    <div class="post-category">${this.getCategoryName(post.category)}</div>
                </div>
                <div class="featured-post-content">
                    <h3 class="featured-post-title">
                        <a href="/blog-post.html?id=${post.id}">${post.title}</a>
                    </h3>
                    <p class="featured-post-excerpt">${post.excerpt}</p>
                    <div class="featured-post-meta">
                        <span class="post-author">${post.author}</span>
                        <span class="post-date">${this.formatDate(post.publishedAt)}</span>
                        <span class="post-read-time">${post.readTime}분 읽기</span>
                    </div>
                </div>
            </article>
        `).join('');
    }

    renderPosts() {
        const container = document.getElementById('postsGrid');
        const filtered = this.getFilteredPosts();
        const start = (this.currentPage - 1) * this.postsPerPage;
        const end = start + this.postsPerPage;
        const pagePosts = filtered.slice(start, end);

        if (pagePosts.length === 0) {
            container.innerHTML = '<div class="no-posts"><p>조건에 맞는 포스트가 없습니다.</p></div>';
            return;
        }

        container.innerHTML = pagePosts.map(post => `
            <article class="post-card">
                <div class="post-image">
                    <img src="${post.image}" alt="${post.title}" onerror="this.src='/assets/blog/default.jpg'">
                    <div class="post-category">${this.getCategoryName(post.category)}</div>
                </div>
                <div class="post-content">
                    <h3 class="post-title">
                        <a href="/blog-post.html?id=${post.id}">${post.title}</a>
                    </h3>
                    <p class="post-excerpt">${post.excerpt}</p>
                    <div class="post-tags">
                        ${post.tags.map(tag => `<span class="post-tag">${tag}</span>`).join('')}
                    </div>
                    <div class="post-meta">
                        <div class="post-author-date">
                            <span class="post-author">${post.author}</span>
                            <span class="post-date">${this.formatDate(post.publishedAt)}</span>
                        </div>
                        <div class="post-stats">
                            <span class="post-views">
                                <svg viewBox="0 0 24 24" width="16" height="16">
                                    <path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                                </svg>
                                ${post.views.toLocaleString()}
                            </span>
                            <span class="post-read-time">${post.readTime}분</span>
                        </div>
                    </div>
                </div>
            </article>
        `).join('');
    }

    renderPagination() {
        const container = document.getElementById('pagination');
        const filtered = this.getFilteredPosts();
        const totalPages = Math.ceil(filtered.length / this.postsPerPage);

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let paginationHTML = '<div class="pagination-buttons">';

        // 이전 버튼
        if (this.currentPage > 1) {
            paginationHTML += `<button class="pagination-btn" onclick="blogSystem.goToPage(${this.currentPage - 1})">이전</button>`;
        }

        // 페이지 번호들
        for (let i = 1; i <= totalPages; i++) {
            if (i === this.currentPage) {
                paginationHTML += `<button class="pagination-btn active">${i}</button>`;
            } else if (i <= 3 || i >= totalPages - 2 || Math.abs(i - this.currentPage) <= 1) {
                paginationHTML += `<button class="pagination-btn" onclick="blogSystem.goToPage(${i})">${i}</button>`;
            } else if (i === 4 && this.currentPage > 6) {
                paginationHTML += '<span class="pagination-dots">...</span>';
            } else if (i === totalPages - 3 && this.currentPage < totalPages - 5) {
                paginationHTML += '<span class="pagination-dots">...</span>';
            }
        }

        // 다음 버튼
        if (this.currentPage < totalPages) {
            paginationHTML += `<button class="pagination-btn" onclick="blogSystem.goToPage(${this.currentPage + 1})">다음</button>`;
        }

        paginationHTML += '</div>';
        container.innerHTML = paginationHTML;
    }

    goToPage(page) {
        this.currentPage = page;
        this.renderPosts();
        this.renderPagination();
        
        // 스크롤을 포스트 그리드 상단으로 이동
        document.getElementById('postsGrid').scrollIntoView({ behavior: 'smooth' });
    }

    getCategoryName(category) {
        const categoryNames = {
            'guide': '가이드',
            'news': '뉴스',
            'tips': '팁',
            'case-study': '사례 연구'
        };
        return categoryNames[category] || category;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

// 페이지 로드 시 블로그 시스템 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.blogSystem = new BlogSystem();
});