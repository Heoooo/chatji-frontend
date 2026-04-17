import { useState, useRef, useEffect } from 'react';
import './index.css';

function App() {
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState('sim');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  
  // 🔥 자동완성 및 탭 관련 상태
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' 또는 'wishlist'
  
  // 🔥 찜 목록 상태 (초기값은 LocalStorage에서 가져옴)
  const [wishlist, setWishlist] = useState(() => {
    const saved = localStorage.getItem('chatji-wishlist');
    return saved ? JSON.parse(saved) : [];
  });

  // 🔥 최근 검색어 상태
  const [recentSearches, setRecentSearches] = useState(() => {
    const saved = localStorage.getItem('chatji-recent');
    return saved ? JSON.parse(saved) : [];
  });

  // 🔥 핫딜 상태
  const [hotDeals, setHotDeals] = useState([]);
  const [fetchingHotDeals, setFetchingHotDeals] = useState(false);
  const hotDealsRef = useRef(null); // 스크롤 제어를 위한 Ref

  const observerTarget = useRef(null);
  const API_BASE_URL = "https://chatji-backend.onrender.com"; // 실서버 주소로 최종 반영!
  // const API_BASE_URL = "http://localhost:8080"; // 개발용 로컬 주소 (필요 시 변경)

  // 핫딜 좌우 스크롤 함수
  const scrollHotDeals = (direction) => {
    if (hotDealsRef.current) {
      const scrollAmount = 300;
      hotDealsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // 핫딜 데이터 가져오기
  const fetchHotDeals = async () => {
    try {
      setFetchingHotDeals(true);
      const res = await fetch(`${API_BASE_URL}/api/hotdeals`);
      const data = await res.json();
      setHotDeals(data);
    } catch (err) {
      console.error("HotDeal Fetch Error:", err);
    } finally {
      setFetchingHotDeals(false);
    }
  };

  // 초기 로딩 시 및 30초마다 핫딜 자동으로 가져오기 (실시간성 확보)
  useEffect(() => {
    fetchHotDeals();
    
    // 30초마다 백엔드에 새로운 핫딜이 있는지 확인
    const intervalId = setInterval(() => {
      fetchHotDeals();
    }, 30000); // 30,000ms = 30초

    return () => clearInterval(intervalId); // 컴포넌트 언마운트 시 정리
  }, []);

  // 찜 목록이 바뀔 때마다 LocalStorage에 저장
  useEffect(() => {
    localStorage.setItem('chatji-wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  // 최근 검색어가 바뀔 때마다 LocalStorage에 저장
  useEffect(() => {
    localStorage.setItem('chatji-recent', JSON.stringify(recentSearches));
  }, [recentSearches]);

  const fetchProducts = async (currentKeyword, currentSort, startIdx, currentMin, currentMax) => {
    try {
      setLoading(true);
      let url = `${API_BASE_URL}/api/products?keyword=${encodeURIComponent(currentKeyword)}&sort=${currentSort}&start=${startIdx}`;
      if (currentMin) url += `&minPrice=${currentMin}`;
      if (currentMax) url += `&maxPrice=${currentMax}`;
      
      const res = await fetch(url);
      const data = await res.json();
      if (data.length === 0) setHasMore(false);
      setProducts(prev => startIdx === 1 ? data : [...prev, ...data]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!keyword.trim()) return;

    // 최근 검색어 업데이트
    const updated = [keyword, ...recentSearches.filter(s => s !== keyword)].slice(0, 5);
    setRecentSearches(updated);

    setActiveTab('all'); // 검색 시 전체 목록 탭으로 강제 이동
    setShowSuggestions(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setProducts([]);
    setPage(1);
    setHasMore(true);
    fetchProducts(keyword, sort, 1, minPrice, maxPrice);
  };

  // 찜하기 토글 함수
  const toggleWishlist = (e, product) => {
    e.preventDefault(); // 링크 이동 방지
    e.stopPropagation();
    const isExist = wishlist.find(p => p.productId === product.productId);
    if (isExist) {
        setWishlist(wishlist.filter(p => p.productId !== product.productId));
    } else {
        setWishlist([...wishlist, product]);
    }
  };

  const isWished = (productId) => wishlist.some(p => p.productId === productId);

  // 탭 변경 시 처리
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'wishlist') {
        setShowSuggestions(false);
        setProducts([]); // 찜 목록 볼 때는 일반 검색 결과 초기화 (선택 사항)
    }
  };

  // 자동완성 로직 (구글/네이버 백엔드 연동)
  const handleInputChange = async (e) => {
    const val = e.target.value;
    setKeyword(val);
    if (!val.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/suggestions?q=${encodeURIComponent(val)}`);
      const data = await res.json();
      let list = [];
      if (Array.isArray(data)) list = data[1] || [];
      else if (data.items && data.items[0]) list = data.items[0].map(item => Array.isArray(item) ? item[0] : item);
      setSuggestions(list.filter(s => typeof s === 'string').slice(0, 8));
      setShowSuggestions(list.length > 0);
    } catch (err) { console.error(err); }
  };

  // 무한 스크롤 (전체보기 탭에서만 동작)
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !loading && hasMore && products.length > 0 && activeTab === 'all') {
          const nextStart = page + 100;
          setPage(nextStart);
          fetchProducts(keyword, sort, nextStart, minPrice, maxPrice);
        }
      },
      { threshold: 1.0 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [loading, hasMore, products, page, keyword, sort, activeTab, minPrice, maxPrice]);

  return (
    <div className="container">
      <header className="header">
        <h1 className="logo"><span className="gradient-text">Chat</span>ji</h1>
      </header>

      {/* 탭 메뉴 */}
      <div className="tabs">
        <button className={activeTab === 'all' ? 'tab-btn active' : 'tab-btn'} onClick={() => handleTabChange('all')}>검색</button>
        <button className={activeTab === 'wishlist' ? 'tab-btn active' : 'tab-btn'} onClick={() => handleTabChange('wishlist')}>찜 목록 ({wishlist.length})</button>
      </div>

      {activeTab === 'all' && (
        <form className="search-form" onSubmit={handleSearch}>
          <div className="search-bar" style={{ position: "relative", zIndex: 1000 }}>
            <input type="text" placeholder="어떤 상품을 찾으시나요?" value={keyword} onChange={handleInputChange} onFocus={() => suggestions.length > 0 && setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} className="search-input" />
            <button type="submit" className="search-button" disabled={loading}>검색</button>
            {showSuggestions && (
              <div className="suggestion-dropdown">
                {suggestions.map((s, idx) => (
                  <div key={idx} onClick={() => { setKeyword(s); handleSearch({ preventDefault: () => {} }); }} className="suggestion-item">
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="price-filter">
            <input
              type="number"
              placeholder="최소 금액"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="price-input"
            />
            <span className="price-separator">~</span>
            <input
              type="number"
              placeholder="최대 금액"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="price-input"
            />

            {/* 정렬 셀렉트 박스 (이사 완료!) */}
            <select value={sort} onChange={(e) => { setSort(e.target.value); setProducts([]); setPage(1); fetchProducts(keyword, e.target.value, 1, minPrice, maxPrice); }} className="sort-select">
              <option value="sim">정확도순</option>
              <option value="price_asc">가격 낮은순</option>
              <option value="price_dsc">가격 높은순</option>
            </select>
          </div>
        </form>
      )}

      {/* 🏷️ 최근 검색어 (가격 필터 바로 아래로!) */}
      {activeTab === 'all' && recentSearches.length > 0 && (
        <div className="recent-searches">
          <span className="recent-label">최근 검색어:</span>
          {recentSearches.map((s, idx) => (
            <button key={idx} className="recent-tag" onClick={() => { setKeyword(s); setProducts([]); setPage(1); fetchProducts(s, sort, 1, minPrice, maxPrice); }}>
              {s}
            </button>
          ))}
          <button className="recent-clear" onClick={() => setRecentSearches([])}>초기화</button>
        </div>
      )}

      {/* 🔥 실시간 고검증 핫딜 섹션 (검색 결과가 없을 때만 노출!) */}
      {activeTab === 'all' && hotDeals.length > 0 && products.length === 0 && (
        <section className="hot-deals-section" style={{ marginTop: recentSearches.length > 0 ? "0" : "2rem" }}>
          <div className="section-header">
            <h2 className="section-title">🔥 실시간 고검증 핫딜</h2>
            <p className="section-subtitle">네이버 최저가 대비 <span className="highlight">10% 이상</span> 저렴한 상품만 엄선!</p>
            
            {/* v27: 훨씬 더 눈에 띄는 점수 산출 안내 배너 */}
            <div className="score-info-banner">
              <span className="info-icon">💡</span>
              <div className="info-content">
                <strong>Smart Score 안내:</strong> 실시간 할인율(70%)과 네이버 시세 대조(30%)를 통해 산출된 
                <b> Chatji만의 독자적인 가성비 지수</b>입니다. 점수가 높을수록 손해 없는 '역대급 딜'을 의미합니다.
              </div>
            </div>
          </div>
          <div className="hot-deals-container" style={{ position: 'relative' }}>
            {/* 좌우 버튼 추가 */}
            <button className="scroll-btn left" onClick={() => scrollHotDeals('left')}>‹</button>
            <div className="hot-deals-scroll" ref={hotDealsRef}>
              {hotDeals.map((deal) => (
                <a key={deal.id} href={deal.url} target="_blank" rel="noreferrer" className={`hot-deal-card ${deal.score >= 90 ? 'top-tier' : ''}`}>
                  <div className="hot-badge">
                    {deal.score >= 90 ? '🔥 HOT SCORE ' + deal.score : 'SUPER DEAL'}
                  </div>
                  <h4 className="hot-title">{deal.title}</h4>
                  
                  {/* v27: 점수 게이지 바 추가 */}
                  <div className="score-container">
                    <div className="score-label">Score: {deal.score || 50}</div>
                    <div className="score-bar-bg">
                      <div className="score-bar-fill" style={{ width: `${deal.score || 50}%` }}></div>
                    </div>
                  </div>

                  <div className="hot-footer">
                    <span className="hot-source">{deal.source}</span>
                    <span className="hot-price">{deal.currentPrice?.toLocaleString()}원~</span>
                  </div>
                </a>
              ))}
            </div>
            <button className="scroll-btn right" onClick={() => scrollHotDeals('right')}>›</button>
          </div>
        </section>
      )}


      <main className="product-grid">
        {/* 현재 탭에 맞는 리스트 렌더링 (안전한 배열 체크 추가) */}
        {(Array.isArray(activeTab === 'all' ? products : wishlist) ? (activeTab === 'all' ? products : wishlist) : []).map((product, idx) => (
          <div key={`${product.productId}-${idx}`} className="product-card-wrapper">
            <a href={product.link} target="_blank" rel="noreferrer" className="product-card">
              <div className="image-container">
                <img src={product.image} alt={product.title} loading="lazy" />
                <div className="mall-badge">{product.mallName}</div>
              </div>
              <div className="product-info">
                <h3 className="product-title">{product.title}</h3>
                <p className="product-price">{product.lprice.toLocaleString()}<span>원</span></p>
              </div>
            </a>
            {/* 찜 버튼 ❤️ */}
            <button className={`wish-btn ${isWished(product.productId) ? 'active' : ''}`} onClick={(e) => toggleWishlist(e, product)}>
              {isWished(product.productId) ? '❤️' : '🤍'}
            </button>
          </div>
        ))}
      </main>

      {activeTab === 'all' && products.length === 0 && !loading && keyword && <div className="empty-state">검색 결과가 없습니다.</div>}
      {activeTab === 'wishlist' && wishlist.length === 0 && <div className="empty-state">아직 찜한 상품이 없습니다. ❤️ 버튼을 눌러보세요!</div>}

      <div ref={observerTarget} style={{ height: '20px' }}></div>
      {loading && <div className="loader" style={{margin: "2rem auto"}}></div>}
    </div>
  );
}

export default App;
