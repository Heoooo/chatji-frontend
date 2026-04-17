import React, { useState, useEffect, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import './index.css';

function App() {
  const [keyword, setKeyword] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('sim');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [wishlist, setWishlist] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);

  const [userId, setUserId] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [hotDeals, setHotDeals] = useState([]);
  const hotDealsRef = useRef(null);
  const recoRef = useRef(null);
  const observerTarget = useRef(null);

  const API_BASE_URL = "https://chatji-backend.onrender.com";

  useEffect(() => {
    let storedId = localStorage.getItem('chatji_user_id');
    if (!storedId) {
      storedId = 'user-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('chatji_user_id', storedId);
    }
    setUserId(storedId);
    
    fetchHotDeals();
    fetchRecommendations(storedId);
    
    const interval = setInterval(() => {
        fetchHotDeals();
        fetchRecommendations(storedId);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchRecommendations = async (uid) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/recommendations?userId=${uid}`);
      const data = await res.json();
      setRecommendations(data);
    } catch (e) { console.error("Rec Error", e); }
  };

  const handleAction = async (category) => {
    if (!category) return;
    try {
      await fetch(`${API_BASE_URL}/api/recommendations/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, category })
      });
      fetchRecommendations(userId);
    } catch (e) { console.error("Action Error", e); }
  };

  const scrollHotDeals = (direction, ref) => {
    if (ref.current) {
      const scrollAmount = 300;
      ref.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const showPriceChart = async (productId, title) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/price-history/${productId}`);
      const data = await res.json();
      if (data.length > 0) {
        const chartData = data.map(d => ({
          time: new Date(d.timestamp).toLocaleDateString(),
          price: d.price
        }));
        setSelectedHistory({ title, data: chartData });
        setShowModal(true);
      } else {
        alert("아직 축적된 시세 데이터가 부족합니다! 잠시 후 다시 확인해 주세요. 📈");
      }
    } catch (e) { console.error("Chart Error", e); }
  };

  const fetchHotDeals = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/hotdeals`);
      const data = await res.json();
      setHotDeals(data);
    } catch (e) { console.error("HotDeal Error", e); }
  };

  const fetchProducts = async (kw, s, p, min, max) => {
    if (!kw) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/products?keyword=${kw}&sort=${s}&start=${p}&minPrice=${min || ''}&maxPrice=${max || ''}`);
      const data = await res.json();
      if (p === 1) setProducts(data);
      else setProducts(prev => [...prev, ...data]);
      if (p === 1 && kw) {
        setRecentSearches(prev => [kw, ...prev.filter(i => i !== kw)].slice(0, 5));
      }
    } catch (error) { console.error("Error fetching products:", error); }
    setLoading(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!keyword) return;
    setProducts([]);
    setPage(1);
    fetchProducts(keyword, sort, 1, minPrice, maxPrice);
  };

  const toggleWishlist = (e, product) => {
    e.preventDefault(); e.stopPropagation();
    const isWished = wishlist.find(item => item.productId === product.productId);
    if (isWished) setWishlist(wishlist.filter(item => item.productId !== product.productId));
    else {
      setWishlist([...wishlist, product]);
      if (product.category) handleAction(product.category);
    }
  };

  const goHome = () => {
    setKeyword('');
    setProducts([]);
    setActiveTab('all');
    setPage(1);
    setMinPrice('');
    setMaxPrice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container">
      <header className="header">
        <h1 className="logo" onClick={goHome} style={{ cursor: 'pointer' }}>Chatji</h1>
      </header>

      <div className="tabs">
        <button className={activeTab === 'all' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('all')}>쇼핑 검색</button>
        <button className={activeTab === 'wishlist' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('wishlist')}>찜 목록 ({wishlist.length})</button>
      </div>

      {activeTab === 'all' && (
        <form className="search-form" onSubmit={handleSearch}>
          <div className="search-bar">
            <input type="text" placeholder="어떤 상품을 찾으시나요?" value={keyword} onChange={(e) => setKeyword(e.target.value)} className="search-input" />
            <button type="submit" className="search-button" disabled={loading}>검색</button>
          </div>
          <div className="price-filter">
            <input type="number" placeholder="최소 금액" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="price-input" />
            <span className="price-separator">~</span>
            <input type="number" placeholder="최대 금액" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="price-input" />
            <select value={sort} onChange={(e) => { setSort(e.target.value); setProducts([]); setPage( page => 1); fetchProducts(keyword, e.target.value, 1, minPrice, maxPrice); }} className="sort-select">
              <option value="sim">정확도순</option>
              <option value="price_asc">가격 낮은순</option>
              <option value="price_dsc">가격 높은순</option>
            </select>
          </div>
        </form>
      )}

      {/* 🏷️ 개인화 추천 섹션 (v28) */}
      {activeTab === 'all' && recommendations.length > 0 && products.length === 0 && (
        <section className="hot-deals-section recommended">
          <div className="section-header">
            <h2 className="section-title">🎁 당신을 위한 맞춤 추천</h2>
            <p className="section-subtitle">당신의 쇼핑 취향을 분석해 선정한 특가 상품입니다.</p>
          </div>
          <div className="hot-deals-container" style={{ position: 'relative' }}>
            <button className="scroll-btn left" onClick={() => scrollHotDeals('left', recoRef)}>‹</button>
            <div className="hot-deals-scroll" ref={recoRef}>
              {recommendations.map((deal) => (
                <a key={deal.id} href={deal.url} target="_blank" rel="noreferrer" className="hot-deal-card reco" onClick={() => handleAction(deal.category)}>
                  <div className="hot-badge reco-badge">BEST PICK</div>
                  <h4 className="hot-title">{deal.title}</h4>
                  
                  {/* v28: 게이지 바 위에 점수 수치 배치 */}
                  <div className="score-container">
                    <div className="score-label">
                      <span>Smart Score</span>
                      <span className="score-num">{deal.score || 50}</span>
                    </div>
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
            <button className="scroll-btn right" onClick={() => scrollHotDeals('right', recoRef)}>›</button>
          </div>
        </section>
      )}

      {/* 🔥 실시간 고검증 핫딜 섹션 */}
      {activeTab === 'all' && hotDeals.length > 0 && products.length === 0 && (
        <section className="hot-deals-section">
          <div className="section-header">
            <h2 className="section-title">🔥 실시간 고검증 핫딜</h2>
            <div className="score-info-banner">
              <span className="info-icon">💡</span>
              <div className="info-content">
                <strong>Smart Score 산출 방식:</strong> 
                1. 네이버 최저가 대비 <b>추가 할인율(70%)</b> 
                2. 최근 7일 <b>시세 변동성(20%)</b> 
                3. 커뮤니티 <b>반응 및 신선도(10%)</b>를 조합한 점수입니다. 
                <br/>※ 90점 이상은 <b>'종결급 가격'</b>으로 강력 추천드립니다!
              </div>
            </div>
          </div>
          <div className="hot-deals-container" style={{ position: 'relative' }}>
            <button className="scroll-btn left" onClick={() => scrollHotDeals('left', hotDealsRef)}>‹</button>
            <div className="hot-deals-scroll" ref={hotDealsRef}>
              {hotDeals.map((deal) => (
                <a key={deal.id} href={deal.url} target="_blank" rel="noreferrer" className={`hot-deal-card ${deal.score >= 90 ? 'top-tier' : ''}`} onClick={() => handleAction(deal.category)}>
                  <div className="hot-badge">
                    {deal.score >= 90 ? '🔥 HOT' : 'SUPER DEAL'}
                  </div>
                  <h4 className="hot-title">{deal.title}</h4>
                  
                  {/* v28: 게이지 바 위에 점수 수치 배치 */}
                  <div className="score-container">
                    <div className="score-label">
                      <span>Smart Score</span>
                      <span className="score-num">{deal.score || 50}</span>
                    </div>
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
            <button className="scroll-btn right" onClick={() => scrollHotDeals('right', hotDealsRef)}>›</button>
          </div>
        </section>
      )}

      <main className="product-grid">
        {products.map((product, idx) => (
          <div key={`${product.productId}-${idx}`} className="product-card-wrapper" onClick={() => handleAction(product.category)}>
            <a href={product.link} target="_blank" rel="noreferrer" className="product-card">
              <div className="image-container">
                <img src={product.image} alt={product.title} />
              </div>
              <div className="product-info">
                <h3 className="product-title">{product.title}</h3>
                <p className="product-price">{product.lprice.toLocaleString()}원</p>
              </div>
            </a>
            <div className="card-actions">
                <button className={`wish-btn ${wishlist.find(i=>i.productId===product.productId) ? 'active' : ''}`} onClick={(e) => toggleWishlist(e, product)}>
                   {wishlist.find(i=>i.productId===product.productId) ? '❤️' : '🤍'}
                </button>
                <button className="chart-btn" onClick={(e) => { e.preventDefault(); showPriceChart(product.productId, product.title); }}>
                   📈 시세차트
                </button>
            </div>
          </div>
        ))}
      </main>

      {/* 📊 시세 차트 모달 (v28) */}
      {showModal && selectedHistory && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            <h3>📈 {selectedHistory.title} 시세 추이</h3>
            <p className="chart-help">최근 수집된 네이버 최저가 데이터를 기반으로 합니다.</p>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={selectedHistory.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="price" stroke="#ff6b00" strokeWidth={3} dot={{ fill: '#ff6b00' }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="loader"></div>}
      <div ref={observerTarget} style={{ height: '20px' }}></div>
    </div>
  );
}

export default App;
