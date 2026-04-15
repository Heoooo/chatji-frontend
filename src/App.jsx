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
  
  // 🔥 자동완성용 상태 변수들
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const observerTarget = useRef(null);

  // 인기 검색어 박스용 데이터
  const popularKeywords = ['아이폰 15', '맥북 프로', '나이키 에어포스'];

  // 🔥 자동완성(추천검색어) 사전 가짜 데이터 (여기에 무한정 단어 추가 가능!)
  const allSuggestions = [
    "아이폰 15", "아이폰 15 프로", "아이폰 14", "아이폰 13 미니", "아이폰 12", "아이폰 케이스",
    "맥북 프로 14인치", "맥북 에어 M3", "맥북 에어 M2", "맥북 거치대",
    "나이키 에어포스 1", "나이키 V2K 런", "나이키 에어맥스", "나이키 덩크로우",
    "다이슨 에어랩", "다이슨 청소기", "다이슨 슈퍼소닉",
    "에어팟 맥스", "에어팟 프로 2세대", "에어팟 3세대",
    "갤럭시 S24 울트라", "갤럭시 S23", "갤럭시 워치 6", "갤럭시 버즈 2 프로"
  ];

  const fetchProducts = async (currentKeyword, currentSort, startIdx) => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:8080/api/products?keyword=${encodeURIComponent(currentKeyword)}&sort=${currentSort}&start=${startIdx}`);
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
    setShowSuggestions(false);
    setProducts([]);
    setPage(1);
    setHasMore(true);
    fetchProducts(keyword, sort, 1);
  };

  const clickKeyword = (kw) => {
    setKeyword(kw);
    setShowSuggestions(false);
    setProducts([]);
    setPage(1);
    setHasMore(true);
    fetchProducts(kw, sort, 1); 
  };

  const handleSortChange = (e) => {
    const newSort = e.target.value;
    setSort(newSort);
    setProducts([]);
    setPage(1);
    setHasMore(true);
    fetchProducts(keyword, newSort, 1);
  };

  // 🔥 타이핑할 때마다 검색어 사전을 뒤져서 자동완성 띄워주기
  const handleInputChange = (e) => {
    const val = e.target.value;
    setKeyword(val);
    if (!val.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    // 치고 있는 단어가 포함된 추천검색어 5개 추출
    const filtered = allSuggestions.filter(s => s.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !loading && hasMore && products.length > 0) {
          const nextStart = page + 20;
          setPage(nextStart);
          fetchProducts(keyword, sort, nextStart);
        }
      },
      { threshold: 1.0 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [loading, hasMore, products, page, keyword, sort]);

  return (
    <div className="container">
      <header className="header">
        <h1 className="logo"><span className="gradient-text">Chat</span>ji</h1>
      </header>

      <form className="search-form" onSubmit={handleSearch}>
        {/* 검색창 박스를 position: relative로 두어 드롭다운의 기준점을 만듦 */}
        <div className="search-bar" style={{ position: "relative" }}>
          <input 
            type="text" 
            placeholder="예: 맥북 M3" 
            value={keyword} 
            onChange={handleInputChange} 
            onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} // 클릭 씹힘 방지 딜레이
            className="search-input" 
          />
          <button type="submit" className="search-button" disabled={loading}>검색</button>

          {/* 🔥 자동완성 드롭다운 UI */}
          {showSuggestions && (
            <div style={{
              position: "absolute", top: "115%", left: "1rem", right: "120px",
              background: "rgba(15, 23, 42, 0.95)", backdropFilter: "blur(12px)",
              border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "12px",
              padding: "0.5rem 0", zIndex: 10, textAlign: "left",
              boxShadow: "0 15px 35px rgba(0,0,0,0.6)", overflow: "hidden"
            }}>
              {suggestions.map((s, idx) => (
                <div 
                  key={idx} 
                  onClick={() => clickKeyword(s)}
                  style={{ 
                    padding: "0.8rem 1.5rem", cursor: "pointer", 
                    color: "#f8fafc", transition: "background 0.2s" 
                  }}
                  onMouseOver={(e) => e.target.style.background = "rgba(56, 189, 248, 0.15)"}
                  onMouseOut={(e) => e.target.style.background = "transparent"}
                >
                  🔍 {s.split(new RegExp(`(${keyword})`, 'gi')).map((part, i) => 
                    part.toLowerCase() === keyword.toLowerCase() ? <strong key={i} style={{color: "#38bdf8"}}>{part}</strong> : part
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </form>

      {products.length === 0 && !loading && !error && (
        <div style={{ textAlign: "center", marginBottom: "3rem", marginTop: "-2rem", animation: "fadeIn 0.5s ease-out" }}>
          <p style={{ color: "#94a3b8", fontSize: "0.95rem", marginBottom: "1rem" }}>🔥 지금 쇼핑 핫 트렌드</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem", justifyContent: "center" }}>
            {popularKeywords.map((kw, idx) => (
               <button key={idx} onClick={() => clickKeyword(kw)} type="button" style={{ background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.2)", color: "#38bdf8", padding: "0.5rem 1.2rem", borderRadius: "999px", cursor: "pointer", fontWeight: "600", transition: "transform 0.2s" }} onMouseOver={(e) => e.target.style.transform = "scale(1.05)"} onMouseOut={(e) => e.target.style.transform = "scale(1)"}>{kw}</button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {products.length > 0 && (
        <div className="filter-container">
          <select value={sort} onChange={handleSortChange} className="sort-select">
            <option value="sim">정확도순</option>
            <option value="price_asc">가격 낮은순</option>
            <option value="price_dsc">가격 높은순</option>
          </select>
        </div>
      )}

      <main className="product-grid">
        {products.map((product, idx) => (
          <a href={product.link} target="_blank" rel="noreferrer" className="product-card" key={`${product.productId}-${idx}`}>
            <div className="image-container">
              <img src={product.image} alt={product.title} loading="lazy" />
              <div className="mall-badge">{product.mallName}</div>
            </div>
            <div className="product-info">
              <h3 className="product-title">{product.title}</h3>
              <p className="product-price">{product.lprice.toLocaleString()}<span>원</span></p>
            </div>
          </a>
        ))}
      </main>

      {loading && products.length > 0 && <div className="loader" style={{margin: "2rem auto"}}></div>}
      <div ref={observerTarget} style={{ height: '20px' }}></div>
    </div>
  );
}

export default App;
