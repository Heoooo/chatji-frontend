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
  
  // 🔥 자동완성 및 탭 관련 상태
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' 또는 'wishlist'
  
  // 🔥 찜 목록 상태 (초기값은 LocalStorage에서 가져옴)
  const [wishlist, setWishlist] = useState(() => {
    const saved = localStorage.getItem('chatji-wishlist');
    return saved ? JSON.parse(saved) : [];
  });

  const observerTarget = useRef(null);
  const API_BASE_URL = "http://localhost:8080"; // 실제 배포시 본인의 Render 주소로 유지!

  // 찜 목록이 바뀔 때마다 LocalStorage에 저장
  useEffect(() => {
    localStorage.setItem('chatji-wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  const fetchProducts = async (currentKeyword, currentSort, startIdx) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/products?keyword=${encodeURIComponent(currentKeyword)}&sort=${currentSort}&start=${startIdx}`);
      if (!res.ok) throw new Error('서버 통신 실패');
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
    e.preventDefault();
    if (!keyword.trim()) return;
    setActiveTab('all'); // 검색 시 전체 목록 탭으로 강제 이동
    setShowSuggestions(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setProducts([]);
    setPage(1);
    setHasMore(true);
    fetchProducts(keyword, sort, 1);
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
          const nextStart = page + 20;
          setPage(nextStart);
          fetchProducts(keyword, sort, nextStart);
        }
      },
      { threshold: 1.0 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [loading, hasMore, products, page, keyword, sort, activeTab]);

  return (
    <div className="container">
      <header className="header">
        <h1 className="logo"><span className="gradient-text">Chat</span>ji</h1>
      </header>

      {/* 탭 메뉴 추가 */}
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
        </form>
      )}

      {activeTab === 'all' && products.length > 0 && (
        <div className="filter-container">
          <select value={sort} onChange={(e) => { setSort(e.target.value); setProducts([]); setPage(1); fetchProducts(keyword, e.target.value, 1); }} className="sort-select">
            <option value="sim">정확도순</option>
            <option value="price_asc">가격 낮은순</option>
            <option value="price_dsc">가격 높은순</option>
          </select>
        </div>
      )}

      <main className="product-grid">
        {/* 현재 탭에 맞는 리스트 렌더링 */}
        {(activeTab === 'all' ? products : wishlist).map((product, idx) => (
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
