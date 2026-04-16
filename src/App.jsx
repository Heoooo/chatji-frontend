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
  
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const observerTarget = useRef(null);

  // 1. 배포 후 Render 주소가 나오면 여기에 넣어주세요! (지금은 로컬)
  const API_BASE_URL = "http://localhost:8080"; 

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

  // 🔥 2. 구글 실시간 추천 검색어 API 호출 (더미 데이터 삭제!)
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
      if (Array.isArray(data)) {
        // 구글 형식 [ "단어", ["추천1", "추천2"] ]
        list = data[1] || [];
      } else if (data.items && data.items[0]) {
        // 네이버 형식 { items: [ [ ["단어", "1"] ] ] }
        list = data.items[0].map(item => Array.isArray(item) ? item[0] : item);
      }
      
      setSuggestions(list.filter(s => typeof s === 'string').slice(0, 8));
      setShowSuggestions(list.length > 0);
    } catch (err) {
      console.error("추천 검색어 로딩 실패", err);
    }



  };


  const handleSearch = (e) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    setSuggestions([]); 
    setShowSuggestions(false); 

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

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
        <div className="search-bar" style={{ position: "relative" , zIndex: 1000}}>
          <input 
            type="text" 
            placeholder="어떤 상품을 찾으시나요?" 
            value={keyword} 
            onChange={handleInputChange} 
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="search-input" 
          />
          <button type="submit" className="search-button" disabled={loading}>검색</button>

          {showSuggestions && (
            <div className="suggestion-dropdown">
              {suggestions.map((s, idx) => (
                <div key={idx} onClick={() => clickKeyword(s)} className="suggestion-item">
                  {s.toLowerCase().includes(keyword.toLowerCase()) ? (
                    <>
                      {s.split(new RegExp(`(${keyword})`, 'gi')).map((part, i) => 
                        part.toLowerCase() === keyword.toLowerCase() ? <strong key={i} style={{color: "#38bdf8"}}>{part}</strong> : part
                      )}
                    </>
                  ) : s}
                </div>
              ))}
            </div>
          )}
        </div>
      </form>

      {/* 인기 검색어 생략 가능 - 필요하시면 유지 */}

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

      <div ref={observerTarget} style={{ height: '20px' }}></div>
      {loading && <div className="loader" style={{margin: "2rem auto"}}></div>}
    </div>
  );
}

export default App;
