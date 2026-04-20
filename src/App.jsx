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
  const [activeTab, setActiveTab] = useState('all'); // all, wishlist, alerts
  const [wishlist, setWishlist] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);

  // v30: 알림 관련 상태
  const [userId, setUserId] = useState('');
  const [myAlerts, setMyAlerts] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    localStorage.getItem('chatji_notif_enabled') !== 'false'
  );

  const [recommendations, setRecommendations] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');

  const [hotDeals, setHotDeals] = useState([]);
  const hotDealsRef = useRef(null);
  const recoRef = useRef(null);
  const observerTarget = useRef(null);

  // const API_BASE_URL = "https://chatji-backend.onrender.com";
  const API_BASE_URL = "https://chatji-backend.onrender.com";

  // v30.2: 실시간 알림 시스템 안정화 (재접속 & 하트비트)
  useEffect(() => {
    let storedId = localStorage.getItem('chatji_user_id');
    if (!storedId) {
      storedId = 'user-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('chatji_user_id', storedId);
    }
    setUserId(storedId);
    
    if (Notification.permission === 'default' && notificationsEnabled) {
      Notification.requestPermission();
    }

    let eventSource;
    const connectSSE = () => {
      if (eventSource) eventSource.close();
      
      eventSource = new EventSource(`${API_BASE_URL}/api/notifications/stream?userId=${storedId}`);

      eventSource.addEventListener('hotdeal', (event) => {
        if (!notificationsEnabled) return;
        const deal = JSON.parse(event.data);
        showBrowserLog('🔥 핫딜 포착!', `[${deal.source}] ${deal.title}`, deal.url);
        fetchHotDeals();
      });

      eventSource.addEventListener('keyword_match', (event) => {
        if (!notificationsEnabled) return;
        const deal = JSON.parse(event.data);
        showBrowserLog('🎯 키워드 핫딜 입고!', `설정한 키워드: ${deal.title}`, deal.url);
      });

      eventSource.addEventListener('price_match', (event) => {
        if (!notificationsEnabled) return;
        showBrowserLog('💰 목표가 도달!', event.data);
      });

      eventSource.addEventListener('heartbeat', () => {
        // 서버와의 연결 유지 확인 (로그 생략)
      });

      eventSource.onerror = () => {
        console.log("SSE Connection lost. Reconnecting...");
        setTimeout(connectSSE, 5000); // 5초 후 재접속 시도
      };
    };

    connectSSE();

    fetchMyAlerts(storedId);
    fetchHotDeals();
    fetchRecommendations(storedId);
    
    return () => { if (eventSource) eventSource.close(); };
  }, [notificationsEnabled]);

  const showBrowserLog = (title, body, url) => {
    if (Notification.permission === 'granted') {
      const n = new Notification(title, { body });
      n.onclick = () => { window.focus(); if(url) window.open(url, '_blank'); };
    }
  };

  const fetchMyAlerts = async (uid) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts/${uid}`);
      setMyAlerts(await res.json());
    } catch (e) { console.error("Alerts Fetch Error", e); }
  };

  const addKeywordAlert = async () => {
    if (!newKeyword) return;
    try {
      await fetch(`${API_BASE_URL}/api/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type: 'KEYWORD', keyword: newKeyword })
      });
      setNewKeyword('');
      fetchMyAlerts(userId);
    } catch (e) { console.error("Add Alert Error", e); }
  };

  const addPriceAlert = async () => {
    if (!targetPrice || !selectedHistory) return;
    try {
      await fetch(`${API_BASE_URL}/api/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          type: 'TARGET_PRICE', 
          productId: selectedHistory.productId,
          targetPrice: parseInt(targetPrice)
        })
      });
      setTargetPrice('');
      alert("목표가 알림이 설정되었습니다! 🎯");
      fetchMyAlerts(userId);
    } catch (e) { console.error("Price Alert Error", e); }
  };

  const deleteAlert = async (id) => {
    await fetch(`${API_BASE_URL}/api/alerts/${id}`, { method: 'DELETE' });
    fetchMyAlerts(userId);
  };

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
        setSelectedHistory({ productId, title, data: chartData });
        setShowModal(true);
      } else {
        alert("아직 시세 데이터가 부족합니다! 📈");
      }
    } catch (e) { console.error("Chart Error", e); }
  };

  const fetchHotDeals = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/hotdeals`);
      setHotDeals(await res.json());
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

  const toggleNotifications = () => {
    const newState = !notificationsEnabled;
    setNotificationsEnabled(newState);
    localStorage.setItem('chatji_notif_enabled', newState);
  };

  const goHome = () => {
    setKeyword('');
    setProducts([]);
    setActiveTab('all');
    setPage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container">
      <header className="header">
        <div className="header-left">
          <h1 className="logo" onClick={goHome} style={{ cursor: 'pointer' }}>Chatji</h1>
          <button className={`notif-toggle-btn ${notificationsEnabled ? 'on' : 'off'}`} onClick={toggleNotifications}>
            {notificationsEnabled ? (
              <><span className="notif-icon">🔔</span><span className="notif-text">알림 ON</span></>
            ) : (
              <><span className="notif-icon">🔕</span><span className="notif-text">알림 OFF</span></>
            )}
          </button>
        </div>
      </header>

      <div className="tabs">
        <button className={activeTab === 'all' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('all')}>쇼핑 검색</button>
        <button className={activeTab === 'wishlist' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('wishlist')}>찜 목록 ({wishlist.length})</button>
        <button className={activeTab === 'alerts' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('alerts')}>🎯 알림 설정 ({myAlerts.length})</button>
      </div>

      {activeTab === 'all' && (
        <form className="search-form" onSubmit={handleSearch}>
          <div className="search-bar">
            <input type="text" placeholder="어떤 상품을 찾으시나요?" value={keyword} onChange={(e) => setKeyword(e.target.value)} className="search-input" />
            <button type="submit" className="search-button" disabled={loading}>검색</button>
          </div>
          <div className="price-filter">
            <input type="number" placeholder="최소" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="price-input" />
            <input type="number" placeholder="최대" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="price-input" />
            <select value={sort} onChange={(e) => { setSort(e.target.value); setProducts([]); setPage(1); fetchProducts(keyword, e.target.value, 1, minPrice, maxPrice); }} className="sort-select">
              <option value="sim">정확도순</option>
              <option value="price_asc">가격 낮은순</option>
              <option value="price_dsc">가격 높은순</option>
            </select>
          </div>
        </form>
      )}

      {/* 🔴 v30: 알림 설정 탭 */}
      {activeTab === 'alerts' && (
        <section className="alerts-page">
          <div className="alert-input-card">
            <h3>🎯 키워드 핫딜 알림 등록</h3>
            <p>등록한 키워드가 포함된 핫딜이 뜨면 데스크탑 알림을 보내드려요!</p>
            <div className="alert-form">
              <input type="text" placeholder="예: 맥북, 그래픽카드, 생수" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} />
              <button onClick={addKeywordAlert}>등록하기</button>
            </div>
          </div>
          <div className="alert-list">
            {myAlerts.map(alert => (
              <div key={alert.id} className="alert-item">
                <span>{alert.type === 'KEYWORD' ? '🔖 키워드: ' + alert.keyword : '💰 목표가 알림'}</span>
                <button onClick={() => deleteAlert(alert.id)}>삭제</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 쇼핑 리스트 및 추천 섹션 (기존 유지) */}
      {activeTab === 'all' && recommendations.length > 0 && products.length === 0 && (
        <section className="hot-deals-section recommended">
          <div className="section-header">
             <h2 className="section-title">🎁 맞춤 추천</h2>
          </div>
          <div className="hot-deals-container" style={{ position: 'relative' }}>
            <button className="scroll-btn left" onClick={() => scrollHotDeals('left', recoRef)}>‹</button>
            <div className="hot-deals-scroll" ref={recoRef}>
              {recommendations.map((deal) => (
                <a key={deal.id} href={deal.url} target="_blank" rel="noreferrer" className="hot-deal-card reco" onClick={() => handleAction(deal.category)}>
                  <div className="hot-badge reco-badge">SCORE {deal.score}</div>
                  <h4 className="hot-title">{deal.title}</h4>
                  <div className="hot-footer">
                    <span className="hot-source">{deal.source}</span>
                    <span className="hot-price">{deal.currentPrice?.toLocaleString()}원</span>
                  </div>
                </a>
              ))}
            </div>
            <button className="scroll-btn right" onClick={() => scrollHotDeals('right', recoRef)}>›</button>
          </div>
        </section>
      )}

      {activeTab === 'all' && hotDeals.length > 0 && products.length === 0 && (
        <section className="hot-deals-section">
          <div className="section-header"><h2 className="section-title">🔥 고검증 핫딜</h2></div>
          <div className="hot-deals-container" style={{ position: 'relative' }}>
            <button className="scroll-btn left" onClick={() => scrollHotDeals('left', hotDealsRef)}>‹</button>
            <div className="hot-deals-scroll" ref={hotDealsRef}>
              {hotDeals.map((deal) => (
                <a key={deal.id} href={deal.url} target="_blank" rel="noreferrer" className={`hot-deal-card ${deal.score >= 90 ? 'top-tier' : ''}`} onClick={() => handleAction(deal.category)}>
                  <div className="hot-badge">{deal.score >= 90 ? '🔥 HOT' : 'SUPER'} SCORE {deal.score}</div>
                  <h4 className="hot-title">{deal.title}</h4>
                  <div className="hot-footer">
                    <span className="hot-source">{deal.source}</span>
                    <span className="hot-price">{deal.currentPrice?.toLocaleString()}원</span>
                  </div>
                </a>
              ))}
            </div>
            <button className="scroll-btn right" onClick={() => scrollHotDeals('right', hotDealsRef)}>›</button>
          </div>
        </section>
      )}

      {activeTab === 'all' && (
        <main className="product-grid">
            {products.map((product, idx) => (
            <div key={`${product.productId}-${idx}`} className="product-card-wrapper" onClick={() => handleAction(product.category)}>
                <a href={product.link} target="_blank" rel="noreferrer" className="product-card">
                <div className="image-container"><img src={product.image} alt={product.title} /></div>
                <div className="product-info">
                    <h3 className="product-title">{product.title}</h3>
                    <p className="product-price">{product.lprice.toLocaleString()}원</p>
                </div>
                </a>
                <div className="card-actions">
                    <button className="wish-btn" onClick={(e) => toggleWishlist(e, product)}>
                    {wishlist.find(i=>i.productId===product.productId) ? '❤️' : '🤍'}
                    </button>
                    <button className="chart-btn" onClick={(e) => { e.preventDefault(); showPriceChart(product.productId, product.title); }}>📊 시세</button>
                </div>
            </div>
            ))}
        </main>
      )}

      {/* 📊 시세 차트 모달 + 목표가 설정 */}
      {showModal && selectedHistory && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            <h3>📈 {selectedHistory.title}</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={selectedHistory.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: 'none' }} />
                  <Line type="monotone" dataKey="price" stroke="#ff6b00" strokeWidth={3} dot={{ fill: '#ff6b00' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* v30: 목표가 설정 폼 */}
            <div className="target-price-form">
               <input type="number" placeholder="희망 목표가 입력 (원)" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} />
               <button onClick={addPriceAlert}>🎯 목표가 알림 신청</button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="loader"></div>}
    </div>
  );
}

export default App;
