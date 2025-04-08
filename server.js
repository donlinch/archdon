/* public/style.css */

/*
    Color Palette:
    Warm Orange (Header): #FFB74D
    Coral Red   (Accent 1): #E57373
    Blue Grey   (Accent 2): #B0BEC5
    Light Grey BG:          #FAFAFA
    Dark Text:              #424242
    Medium Text:            #757575
*/

/* Basic Reset & Body Style */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Noto Sans TC', sans-serif; line-height: 1.5; color: #424242; background-color: #FAFAFA; padding-bottom: 80px;  /*80px  */ }

/* Header Styles */
header { background-color: #FFB74D; color: #424242; padding: 0.1rem 0.1rem; /* 0.5rem 1rem; */text-align: center; margin-bottom: 1px; /*  2rem   */ box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); line-height: 1; }
#header-logo { height: 200px; width: auto; vertical-align: middle; display: inline-block; } /* (注意：這個 ID 在你的 HTML 中似乎沒有使用) */

header h1 { margin: 0; line-height: inherit; }

/* Main Content Area */
main { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }

/* Category Navigation Styles */
.category-nav { display: flex; justify-content: center; flex-wrap: wrap; gap: 0.8rem 1.2rem; margin-bottom: 2rem; padding-bottom: 0.8rem; border-bottom: 2px solid #ECEFF1; }
.category-nav a { color: #757575; text-decoration: none; font-size: 1rem; font-weight: 500; padding: 0.4rem 0; border-bottom: 3px solid transparent; transition: color 0.2s ease, border-color 0.2s ease; }
.category-nav a.active { color: #E57373; font-weight: 700; border-bottom-color: #FFB74D; }
.category-nav a:not(.active):hover { color: #424242; border-bottom-color: #B0BEC5; }


/* 添加在全局按鈕樣式之後 */
button.artist-filter-btn {
    all: unset; /* 重置所有繼承的樣式 */
}

nav#artist-filter.artist-filter-nav button.artist-filter-btn {
    /* 然後重新應用我們的樣式 */
    padding: 0.4rem 0.8rem;
    border: 1px solid #B0BEC5;
    border-radius: 15px;
    /* 其他樣式保持不變 */
}

/* --- Product Grid Layout (For index.html) --- */
.product-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem; }
@media (min-width: 600px) { .product-grid { grid-template-columns: repeat(3, 1fr); gap: 1rem; } }
@media (min-width: 900px) { .product-grid { grid-template-columns: repeat(4, 1fr); gap: 1.2rem; } }
@media (min-width: 1200px) { .product-grid { grid-template-columns: repeat(5, 1fr); gap: 1rem; } }

/* Individual Product Card Styles (For index.html) */
.product-card, .product-card:link, .product-card:visited { background-color: #fff; border: 1px solid #ECEFF1; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; display: flex; flex-direction: column; height: 100%; /*100% */ text-align: center; text-decoration: none; color: inherit; position: relative; }
.product-card:hover { transform: translateY(-3px); box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08); z-index: 10; border-color: #B0BEC5; }
.product-card .image-container { width: 100%; height: 100px; /*160px*/ overflow: hidden; margin-bottom: 0.4rem; padding: 0.4rem 0.4rem 0 0.4rem; }
.product-card img { display: block; width: 100%; height: 100%; object-fit: contain; margin: 0 auto; }
.product-card .card-content { padding: 0 0.8rem 0.8rem 0.8rem; flex-grow: 1; display: flex; flex-direction: column; }
.product-card h3 { font-size: 0.9rem; margin-bottom: 0.2rem; color: #424242; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.product-card p { font-size: 0.75rem; color: #757575; line-height: 1.4; margin-bottom: 0.5rem; flex-grow: 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; min-height: calc(0.75rem * 1.4 * 2); }
.product-card .price { font-weight: bold; font-size: 1rem; color: #E57373; margin-top: auto; padding-top: 0.4rem; }

/* --- Music Page Styles (music.html & scores.html) --- */
/* 歌手篩選樣式 */
/* *** 提高容器選擇器特異性 (可選，但更明確) *** */
nav#artist-filter.artist-filter-nav {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.6rem 1rem;
    margin: 2rem 0;
    padding-bottom: 1rem;
    border-bottom: 1px solid #eee; /* *** 確保這個邊框存在 *** */
}

/* *** 修改這裡：移除 !important 和 border-bottom: none *** */
nav#artist-filter.artist-filter-nav button.artist-filter-btn {
    padding: 0.4rem 0.8rem;
    border: 1px solid #B0BEC5;
    border-radius: 15px;
    background-color: transparent;
    color: #757575;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s ease;
    text-decoration: none;
    /* border-bottom: none !important; */ /* *** 移除這一行 *** */
    line-height: 1.5;
    display: inline-block;
    margin: 0;
    font-family: inherit;
    box-shadow: none;
    appearance: none;
    -webkit-appearance: none;
}
/* *** 提高 hover 樣式的特異性 *** */
nav#artist-filter.artist-filter-nav button.artist-filter-btn:hover {
    background-color: #ECEFF1;
    border-color: #78909C;
    color: #424242;
}
nav#artist-filter.artist-filter-nav button.artist-filter-btn.active {
    background-color: #E57373;
    color: white;
    border-color: #E57373;
    font-weight: bold;
}

.music-container {
    display: flex;
    justify-content: center;
    width: 100%;
    box-sizing: border-box;
}
/* 專輯網格佈局 (music.html) */

.album-grid {
    display: grid;
    /* 預設 (手機) 2 欄 */
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
    width: 100%;
    padding: 0 1rem;
    box-sizing: border-box;
  }
  
  /* 使用與 product-grid 相同的響應式斷點 */
  @media (min-width: 600px) {
    .album-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5rem;
    }
  }
  @media (min-width: 900px) {
    .album-grid {
      grid-template-columns: repeat(4, 1fr);
      gap: 1.5rem;
    }
  }
  @media (min-width: 1200px) {
    .album-grid {
      grid-template-columns: repeat(5, 1fr);
      gap: 1.8rem;
    }
  }



/* 專輯卡片樣式 (music.html) */
.album-card { display: block; text-decoration: none; color: inherit; background-color: transparent; border-radius: 6px; overflow: visible; box-shadow: none; transition: transform 0.25s ease, box-shadow 0.25s ease; position: relative; }
.album-card:hover { transform: translateY(-5px); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12); }
.album-card .cover-image { width: 100%; aspect-ratio: 1 / 1; overflow: hidden; border-radius: 6px; margin-bottom: 0.8rem; background-color: #eee; position: relative; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08); }
.album-card .cover-image img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease; }
.album-card:hover .cover-image img { transform: scale(1.05); }
.album-card .cover-image::after { content: '▶'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(1.5); font-size: 2rem; color: rgba(255, 255, 255, 0.8); background-color: rgba(0, 0, 0, 0.4); border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease; pointer-events: none; line-height: 1; }
.album-card:hover .cover-image::after { opacity: 1; }
.album-card .album-info { padding: 0 0.2rem; text-align: left; }
.album-card .album-info h3 { font-size: 0.9rem; font-weight: 600; color: #333; margin-bottom: 0.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.album-card .album-info .artist { font-size: 0.8rem; color: #666; margin-bottom: 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.album-card .album-info .release-date { font-size: 0.75rem; color: #999; }

/* --- News List Styles (news.html) --- */
.news-list { margin-top: 1.5rem; }
.news-card { display: flex; align-items: stretch; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.08); margin-bottom: 1.5rem; overflow: hidden; transition: box-shadow 0.2s ease; }
.news-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
.news-card .date-tag { flex-shrink: 0; background-color: #E57373; color: white; padding: 1.5rem 1rem; text-align: center; display: flex; flex-direction: column; justify-content: center; min-width: 70px; }
.news-card .date-tag .month { font-size: 0.8rem; display: block; margin-bottom: 0.2rem; text-transform: uppercase; }
.news-card .date-tag .day { font-size: 1.8rem; font-weight: bold; line-height: 1; display: block; }
.news-card .date-tag .weekday { font-size: 0.7rem; display: block; margin-top: 0.2rem; }
.news-card .thumbnail { flex-shrink: 0; width: 120px; height: 100px; overflow: hidden; }
@media (max-width: 600px) { .news-card .thumbnail { width: 90px; height: 75px; } }
.news-card .thumbnail img { display: block; width: 100%; height: 100%; object-fit: cover; }
.news-card .content-wrapper { flex-grow: 1; padding: 0.8rem 1rem; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; cursor: pointer; }
.news-card .news-title { font-size: 1.1rem; font-weight: bold; color: #333; margin-bottom: 0.4rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; line-height: 1.4; max-height: calc(1.1rem * 1.4 * 2); }
.news-card .news-summary { font-size: 0.85rem; color: #666; line-height: 1.5; margin-bottom: 0.5rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; min-height: calc(0.85rem * 1.5 * 2); }
.news-card .actions { flex-shrink: 0; width: 60px; padding: 0.5rem 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.1rem; border-left: 1px solid #eee; }
.news-card .like-button { background: none; border: none; cursor: pointer; padding: 2px 5px; display: inline-flex; align-items: center; color: #aaa; font-size: 0.9rem; line-height: 1; margin: 0; }
.news-card .like-button.liked { color: #E57373; font-weight: bold; }
.news-card .like-button .heart-icon { font-size: 1.3em; transition: transform 0.2s ease; line-height: 1; }
.news-card .like-button:hover .heart-icon { transform: scale(1.2); }
.news-card .like-count { font-size: 0.8rem; color: #aaa; text-align: center; line-height: 1; }

/* --- News Pagination --- */
#pagination-controls { text-align: center; margin-top: 2rem; }
#pagination-controls button { padding: 8px 12px; margin: 0 3px; border: 1px solid #ccc; background-color: #fff; color: #555; cursor: pointer; border-radius: 4px; transition: background-color 0.2s ease, color 0.2s ease; }
#pagination-controls button:hover { background-color: #eee; }
#pagination-controls button.active { background-color: #FFB74D; color: white; border-color: #FFB74D; font-weight: bold; cursor: default; }
#pagination-controls button:disabled { opacity: 0.6; cursor: not-allowed; }
#pagination-controls span { padding: 8px 5px; }

/* --- News Detail Modal (news.html) --- */
#news-detail-modal .modal-content { max-width: 700px; padding: 0; overflow: hidden; }
#news-detail-modal .detail-image { width: 100%; max-height: 400px; object-fit: cover; display: block; }
#news-detail-modal .detail-content { padding: 1.5rem 2rem 2rem 2rem; }
#news-detail-modal .detail-title { font-size: 1.6rem; font-weight: bold; margin-bottom: 0.5rem; color: #333; }
#news-detail-modal .detail-meta { font-size: 0.9rem; color: #888; margin-bottom: 1.5rem; }
#news-detail-modal .detail-body { font-size: 1rem; line-height: 1.7; color: #555; white-space: pre-wrap; /* Use pre-wrap to preserve line breaks */ }
#news-detail-modal .close-btn { top: 15px; right: 15px; background-color: rgba(0,0,0,0.3); color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; justify-content: center; align-items: center; font-size: 20px; line-height: 1; padding: 0; text-align: center; }
#news-detail-modal .close-btn:hover { background-color: rgba(0,0,0,0.6); }

/* --- News Detail Page Styles (news-detail.html) --- */
.news-detail-container { max-width: 800px; margin: 2rem auto; background-color: #fff; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); overflow: hidden; }
.news-detail-container #news-detail-image { display: block; width: 100%; object-fit: cover; max-height: 450px; }
.news-detail-text-content { padding: 1.5rem 2rem 2rem 2rem; }
.news-detail-container #news-detail-title { font-size: 1.8rem; font-weight: 700; margin-bottom: 0.8rem; line-height: 1.3; color: #333; }
.news-detail-container #news-detail-meta { border-bottom: 1px solid #eee; padding-bottom: 1rem; }
.news-detail-container #news-detail-body { font-size: 1rem; color: #555; line-height: 1.8; white-space: pre-wrap; }
.news-detail-container #news-detail-body p { margin-bottom: 1.5rem; }
.news-detail-container #news-detail-body img { max-width: 100%; height: auto; margin: 1.5rem auto; display: block; border-radius: 6px; }
.news-detail-container #news-detail-body h2,
.news-detail-container #news-detail-body h3,
.news-detail-container #news-detail-body h4 { margin: 2rem 0 1rem; color: #333; font-weight: 700; }
.news-detail-container #news-detail-body h2 { font-size: 1.5rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
.news-detail-container #news-detail-body h3 { font-size: 1.3rem; }
.news-detail-container #news-detail-body h4 { font-size: 1.1rem; }
.news-detail-container #news-detail-body ul,
.news-detail-container #news-detail-body ol { margin: 1.5rem 0; padding-left: 2rem; }
.news-detail-container #news-detail-body li { margin-bottom: 0.5rem; }
.news-detail-container #news-detail-body blockquote { border-left: 4px solid #FFB74D; padding-left: 1.5rem; margin: 1.5rem 0; color: #666; font-style: italic; }

/* News Detail Share Section */
.news-share { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #eee; }
.copy-link-button { background-color: #6c757d; color: white; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 0.9em; margin-left: 10px; font-weight: bold; }
.copy-link-button:hover { background-color: #5a6268; }

/* News Detail Responsive */
@media (max-width: 900px) {
    .news-detail-container { max-width: 95%; margin: 1.5rem auto; }
    .news-detail-text-content { padding: 1.2rem 1.5rem 1.5rem 1.5rem; }
    .news-detail-container #news-detail-title { font-size: 1.5rem; }
}
@media (max-width: 600px) {
    .news-detail-container { margin: 1rem auto; border-radius: 4px; }
    .news-detail-text-content { padding: 1rem; }
    .news-detail-container #news-detail-title { font-size: 1.3rem; }
    .news-detail-container #news-detail-meta { font-size: 0.85em; }
    .news-detail-container #news-detail-body { font-size: 0.95rem; line-height: 1.7; }
}

/* --- Footer Styles --- */
footer { background-color: #424242; color: #FAFAFA; padding: 2.5rem 1rem 1.5rem 1rem; margin-top: 4rem; text-align: center; }
.footer-container { max-width: 1100px; margin: 0 auto; }
.footer-nav { display: flex; justify-content: center; flex-wrap: wrap; gap: 1rem 2rem; margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid #616161; }
.footer-nav a { color: #eeeeee; text-decoration: none; font-size: 0.95rem; transition: color 0.2s ease; }
.footer-nav a:hover, .footer-nav a.admin-link:hover { color: #FFB74D; }
.footer-social { margin-bottom: 1.5rem; }
.footer-copyright p { font-size: 0.85rem; color: #bdbdbd; line-height: 1.5; }

/* --- Modal Styles (General - for Admin pages) --- */
.modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.5); justify-content: center; align-items: center; padding-top: 50px; }
.modal[style*="display: flex"] { display: flex !important; }
.modal-content { background-color: #fff; padding: 25px; border-radius: 8px; max-width: 600px; width: 90%; margin: auto; position: relative; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
.close-btn { position: absolute; top: 10px; right: 15px; cursor: pointer; font-size: 28px; font-weight: bold; color: #aaa; line-height: 1; }
.close-btn:hover { color: #333; }
.modal h2 { margin-top: 0; margin-bottom: 1.5rem; color: #333; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.5rem; font-weight: bold; color: #555; }
.form-group input[type="text"], .form-group input[type="number"], .form-group input[type="url"], .form-group input[type="date"], .form-group textarea, .form-group select { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-family: inherit; font-size: 1rem; }
.form-group textarea { resize: vertical; min-height: 80px; }
.form-actions { margin-top: 1.5rem; text-align: right; padding-top: 1rem; border-top: 1px solid #eee; }
.form-actions .action-btn { padding: 10px 15px; margin-left: 10px; border-radius: 5px; cursor: pointer; }
.form-actions .save-btn { background-color: #f2f2f2; border-color: #f2f2f2; /*#28a745; border-color: #28a745; */ color: white; }
.form-actions .cancel-btn { background-color: #6c757d; border-color: #6c757d; color: white; }
.form-group small { color: #888; display: block; margin-top: 4px; font-size: 0.8em; }
#edit-image-preview, #add-image-preview,
#edit-cover-preview, #add-cover-preview,
#edit-news-thumbnail-preview, #add-news-thumbnail-preview,
#edit-banner-preview, #add-banner-preview {
    max-width: 100px; max-height: 100px; display: none; margin-top: 5px; border: 1px solid #eee; object-fit: contain;
}
#edit-image-preview[src], #add-image-preview[src],
#edit-cover-preview[src], #add-cover-preview[src],
#edit-news-thumbnail-preview[src], #add-news-thumbnail-preview[src],
#edit-banner-preview[src], #add-banner-preview[src] {
    display: block;
}
p[id$="-form-error"] { color: red; margin-top: 10px; font-size: 0.9em; min-height: 1.2em; }

/* --- Admin Navigation Styles --- */
.admin-nav { background-color: #f8f9fa; padding: 1rem 0; text-align: center; border-bottom: 1px solid #dee2e6; margin-bottom: 1rem; }
.admin-nav a { color: #495057; text-decoration: none; padding: 0.6rem 1.2rem; margin: 0 0.5rem; border-radius: 5px; font-weight: 500; transition: background-color 0.2s ease, color 0.2s ease; }
.admin-nav a:hover { background-color: #e9ecef; color: #212529; }
.admin-nav a.active { background-color: #007bff; color: white; font-weight: bold; }

/* --- Admin Chart Styles --- */
.chart-container { position: relative; height:300px; width:80%; margin: 2rem auto; }
.chart-controls { text-align: center; margin-bottom: 1rem; }
.chart-controls button.chart-toggle-btn { padding: 6px 12px; margin: 0 5px; border: 1px solid #ccc; background-color: #fff; color: #555; cursor: pointer; border-radius: 4px; transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease; font-size: 0.9em; }
.chart-controls button.chart-toggle-btn:hover { background-color: #eee; border-color: #bbb; }
.chart-controls button.chart-toggle-btn.active { background-color: #007bff; color: white; border-color: #007bff; font-weight: bold; cursor: default; }

/* --- Banner Swiper Styles (All Pages) --- */
.banner-swiper { width: 100%; height: 370px; background-color: #FFB74D; margin-bottom: 0rem; /*2rem*/ }
.banner-swiper .swiper-slide { text-align: center; font-size: 18px; background: #ffb74d; display: flex; justify-content: center; align-items: center; }
.banner-swiper .swiper-slide img { display: block; width: 100%; height: 100%; object-fit: cover; }
.banner-swiper .swiper-button-prev,
.banner-swiper .swiper-button-next { color: rgba(255, 255, 255, 0.7); --swiper-navigation-size: 30px; }
.banner-swiper .swiper-button-prev:hover,
.banner-swiper .swiper-button-next:hover { color: rgba(255, 255, 255, 1); }
.banner-swiper .swiper-pagination-bullet { background: rgba(0, 0, 0, 0.3); opacity: 0.8; }
.banner-swiper .swiper-pagination-bullet-active { background: #fff; opacity: 1; }

/* --- Banner Admin Table Styles --- */
#banner-list-table tr.banner-group-header td { background-color: #FFB74D; font-weight: bold; font-size: 1.1em; color: #495057; padding: 12px 10px !important; border-top: 2px solid #adb5bd; border-bottom: 1px solid #adb5bd; }
#banner-list-table tr.banner-group-header:not(:first-child) td { border-top-width: 4px; }
#banner-list-table td img.preview-image { max-width: 150px; max-height: 50px; height: auto; display: inline-block; border: 1px solid #eee; vertical-align: middle;}

/* --- Scores Page Specific Styles (scores.html) --- */
.content-container { /* Container for song list and details */
    display: flex;
    flex-wrap: wrap;
    gap: 2rem;
    margin-top: 1.5rem;
    align-items: flex-start;
}

/* Song list container */
#song-list-container {
    flex: 1 1 300px;
    min-width: 250px;
    background: #fff;
    padding: 1rem;
    border-radius: 6px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    max-height: 75vh;
    display: flex;
    flex-direction: column;
}
#song-list-container h2 {
     margin-top: 0;
     margin-bottom: 1rem;
     font-size: 1.2rem;
     color: #555;
     border-bottom: 1px solid #eee;
     padding-bottom: 0.5rem;
}
#song-list {
    list-style: none;
    padding: 0;
    margin: 0;
    overflow-y: auto;
    flex-grow: 1;
}
/* --- 歌曲列表 --- */
#song-list li {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    padding: 0.8rem 1rem;
    gap: 5px 10px;
    cursor: default;
    border-bottom: 1px solid #eee;
    transition: background-color 0.2s ease;
}
#song-list li:last-child { border-bottom: none; }
#song-list li.active {
    background-color: #FFF9C4;
    color: #424242;
    font-weight: normal;
}
/* --- 歌曲資訊 --- */
.song-list-info {
    flex-grow: 1;
    min-width: 150px;
    margin-right: 1rem;
    overflow: hidden; /* Prevent long text from breaking layout */
    text-overflow: ellipsis;
    flex-direction: column; justify-content: center;
    white-space: nowrap;
}
/* --- 歌曲名稱 --- */
#song-list .song-title {

     font-weight: 500; /* 粗體 */
     /* 確保它佔用塊空間 */
     display: block; 
     /* 隱藏溢出 */
     overflow: hidden;
     /* 省略號 */
     text-overflow: ellipsis;
     /* 不換行 */       
     white-space: nowrap;
}
/* --- 歌手名稱 --- */
#song-list .song-artist {
    font-size: 0.85em;
    color: #757575;
    display: block; /* Ensure it takes block space */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
/* --- 樂譜按鈕 --- */
.song-list-scores {
    /* 換行 */
    white-space: nowrap; 
    /* 縮小 */
    flex-shrink: 0; /* 0 不縮小 
    /* 彈性容器 */
    display: flex; 

    flex-wrap: wrap;
    gap: 5px;
    justify-content: flex-end;
    /* flex-shrink: 0; */
    align-items: center;
}
/* Score buttons within the list */
/* --- 樂譜按鈕 --- */
.list-score-btn {
    padding: 3px 8px;
    font-size: 0.8em;
    border: 1px solid #ccc;
    background-color: #f0f0f0;
    color: #555;
    cursor: pointer;
    border-radius: 3px;
    transition: all 0.2s ease;
}
/* --- 樂譜按鈕 hover --- */
.list-score-btn:hover {
    background-color: #e0e0e0;
    border-color: #bbb;
}
/* --- 樂譜按鈕 active --- */
.list-score-btn.active {
    background-color: #E57373;
    color: white;
    border-color: #E57373;
    font-weight: bold;
}
#song-list-container #song-list-loading, /* Loading/Error inside list container */
#song-list-container #song-list-error {
     padding: 1rem;
     text-align: center;
     color: #888;
}
#song-list-container #song-list-error { color: red; }

/* --- 歌曲詳情 --- */
#song-detail-container {
    flex: 2 1 600px;
    display: flex;
    flex-direction: column;
    background: #fff;
    padding: 1.5rem;
    border-radius: 6px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    min-height: 600px; /* 保持最小高度 */
    display: none; /* 初始隱藏，由 JS 控制 */
    overflow: visible; /* *** 確保內容不會被意外截斷 *** */
}

#song-info {
     margin-top: 0;
     margin-bottom: 1.5rem;
     font-size: 1.5rem;
     font-weight: 700;
     color: #333;
     padding-bottom: 1rem;
     border-bottom: 1px solid #eee;
     flex-shrink: 0; /* Prevent shrinking */
}
#youtube-player {
    margin-bottom: 1.5rem;
    flex-shrink: 0;
}
#youtube-player iframe {
    width: 100%;
    aspect-ratio: 16 / 9;
    border: none;
    border-radius: 4px;
}
#score-selector { /* Container for score buttons inside details */
    margin-bottom: 1rem;
    flex-shrink: 0;
}
#score-selector h3 {
    margin-bottom: 0.8rem;
    font-size: 1.1rem;
    color: #555;
}
#score-selector button.score-type-btn { /* Score buttons inside details */
     padding: 6px 12px;
     margin-right: 8px;
     margin-bottom: 8px;
     cursor: pointer;
     border: 1px solid #B0BEC5;
     background-color: #fff;
     color: #555;
     border-radius: 4px;
     transition: all 0.2s ease;
     font-size: 0.9rem;
}
#score-selector button.score-type-btn:hover {
    background-color: #ECEFF1;
    border-color: #78909C;
}
#score-selector button.score-type-btn.active {
     background-color: #E57373;
     color: white;
     border-color: #E57373;
     font-weight: bold;
}

/* PDF viewer container (scores.html) */
#pdf-viewer-container {
    border: 1px solid #ddd;
    /* max-height: 80vh; */ /* 移除 max-height */
    overflow: auto;
    background-color: #e8e8e8;
    position: relative;
    border-radius: 4px;
    margin-bottom: 0.5rem;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-height: 400px;
    z-index: 1;
}
#pdf-viewer-container canvas {
     display: block;
     margin: 1rem auto;
     max-width: 95%;
     height: auto;
     box-shadow: 0 0 10px rgba(0,0,0,0.1);
     background-color: white;
     /* border: 1px dashed blue; */ /* 移除臨時邊框 */
     position: relative;
     z-index: 2;
}
#pdf-loading, #pdf-error {
     position: absolute;
     top: 50%; left: 50%;
     transform: translate(-50%, -50%);
     text-align: center;
     color: #666;
     font-size: 1.1rem;
     padding: 1rem;
     background-color: rgba(255, 255, 255, 0.95);
     border-radius: 4px;
     z-index: 10;
     display: none;
     /* border: 1px solid orange; */ /* 移除臨時邊框 */
     min-width: 150px;
}
#pdf-error { color: red; font-weight: bold;}

/* PDF Pagination (scores.html) */
#pdf-pagination {
    text-align: center;
    padding: 0.8rem 0;
    background-color: #f8f9fa;
    border-top: 1px solid #ddd;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    position: relative;
    z-index: 5;
}
#pdf-pagination button {
     padding: 5px 10px; margin: 0; cursor: pointer;
     border: 1px solid #ccc; background-color: #fff; border-radius: 3px;
}
#pdf-pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
#pdf-pagination span { margin: 0 5px; color: #555; font-size: 0.9em;}

/* --- score-viewer.html specific styles --- */
main.score-viewer-main { max-width: 100%; padding: 0; margin: 0; }
.viewer-header {
    background-color: #FFB74D;
    padding: 0.8rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.viewer-header a { color: #424242; text-decoration: none; font-weight: 500; }
.viewer-header h1 { font-size: 0.5rem; /*1.2rem */ color: #424242; margin: 0; text-align: center; flex-grow: 1; }
.viewer-header button {
    padding: 5px 10px;
    border: 1px solid #424242;
    background: white;
    color: #424242;
    border-radius: 4px;
    cursor: pointer;
}
.viewer-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 0.5rem; /* 上下保留 padding，左右減小 */
    gap: 1.5rem;
}
#youtube-player-viewer {
    width: 100%;
    max-width: 800px;
    flex-shrink: 0;
}
#youtube-player-viewer iframe {
    width: 100%;
    aspect-ratio: 16 / 9;
    border: none;
    border-radius: 4px;
}
#pdf-viewer-container-viewer {
    width: 100%;
    /* max-width: 95%; */ /* 移除 max-width */
    border: 1px solid #ccc;
    background-color: #e8e8e8;
    position: relative;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 60vh;
}
#pdf-viewer-container-viewer canvas {
    display: block;
    margin: 0 auto;
    max-width: 100%; /* 確保 Canvas 不超出容器 */
    height: auto;
    background-color: white;
}
#pdf-pagination-viewer {
    padding: 0.8rem 0;
    background-color: #f8f9fa;
    border-top: 1px solid #ddd;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
}
#pdf-loading-viewer, #pdf-error-viewer {
     position: absolute; top: 40%; left: 50%;
     transform: translate(-50%, -50%); z-index: 10;
     padding: 1rem; background-color: rgba(255,255,255,0.95);
     border-radius: 5px; text-align: center; color: #666;
     display: none;
     min-width: 150px;
     /* border: 1px solid orange; */ /* 移除臨時邊框 */
}
#pdf-error-viewer { color: red; font-weight: bold;}

/* Print styles for score-viewer.html */
@media print {
    body { background-color: white; }
    .viewer-header, #youtube-player-viewer, #pdf-pagination-viewer, footer { display: none !important; }
    main.score-viewer-main { padding: 0; margin: 0;}
    .viewer-content { padding: 0; }
    #pdf-viewer-container-viewer {
        border: none;
        box-shadow: none;
        width: 100%;
        max-width: 100%;
        min-height: auto;
        overflow: visible;
    }
    #pdf-viewer-container-viewer canvas {
         max-width: 100%;
         box-shadow: none;
         margin: 0;
    }
    #pdf-viewer-container-viewer canvas {
        page-break-inside: avoid;
        page-break-before: auto;
        page-break-after: auto;
    }
}


/* 一般表格樣式 */
#figure-table {
    width: 100%;
    border-collapse: collapse;
    font-family: Arial, sans-serif;
    margin-top: 20px;
}

/* 表格標題欄 */
#figure-table th {
    background-color: #4CAF50; /* 綠色背景 */
    color: rgb(142, 73, 73);
    padding: 12px 15px;
    text-align: left;
    font-size: 1.1em;
}

/* 表格內容 */
#figure-table td {
    padding: 10px 15px;
    text-align: left;
    border-bottom: 1px solid #ddd;
}

/* 交替行顏色 */
#figure-table tr:nth-child(even) {
    background-color: #5837ab; /* 淺灰色背景 */
}

/* 鼠標懸停行顏色 */
#figure-table tr:hover {
    background-color: #ddd; /* 深灰色背景 */
}

/* 調整按鈕樣式 */
button {
    padding: 8px 12px;
    font-size: 0.9em;
    border-radius: 5px;
    cursor: pointer;
    border: none;
}

/* 編輯和刪除按鈕 */
button.edit-btn {
    background-color: #99ed9c; /* 綠色 */
    color: white;
}

button.delete-btn {
    background-color: #f44336; /* 紅色 */
    color: white;
}

button.edit-btn:hover {
    background-color: #45a049; /* 綠色加深 */
}

button.delete-btn:hover {
    background-color: #e53935; /* 紅色加深 */
}

/* 售出按鈕樣式 */
.sell-btn {
    padding: 2px 6px;
    font-size: 0.8em;
    margin-left: 8px;
    cursor: pointer;
    background-color: #4CAF50; /* 綠色 */
    color: white;
    border: none;
    border-radius: 3px;
}

.sell-btn:hover {
    background-color: #45a049; /* 綠色加深 */
}

/* 表單欄位和標籤 */
.form-group {
    margin-bottom: 15px;
}

.form-group label {
    font-weight: bold;
}

/* Modal 視窗 */
.modal-content {
    padding: 20px;
    border-radius: 8px;
    background-color: #ebebeb;
    box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
}

/* Modal 按鈕 */
button.cancel-btn {
    background-color: #f44336; /* 紅色 */
    color: white;
}

button.cancel-btn:hover {
    background-color: #e53935; /* 紅色加深 */
}

button#save-figure-btn, button#submit-sale-btn {
    background-color: #4CAF50; /* 綠色 */
    color: white;
}

button#save-figure-btn:hover, button#submit-sale-btn:hover {
    background-color: #45a049; /* 綠色加深 */
}


/* 調整規格與數量區域 */
.variations-list {
    padding-left: 0;
    list-style: none;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
}

.variations-list li {
    font-size: 0.9em;
    margin-bottom: 5px;
    padding: 5px 10px;
    border: 1px solid #28a3bb;
    border-radius: 5px;
    background-color: #f9f9f9;
    display: flex;
    gap: 10px;
    align-items: center;
}

/* 規格名稱與數量分開顯示 */
.variations-list li span {
    font-weight: bold;
}

.variations-list li .variation-quantity {
    font-weight: normal;
    color: #757575;
}

.form-group-inline {
    display: flex;
    align-items: center;
    gap: 10px;
}
.form-group-inline input[type="checkbox"] {
    width: auto;
    margin: 0;
}

/* 調整規格與數量的視覺間距 */
#figure-table td {
    padding: 12px 15px;
    text-align: left;
    border-bottom: 1px solid #ddd;
}

/* 表格的交替行顏色 */
#figure-table tr:nth-child(even) {
    background-color: #f9f9f9;
}

/* 操作按鈕與規格間的間隔 */
#figure-table .actions button {
    margin-right: 8px;
}

/* Hover效果 */
#figure-table tr:hover {
    background-color: #e9e9e9;
}


body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f5f5f5;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    background-color: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

h1 {
    color: #333;
    text-align: center;
    margin-bottom: 30px;
}

.filter-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    margin-bottom: 20px;
    padding: 15px;
    background-color: #f0f8ff;
    border-radius: 5px;
}

.filter-group {
    display: flex;
    align-items: center;
    gap: 10px;
}

label {
    font-weight: bold;
}

select, input[type="date"] {
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
}

button {
    padding: 8px 15px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

button:hover {
    background-color: #45a049;
}

.summary-cards {
    display: flex;
    justify-content: space-around;
    margin-bottom: 20px;
    gap: 15px;
}

.card {
    flex: 1;
    padding: 15px;
    background-color: #fff;
    border-radius: 5px;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.1);
    text-align: center;
}

.card h3 {
    margin-top: 0;
    color: #555;
}

.card p {
    font-size: 24px;
    font-weight: bold;
    color: #333;
    margin-bottom: 0;
}

.chart-container {
    margin-bottom: 30px;
    height: 400px;
}

.table-container {
    overflow-x: auto;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
}

th, td {
    padding: 12px 15px;
    text-align: left;
    border-bottom: 1px solid #ddd;
}

th {
    background-color: #f2f2f2;
    font-weight: bold;
}

tr:hover {
    background-color: #f5f5f5;
}

/* 美化圖表容器 */
.chart-container {
    width: 80%;
    margin: 0 auto;
    margin-bottom: 30px;
}

/* 使表格更具可讀性 */
#figure-table {
    width: 100%;
    border-collapse: collapse;
    font-family: Arial, sans-serif;
    margin-top: 20px;
}

/* 表格標題欄 */
#figure-table th {
    background-color: #4CAF50;
    color: white;
    padding: 12px 15px;
    text-align: left;
    font-size: 1.1em;
}

/* 表格內容 */
#figure-table td {
    padding: 12px 15px;
    text-align: left;
    border-bottom: 1px solid #ddd;
}

/* 交替行顏色 */
#figure-table tr:nth-child(even) {
    background-color: #f9f9f9;
}

/* 鼠標懸停行顏色 */
#figure-table tr:hover {
    background-color: #f1f1f1;
}

/* 編輯和刪除按鈕 */
button {
    padding: 8px 12px;
    font-size: 1em;
    border-radius: 5px;
    cursor: pointer;
    border: none;
}

button.edit-btn {
    background-color: #4CAF50; 
    color: white;
}

button.delete-btn {
    background-color: #f44336; 
    color: white;
}

button.edit-btn:hover {
    background-color: #45a049; 
}

button.delete-btn:hover {
    background-color: #e53935; 
}


body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f5f5f5;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    background-color: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

h1 {
    color: #333;
    text-align: center;
    margin-bottom: 30px;
}

.filter-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    margin-bottom: 20px;
    padding: 15px;
    background-color: #f0f8ff;
    border-radius: 5px;
}

.filter-group {
    display: flex;
    align-items: center;
    gap: 10px;
}

label {
    font-weight: bold;
}

select, input[type="date"] {
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
}

button {
    padding: 8px 15px;
    background-color: #99e19b;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

button:hover {
    background-color: #45a049;
}

.summary-cards {
    display: flex;
    justify-content: space-around;
    margin-bottom: 20px;
    gap: 15px;
}

.card {
    flex: 1;
    padding: 15px;
    background-color: #fff;
    border-radius: 5px;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.1);
    text-align: center;
}

.card h3 {
    margin-top: 0;
    color: #555;
}

.card p {
    font-size: 24px;
    font-weight: bold;
    color: #333;
    margin-bottom: 0;
}

.chart-container {
    margin-bottom: 30px;
    height: 400px;
}

.table-container {
    overflow-x: auto;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
}

th, td {
    padding: 12px 15px;
    text-align: left;
    border-bottom: 1px solid #ddd;
}

th {
    background-color: #f2f2f2;
    font-weight: bold;
}

tr:hover {
    background-color: #f5f5f5;
}



/* 銷售報告頁面特定樣式 */
.report-container { max-width: 1200px; margin: 20px auto; padding: 15px; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.filter-controls { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.filter-controls label { margin-right: 5px; font-weight: bold;}
.filter-controls input[type="date"], .filter-controls button { padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; } /* 統一字體大小 */
.filter-controls button { background-color: #f0f0f0; cursor: pointer; transition: background-color 0.2s ease, border-color 0.2s ease; }
.filter-controls button:hover { background-color: #e0e0e0; }
.filter-controls button.active { background-color: #FFB74D; color: #424242; font-weight: bold; border-color: #FFB74D;}
.summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 25px; }
.card { background-color: #f9f9f9; padding: 15px; border-radius: 5px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.card h3 { margin-top: 0; margin-bottom: 8px; font-size: 0.9rem; color: #555; }
.card p { font-size: 1.8rem; font-weight: bold; color: #E57373; margin: 0; }
.chart-section, .table-section { margin-bottom: 30px; }
.chart-section h2, .table-section h2 { font-size: 1.3rem; margin-bottom: 15px; color: #444; border-bottom: 2px solid #FFB74D; padding-bottom: 5px;}
.chart-container { position: relative; height: 350px; /*350px */  width: 100%; } /* 圖表容器高度 */
.table-container { max-height: 500px; overflow-y: auto; border: 1px solid #eee; border-radius: 4px; } /* 表格容器樣式 */
.report-container table { width: 100%; border-collapse: collapse; font-size: 0.9rem; } /* 特定於報告頁的表格 */
.report-container th, .report-container td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #ddd; white-space: nowrap; } /* 防止內容換行 */
.report-container th { background-color: #f2f2f2; font-weight: bold; position: sticky; top: 0; z-index: 1; } /* 表頭固定 */
.report-container tbody tr:nth-child(even) { background-color: #fafafa; } /* 偶數行背景色 */
.report-container tbody tr:hover { background-color: #f0f0f0; }
#loading-indicator, #error-message { text-align: center; padding: 20px; font-size: 1.1rem; display: none; border-radius: 4px; }
#loading-indicator { background-color: #e0f7fa; color: #00796b; }
#error-message { color: #d32f2f; background-color: #ffebee; border: 1px solid #ef9a9a; }

/* 微調管理導航 */
.admin-nav a { margin: 0 0.3rem; padding: 0.5rem 0.8rem; } /* 稍微減少間距和內邊距 */

/* public/style.css (在檔案末尾追加或整合) */

/* --- Sales Report Page Specific Styles --- */
.sales-report-container { /* 如果你在 html 中用了這個 class */
    max-width: 1400px; margin: 20px auto; padding: 20px; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}
.sales-report-container h1, /* 如果用了 container class */
.container h1, /* 如果直接用 main.container */
.sales-report-container h2,
.container h2 {
     text-align: center; color: #333; margin-bottom: 20px;
}
.section-container { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 30px; }
.form-section { flex: 1 1 400px; background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef; min-width: 300px; }
.filter-section { flex: 1 1 400px; background-color: #f0f8ff; padding: 20px; border-radius: 8px; border: 1px solid #d1e7fd; min-width: 300px; }
.summary-section { width: 100%; margin-bottom: 20px; }
.summary-cards { display: flex; flex-wrap: wrap; gap: 20px; justify-content: space-around; margin-bottom: 20px; }
.card { background-color: #fff; padding: 15px 20px; border-radius: 5px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); text-align: center; flex: 1; min-width: 180px; }
.card h3 { margin-top: 0; color: #555; font-size: 1rem; margin-bottom: 5px; }
.card p { font-size: 1.5rem; font-weight: bold; color: #E57373; margin-bottom: 0; }
.chart-section { width: 100%; display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 30px; }
/* Chart.js canvas 的直接父容器需要設定 position: relative 和大小 */
.chart-container {
    flex: 1 1 500px;
    background-color: #fff;
    padding: 15px;
    border-radius: 5px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
    min-height: 350px;
    position: relative; /* 必須 */
    min-width: 300px; /* 確保小屏幕下也能顯示 */
}
.table-section { width: 100%; overflow-x: auto; }
#sales-report-table { /* 給 table 一個 ID 可能更好 */
    width: 100%; border-collapse: collapse; margin-top: 10px;
}
#sales-report-table th,
#sales-report-table td {
     padding: 10px 12px; text-align: left; border-bottom: 1px solid #ddd; vertical-align: middle;
}
#sales-report-table th { background-color: #FFB74D; color: #424242; white-space: nowrap; }
#sales-report-table tbody tr:hover { background-color: #f1f1f1; }
#sales-report-table td.actions { white-space: nowrap; }
#sales-report-table td.actions button { margin-right: 5px; margin-bottom: 5px;} /* RWD 時按鈕可能換行 */

/* Form Styles (繼承或覆蓋) */
.form-section .form-group, .filter-section .form-group { margin-bottom: 15px; }
.form-section label, .filter-section label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
.form-section input, .filter-section input, .form-section select, .filter-section select {
    width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 1rem;
}
.form-section .form-actions, .filter-section .form-actions { margin-top: 20px; text-align: right; }
.form-section .form-actions button, .filter-section .form-actions button { margin-left: 10px; }

/* Button Styles (確保與 style.css 一致或覆蓋) */
button { padding: 8px 15px; border-radius: 4px; cursor: pointer; border: none; font-size: 0.9rem; transition: background-color 0.2s ease; }
.btn-primary { background-color: #007bff; color: white; }
.btn-primary:hover { background-color: #0056b3; }
.btn-secondary { background-color: #6c757d; color: white; }
.btn-secondary:hover { background-color: #5a6268; }
.btn-success { background-color: #28a745; color: white; }
.btn-success:hover { background-color: #218838; }
.btn-warning { background-color: #ffc107; color: #212529; }
.btn-warning:hover { background-color: #e0a800; }
.btn-danger { background-color: #dc3545; color: white; }
.btn-danger:hover { background-color: #c82333; }

.error-message { color: red; font-size: 0.9em; margin-top: 5px; min-height: 1.2em; }
#loading-indicator { text-align: center; padding: 20px; font-style: italic; color: #777; display: none; }

/* Responsive adjustments */
@media (max-width: 1200px) {
    .chart-container { flex-basis: 100%; } /* 中等屏幕圖表各佔一行 */
}
@media (max-width: 768px) {
    .section-container { flex-direction: column; }
    .summary-cards { flex-direction: column; }
    .card { flex-basis: auto; }
    .form-section, .filter-section { flex-basis: auto; }
}
@media (max-width: 576px) {
     .card p { font-size: 1.3rem; }
     button { font-size: 0.85rem; padding: 6px 10px;}
     #sales-report-table th, #sales-report-table td { padding: 8px 6px; font-size: 0.9rem; }
}


/* 隨機輪播圖樣式 */
#random-banner-carousel {
    max-width: 500px; /* 500px */
    height: 400px; /* 400px 刪除這一行 */
    margin: 0 auto;
    padding: 0 0px;    /*     0px;      */
    background-color: #FFB74D;
    border-radius: 8px; /* 8px */
    
}

.random-banner-swiper .swiper-slide img {
    width: 100%;
    height: 370px; /* 調整為您喜歡的高度   */
    object-fit: cover;
    border-radius: 0%;
}

.random-banner-swiper .swiper-pagination {
    position: relative;
    margin-top: 20px; /* 0px */
}

/* 確保兩個輪播圖圖片顯示一致
.banner-image {
    width: 100%;
    height: 400px; /* 主要輪播圖高度 
    object-fit: cover;
    border-radius: 8px;
}

*/
 

/* 确保两个页面的轮播图共用相同样式 */
.banner-swiper {
    width: 100%;
    height: 370px; /* 统一高度 */
    background-color: #FFB74D; /* 统一背景色 */
    margin-bottom: 0rem; /* 2rem */
}

.banner-swiper .swiper-slide {
    text-align: center;
    font-size: 18px;
    background: #ffb74d; /* 与容器背景一致 */
    display: flex;
    justify-content: center;
    align-items: center;
}

.banner-swiper .swiper-slide img {
    display: block; /* 保持 block */

    /* --- 修改開始 --- */
    width: auto;   /* 讓寬度自動調整，以保持比例 */
    height: auto;  /* 讓高度自動調整，以保持比例 */
    max-width: 500px; /* ★ 你期望的最大寬度 */
    max-height: 370px; /* ★ 限制最大高度 (例如等於輪播容器高度) */
    object-fit: contain; /* ★ 確保圖片完整顯示並保持比例，而不是裁剪 */
    margin: auto; /* ★ 讓圖片在 slide 容器中水平和垂直居中 */
    /* --- 修改結束 --- */
}

/* 导航按钮样式统一 */
.banner-swiper .swiper-button-prev,
.banner-swiper .swiper-button-next {
    color: rgba(255, 255, 255, 0.7);
    --swiper-navigation-size: 30px;
}

.banner-swiper .swiper-button-prev:hover,
.banner-swiper .swiper-button-next:hover {
    color: rgba(255, 255, 255, 1);
}

/* 分页点样式统一 */
.banner-swiper .swiper-pagination-bullet {
    background: rgba(0, 0, 0, 0.3);
    opacity: 0.8;
}

.banner-swiper .swiper-pagination-bullet-active {
    background: #fff;
    opacity: 1;
}

/* 移除 music.html 中特定的随机轮播图样式
     #random-banner-carousel {
    max-width: 100% !important; /* 覆盖原有 max-width 
    height: 400px;
    margin: 0 auto; /* 居中  
    padding: 0; /* 移除内边距  
    border-radius: 0; /* 移除圆角  
}
*/ 






/* 集中樣式到隨機輪播圖
#random-banner-carousel {
    max-width: 500px;
    margin: 1rem auto;
    padding: 0 20px;
} */

.random-banner-swiper .swiper-slide {
    height: 400px; /* 適當調整高度 */
}


/*
.banner-image {
    width: 500px;
    height: 400px;
    object-fit: cover;
    border-radius: 8px;
    transition: transform 0.3s;
}
*/
.banner-image:hover {
    transform: scale(1.02);
}

/* --- Contribution Info Box Style --- */
.contribution-info {
    background-color: #fffaf0; /* 淡黃色背景，溫和提示 */
    border: 1px solid #ffeccc;  /* 淺橙色邊框 */
    border-left: 5px solid #FFB74D; /* 左側用主題橙色加強提示 */
    padding: 1rem 1.5rem;      /* 內邊距 */
    margin: 1.5rem auto;       /* 上下邊距，並水平居中 (如果父容器允許) */
    border-radius: 6px;        /* 圓角 */
    text-align: center;        /* 文字居中 */
    font-size: 0.95rem;        /* 合適的字體大小 */
    color: #5f4c3a;            /* 略深的暖色文字 */
    line-height: 1.7;          /* 增加行高，提高可讀性 */
    max-width: 800px;          /* 限制最大寬度，避免過寬 */
    box-shadow: 0 1px 3px rgba(0,0,0,0.05); /* 細微陰影 */
}

.contribution-info a {
    color: #E57373;            /* 使用珊瑚紅作為連結顏色 */
    font-weight: 500;          /* 字體加粗一點 */
    text-decoration: none;     /* 移除預設下劃線 */
    transition: color 0.2s ease;
}

.contribution-info a:hover {
    color: #d32f2f;            /* 滑鼠懸停時顏色加深 */
    text-decoration: underline;/* 滑鼠懸停時顯示下劃線 */
}

/* 如果希望在小屏幕上調整樣式 */
@media (max-width: 600px) {
    .contribution-info {
        padding: 0.8rem 1rem;
        font-size: 0.9rem;
        text-align: left; /* 小屏幕改回左對齊可能更好讀 */
    }
}




/* public/style.css (追加) */

/* --- 頁面標題 Header 樣式 (現代) --- */
.page-title-header {
    background-color: #FFB74D;
    padding: 1.5rem 1rem;
    text-align: center;
    margin-bottom: 1.5rem;
    border-bottom: 3px solid rgba(0, 0, 0, 0.05); /* 用底部邊框代替陰影 */
}

.page-title {
    color: #424242;
    margin: 0;
    font-family: 'Poppins', 'Noto Sans TC', sans-serif; /* 使用 Poppins 字體 */
    font-size: 1.5rem;
    font-weight: 600; /* Semi-bold */
    letter-spacing: 0.5px;
    line-height: 1.3;
    /* text-transform: uppercase; */ /* 可選：轉換為大寫 */
} 

/* 響應式調整 */
@media (max-width: 600px) {
    .page-title-header {
        padding: 1rem;
        margin-bottom: 1rem;
    }
    .page-title {
        font-size: 1.5rem;
    }
}


/* public/style.css (追加或整合以下樣式) */

/* --- 留言板通用容器 --- */
.guestbook-container,
.message-detail-container,
.guestbook-admin-container, /* 後台列表 */
.admin-identities-container, /* 後台身份管理 */
.admin-message-detail-container /* 後台詳情 */
{
    max-width: 900px; /* 比商品頁稍窄，更適合閱讀 */
    margin: 1.5rem auto;
    padding: 1.5rem;
    background-color: #fff; /* 使用白色背景增加對比 */
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08); /* 比商品卡片稍明顯的陰影 */
}

/* --- 區塊標題 (例如 "留下您的足跡", "最新活動留言") --- */
.guestbook-container h2,
.message-detail-container h2,
.guestbook-admin-container h2,
.admin-identities-container h2,
.admin-message-detail-container h2 {
    font-size: 1.3rem;
    color: #424242;
    margin-top: 0;
    margin-bottom: 1.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid #FFB74D; /* 使用主題橙色作為下邊框 */
    font-weight: 700;
}

/* --- 表單樣式 (沿用並微調 Modal 樣式) --- */
.post-message-section form,
.reply-form-section form, /* 詳情頁回覆表單 */
#identity-form, /* 身份管理表單 */
#admin-reply-form /* 管理員回覆表單 */
{
    margin-bottom: 1.5rem;
}

/* 繼承 .form-group, label, input, textarea, button 的現有樣式 */
/* 可以針對留言板的表單按鈕做微調 */
#submit-message-btn,
#submit-reply-btn, /* 詳情頁回覆按鈕 */
#admin-reply-form button[type="submit"] {
    background-color: #E57373; /* 使用珊瑚紅作為提交按鈕顏色 */
    color: white;
    border: none;
    padding: 10px 18px; /* 稍微大一點的按鈕 */
}
#submit-message-btn:hover,
#submit-reply-btn:hover,
#admin-reply-form button[type="submit"]:hover {
    background-color: #d32f2f; /* 懸停加深 */
}

/* 狀態訊息 */
.status-message,
#post-status,
#reply-status,
#identity-form .form-status,
#admin-reply-form .reply-status {
    font-size: 0.9em;
    margin-top: 10px;
    min-height: 1.2em; /* 佔位，避免佈局跳動 */
    font-weight: 500;
}

/* --- 前台列表頁 (`guestbook.html`) --- */
.message-list-item {
    padding: 1rem 0;
    /* border-bottom: 1px solid #eee; */ /* 用 hr 代替 */
}
.message-list-item:last-child {
    border-bottom: none;
}
.message-list-item .author {
    font-weight: 700;
    color: #424242;
    margin-right: 0.5rem;
}
.message-list-item .timestamp {
    font-size: 0.8em;
    color: #757575;
    margin-left: 0.5rem;
}
.message-list-item .content-preview {
    display: block; /* 獨佔一行 */
    margin: 0.5rem 0;
    color: #555;
    line-height: 1.6;
    text-decoration: none; /* 移除連結下劃線 */
    transition: color 0.2s ease;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3; /* 限制顯示 3 行 */
    -webkit-box-orient: vertical;
    /* 對於不支持的瀏覽器的後備，效果不完美 */
    max-height: calc(1.6em * 3); /* line-height * 行數 */
    line-height: 1.6em; /* 需要明確的行高 */
}
.message-list-item .content-preview:hover {
    color: #E57373; /* 連結懸停用珊瑚紅 */
}
.message-list-item .meta {
    font-size: 0.85em;
    color: #888;
    margin-right: 1rem;
}
.message-list-item .view-detail-btn {
    font-size: 0.85em;
    color: #E57373;
    text-decoration: none;
    font-weight: 500;
}
.message-list-item .view-detail-btn:hover {
    text-decoration: underline;
}

/* 分頁樣式 (沿用 news.html 的 #pagination-controls) */
/* 如果 guestbook.html 的分頁容器 ID 不同，需要修改選擇器 */
#pagination-container { /* 確保 ID 匹配 */
     text-align: center;
     margin-top: 2rem;
}
/* 繼承 #pagination-controls 的樣式 */
#pagination-container button,
#pagination-container span {
     padding: 8px 12px; margin: 0 3px; border: 1px solid #ccc; background-color: #fff; color: #555; cursor: pointer; border-radius: 4px; transition: background-color 0.2s ease, color 0.2s ease;
}
#pagination-container button:hover { background-color: #eee; }
#pagination-container button:disabled { opacity: 0.6; cursor: not-allowed; background-color: #FFB74D; color: white; border-color: #FFB74D; font-weight: bold; }
#pagination-container span { padding: 8px 5px; }


/* --- 前台詳情頁 (`message-detail.html`) --- */
.message-detail-main {
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #eee;
}
.message-detail-main .author { font-weight: 700; font-size: 1.1rem; }
.message-detail-main .timestamp { font-size: 0.85em; color: #757575; margin-left: 0.5rem; }
.message-content { /* 主留言內文 */
    margin-top: 1rem;
    font-size: 1rem;
    line-height: 1.8;
    color: #424242;
    white-space: pre-wrap; /* 處理換行 */
    word-wrap: break-word;
}

.reply-list {
    margin-top: 1.5rem;
}
.reply-item {
    padding: 0.8rem 0.8rem;
    margin-bottom: 1rem;
    border-left: 3px solid #eee; /* 預設左邊框 */
    background-color: #fdfdfd; /* 非常淺的背景 */
}
.reply-item .author {
    font-weight: 600; /* 回覆者名稱稍細 */
    color: #555;
    margin-right: 0.5rem;
}
.reply-item .timestamp {
    font-size: 0.8em;
    color: #888;
}
.reply-content {
    margin-top: 0.4rem;
    font-size: 0.95rem;
    line-height: 1.7;
    color: #555;
    white-space: pre-wrap; /* 處理換行 */
    word-wrap: break-word;
}

/* 管理員回覆樣式 */
.admin-reply {
    background-color: #FFF8E1; /* 淡黃色背景 */
    border-left: 3px solid #FFB74D; /* 主題橙色邊框 */
}
.admin-reply .author {
    color: #FF8F00; /* 橙色字體 */
    font-weight: 700; /* 加粗 */
}

/* --- 後台頁面通用 (沿用現有 admin 樣式) --- */
/* .admin-nav ... (沿用) */
.guestbook-admin-container h2,
.admin-identities-container h2,
.admin-message-detail-container h2 {
    text-align: left; /* 後台標題靠左 */
    border-bottom-color: #ccc; /* 後台下邊框用灰色 */
}

.admin-table { /* 後台表格樣式 */
    width: 100%;
    border-collapse: collapse;
    margin-top: 1.5rem;
    font-size: 0.9rem;
}
.admin-table th, .admin-table td {
    border: 1px solid #ddd;
    padding: 8px 10px;
    text-align: left;
    vertical-align: middle;
}
.admin-table th {
    background-color: #f2f2f2;
    font-weight: 600;
}
.admin-table tbody tr:nth-child(even) {
    background-color: #f9f9f9;
}
.admin-table tbody tr:hover {
    background-color: #f0f0f0;
}
.admin-table .content-preview { /* 限制預覽寬度 */
    max-width: 300px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: inline-block; /* 讓 ellipsis 生效 */
}
.admin-table .actions button,
.admin-table .actions a {
    margin-right: 5px;
    padding: 4px 8px;
    font-size: 0.8em;
    cursor: pointer;
}
.admin-table .actions a {
     display: inline-block;
     background-color: #6c757d; color: white; border-radius: 3px; text-decoration: none;
}
.admin-table .actions a:hover { background-color: #5a6268; }

/* 狀態標示 */
.status-visible { color: green; font-weight: bold; }
.status-hidden { color: red; font-style: italic; }

/* --- 後台身份管理頁 (`admin-identities.html`) --- */
#identity-form {
    background-color: #f8f9fa;
    padding: 15px;
    border: 1px solid #eee;
    border-radius: 5px;
    margin-bottom: 1.5rem;
}

/* --- 後台詳情頁 (`admin-message-detail.html`) --- */
.admin-message-detail-container .message-detail-main,
.admin-message-detail-container .reply-list {
    border-bottom: 1px solid #ccc;
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
}
.admin-message-detail-container .reply-item {
    border-left-color: #ccc; /* 後台邊框用灰色 */
    padding-left: 10px;
}
.admin-message-detail-container .admin-reply {
    border-left-color: #FFB74D;
    background-color: #fffaf0; /* 後台管理員回覆背景色 */
}
.admin-message-detail-container .reply-actions button {
    margin-left: 10px;
    padding: 2px 5px;
    font-size: 0.75em;
}
#admin-reply-form {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #eee;
}
#admin-identity-select {
    margin-bottom: 1rem;
    display: block; /* 下拉選單獨佔一行 */
    max-width: 250px; /* 限制寬度 */
} 

/* --- 按讚按鈕樣式 --- */
.like-btn {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    font-size: 1.1em; /* 稍微放大 Emoji/圖標 */
    line-height: 1;
    color: #cccccc; /* 預設灰色 */
    transition: color 0.2s ease, transform 0.1s ease;
    vertical-align: middle; /* 對齊旁邊的文字 */
}

.like-btn:hover {
    color: #f48fb1; /* 懸停變粉色 */
    transform: scale(1.2);
}

.like-btn:disabled { /* 點擊後的禁用樣式 */
    cursor: not-allowed;
    opacity: 0.6;
}



/* --- 排序按鈕區域樣式 --- */
.sort-controls {
    margin-bottom: 1.5rem;
    padding-bottom: 0.5rem; /* 可選，給下方留點空間 */
    text-align: right; /* 按鈕靠右 */
  /*   font-size: 0.9em;    */
    color: #555;
}

.sort-btn {
    background: none;
    border: none;
    padding: 5px 8px;
    margin-left: 8px;
    cursor: pointer;
    color: #007bff; /* 用藍色表示可點擊 */
    text-decoration: underline;
    font-size: 0.7em; /* 繼承父元素字體大小 */
    border-radius: 4px;
    transition: background-color 0.2s ease, color 0.2s ease;
}

.sort-btn:hover {
    color: #0056b3;
    background-color: #e9ecef; /* 淺灰色背景 */
}

.sort-btn.active {
    color: #424242; /* 使用深灰色表示當前選中 */
    font-weight: bold;
    text-decoration: none; /* 移除下劃線 */
    background-color: #FFB74D; /* 使用主題橙色背景 */
    cursor: default; /* 不可再點擊 */
}


/* --- Emoji 觸發按鈕樣式 --- */
#post-emoji-trigger,
#reply-emoji-trigger,
#admin-reply-emoji-trigger {
    padding: 3px 8px;
    font-size: 1.2em; /* 讓 Emoji 大一點 */
    line-height: 1;
    background-color: #f8f9fa;
    border: 1px solid #ced4da;
    border-radius: 4px;
    cursor: pointer;
    vertical-align: middle; /* 與旁邊文字對齊 */
}
#post-emoji-trigger:hover,
#reply-emoji-trigger:hover,
#admin-reply-emoji-trigger:hover {
    background-color: #e9ecef;
}


/* --- 詳情 Modal 內部 --- */
.modal-content { /* 可以稍微增大 Modal 寬度 */
    max-width: 750px;
    background-color: #fdfdfd; /* Modal 背景稍淺 */
}
#modal-message-detail-main .message-content { /* Modal 內主留言內容 */
     background-color: transparent; /* 移除後台的淺灰背景 */
     padding: 15px 0;
}
#modal-reply-list-container {
     max-height: 50vh; /* 限制回覆列表最大高度，出現滾動條 */
     overflow-y: auto;
     padding-right: 10px; /* 留出滾動條空間 */
     margin-top: 1rem;
     border-top: 1px solid #eee;
     padding-top: 1rem;
}
.reply-item {
    padding: 0.8rem; /* 增加內邊距 */
    margin-bottom: 0.8rem;
    border-left: 3px solid #ECEFF1; /* 淺灰邊框 */
    background-color: #fff; /* 回覆背景用白色 */
    border-radius: 4px; /* 輕微圓角 */
}
.reply-item.nested { /* 嵌套縮排 */
    margin-left: 30px; /* 加大縮排 */
    border-left-color: #CFD8DC; /* 嵌套邊框稍深 */
    background-color: #fbfcfe; /* 嵌套背景極淺藍 */
}
.admin-reply { /* 管理員回覆 */
    background-color: #FFF8E1 !important; /* 覆蓋嵌套背景 */
    border-left: 3px solid #FFB74D !important;
}


/* --- 前台留言列表項 --- */
.message-list-item {
    padding: 1rem 0;
    /* border-bottom 由 hr 處理 */
}
.message-list-item .author { /* 與 news-card 類似 */
    font-weight: 700;
    color: #424242;
}
.message-list-item .timestamp { /* 與 news-card 類似 */
    font-size: 0.8em;
    color: #757575;
    margin-left: 0.5rem;
}
.message-list-item .content-preview {
    display: block;
    margin: 0.6rem 0;
    color: #555;
    line-height: 1.6;
    text-decoration: none;
    transition: color 0.2s ease;
    /* CSS 限制行數 */
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3; /* 限制 3 行 */
    -webkit-box-orient: vertical;
    /* 兼容性後備 */
    max-height: calc(1.6em * 3); /* line-height * 行數 */
}
.message-list-item .content-preview:hover { color: #E57373; }
.message-list-item .meta {
    font-size: 0.85em;
    color: #888;
    margin-right: 1rem;
    vertical-align: middle; /* 與按鈕對齊 */
}
.message-list-item .meta.view-detail-modal-btn { /* 可點擊的回覆數 */
    cursor: pointer;
    color: #007bff;
    text-decoration: underline;
}
.message-list-item .meta.view-detail-modal-btn:hover { color: #0056b3; }
.message-list-item .view-detail-modal-btn { /* [查看詳情] 按鈕 */
    font-size: 0.85em;
    color: #6c757d; /* 次要顏色 */
    text-decoration: none;
    font-weight: 500;
    margin-left: 0.5rem;
    vertical-align: middle;
    background: none;
    border: none;
    padding: 0;
}

.form-group input[type="text"],
.form-group textarea {
    border: 1px solid #ced4da; /* 淺灰色邊框 */
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.form-group input[type="text"]:focus,
.form-group textarea:focus {
    border-color: #FFB74D; /* 聚焦時用主題橙色 */
    box-shadow: 0 0 0 0.2rem rgba(255, 183, 77, 0.25); /* 聚焦光暈 */
    outline: none;
}
/* --- 提交按鈕樣式 (參考 .btn-primary 或 .btn-success) --- */
#submit-message-btn,
#modal-submit-reply-btn, /* Modal 內的回覆按鈕 */
#save-identity-btn, /* 身份儲存按鈕 */
#admin-reply-form button[type="submit"] /* 管理員回覆按鈕 */
{
    background-color: #E57373; /* 珊瑚紅 */
    color: white;
    border: none;
    padding: 10px 18px;
    font-weight: 500;
}
#submit-message-btn:hover,
#modal-submit-reply-btn:hover,
#save-identity-btn:hover,
#admin-reply-form button[type="submit"]:hover {
    background-color: #d32f2f; /* 懸停加深 */
}
/* --- 取消/關閉按鈕 (參考 .btn-secondary) --- */
.close-modal-btn, #cancel-edit-btn {
     background-color: #6c757d;
     color: white;
     border: none;
     padding: 10px 18px; /* 與提交按鈕一致 */
}
.close-modal-btn:hover, #cancel-edit-btn:hover {
    background-color: #5a6268;
}
/* --- 狀態訊息 --- */
.status-message {
    font-size: 0.9em;
    margin-top: 10px;
    min-height: 1.2em;
    font-weight: 500;
}



/* --- 區塊標題 (H2) - 統一樣式 --- */
/* 可以覆蓋 .container h2 的預設居中 */
.guestbook-container h2,
.message-detail-container h2,
.guestbook-admin-container h2,
.admin-identities-container h2,
.admin-message-detail-container h2 {
    font-size: 1.5rem; /* 稍微大一點 */
    color: #424242;
    margin-top: 0;
    margin-bottom: 1.5rem;
    padding-bottom: 0.8rem;
    border-bottom: 2px solid #FFB74D; /* 主題橙色下邊框 */
    font-weight: 700;
    text-align: left; /* 標題靠左 */
}
.guestbook-header { /* 用於放置標題和發表按鈕的容器 */
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 0.8rem;
    border-bottom: 2px solid #FFB74D;
}
.guestbook-header h2 {
    margin-bottom: 0; /* 移除標題自身的下邊距和邊框 */
    padding-bottom: 0;
    border-bottom: none;
}


/* public/style.css (追加) */

/* 後台詳情頁回覆操作按鈕 */
.admin-message-detail-container .reply-actions button {
    margin-right: 8px; /* 統一右邊距 */
    margin-bottom: 5px; /* 小屏幕換行時的下邊距 */
    vertical-align: middle;
}

/* 引用按鈕樣式 (使用 link 樣式) */
.admin-message-detail-container .admin-quote-action-btn {
    background: none;
    border: none;
    color: #6c757d; /* 次要顏色 */
    padding: 4px 0; /* 調整 padding */
    font-size: 0.8em;
    text-decoration: underline;
    cursor: pointer;
}
.admin-message-detail-container .admin-quote-action-btn:hover {
    color: #5a6268;
}

/* 樓層號樣式 */
.reply-floor {
    display: inline-block;
    min-width: 30px; /* 給樓層號留出基本寬度 */
    text-align: right; /* 樓層號靠右對齊 */
    color: #888;
    font-size: 0.9em;
}

/* 嵌套回覆的邊距 */
.admin-message-detail-container .reply-item.nested {
    margin-left: 30px; /* 增加嵌套縮排 */
    border-left: 2px solid #CFD8DC; /* 嵌套邊框顏色 */
    padding-left: 10px; /* 增加左內邊距 */
}

/* public/style.css (追加樣式) */

/* --- 留言板列表頁：普通留言預覽背景色 --- */
.message-list-item .content-preview {
    background-color: rgb(248, 249, 250); /* 淺灰色背景 */
    padding: 0.6rem 0.8rem;             /* 增加一點內邊距 */
    border-radius: 4px;                 /* 輕微圓角 */
    margin-top: 0.8rem;                 /* 調整與上方元素的間距 */
    margin-bottom: 0.8rem;              /* 調整與下方元素的間距 */
    /* 保留原有的行數限制樣式 */
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    line-height: 1.6;
    max-height: calc(1.6em * 3);
}

/* --- 詳情 Modal：主留言內容背景色 --- */
#modal-message-detail-main .message-content {
    background-color: rgb(248, 249, 250); /* 淺灰色背景 */
    padding: 0.8rem 1rem;             /* 增加內邊距 */
    border-radius: 4px;                 /* 輕微圓角 */
    margin-top: 1rem;                   /* 調整上方間距 */
    /* 保留原有的 white-space 和 word-wrap */
    white-space: pre-wrap;
    word-wrap: break-word;
}

/* --- 詳情 Modal：普通用戶回覆內容背景色 --- */
#modal-reply-list-container .reply-item:not(.admin-reply) .reply-content {
    background-color: rgb(248, 249, 250); /* 淺灰色背景 */
    padding: 0.6rem 0.8rem;             /* 內邊距 */
    border-radius: 4px;                 /* 輕微圓角 */
    margin-top: 0.6rem;                 /* 調整上方間距 */
    /* 保留原有的 white-space 和 word-wrap */
    white-space: pre-wrap;
    word-wrap: break-word;
}


/* --- 留言板 詳情 Modal：管理員回覆內容樣式 (保持或調整) --- */
/* 你可以保持 .admin-reply 的樣式，或者如果想讓管理員回覆內容也有特定樣式 */
/*
#modal-reply-list-container .reply-item.admin-reply .reply-content {
    background-color: #fffaf0; /* 例如，用更淺的黃色
    padding: 0.6rem 0.8rem;
    border-radius: 4px;
    margin-top: 0.6rem;
    white-space: pre-wrap;
    word-wrap: break-word;
}
*/



/* public/style.css (追加樣式) */

/* --- 隱藏詳情 Modal 頂部的靜態 H2 ("留言詳情") --- */
/* 選擇 #message-detail-modal 下的 .modal-content 中的第一個直接子元素 h2 */
#message-detail-modal > .modal-content > h2 {
    display: none;
}

/* --- 詳情 Modal：加粗作者名稱 --- */
#modal-message-detail-main .author {
    font-weight: bold; /* 加粗 */
    font-size: 1.1em;  /* 可選：稍微放大一點字體 */
    color: #333;      /* 可選：使用更深的顏色 */
}

/* --- 詳情 Modal：調整作者和時間戳行的樣式 --- */
#modal-message-detail-main p:first-of-type { /* 選中包含作者和時間戳的段落 */
    margin-bottom: 0.8rem; /* 調整與下方 hr 的間距 */
}


/* public/style.css (追加樣式) */

/* --- 詳情 Modal：回覆項目的操作按鈕區域 --- */
#message-detail-modal .reply-item-actions {
    margin-top: 0.5rem; /* 按鈕與回覆內容的間距 */
    text-align: left; /* 讓按鈕靠右 (可選) */
}

/* --- 詳情 Modal：「回覆」和「引用」按鈕樣式 --- */
#message-detail-modal .reply-item-actions .btn-link {
    font-size: 0.8em;      /* 縮小字體大小 */
    padding: 2px 6px;      /* 調整內邊距，讓按鈕更緊湊 */
    color: #6c757d;      /* 使用次要顏色 (灰色) */
    text-decoration: none; /* 移除預設下劃線 */
    border: 1px solid transparent; /* 添加透明邊框佔位，避免 hover 時跳動 */
    border-radius: 3px;
    margin-left: 8px;      /* 按鈕之間的間距 */
    vertical-align: middle; /* 與旁邊的愛心對齊 */
    transition: color 0.2s ease, background-color 0.2s ease;
}

#message-detail-modal .reply-item-actions .btn-link:hover {
    color: #e8e8e8;      /* 懸停時加深顏色 */
    background-color: #f799ba; /* 懸停時淺灰色背景 */
    text-decoration: underline; /* 懸停時顯示下劃線 */
    border-color: #c3c1c1; /* 懸停時顯示淺邊框 */
}

/* --- 詳情 Modal：回覆項目中的按讚按鈕和計數調整 --- */
#message-detail-modal .reply-item-actions .like-btn {
    font-size: 1em;        /* 愛心圖標大小 (相對於 .btn-link 稍大) */
    padding: 2px 4px;      /* 微調 padding */
    vertical-align: middle;
}

#message-detail-modal .reply-item-actions .like-count {
    font-size: 0.8em;      /* 計數數字大小與回覆/引用一致 */
    vertical-align: middle;
    color: #888; /* 計數顏色稍淺 */
}


/* public/style.css (追加或修改樣式) */

/* --- 詳情 Modal：重設 回覆/引用 按鈕樣式，覆蓋通用按鈕樣式 --- */
 

/* --- 詳情 Modal：回覆/引用 按鈕 Hover 效果 --- */
#message-detail-modal .reply-item-actions .reply-action-btn:hover,
#message-detail-modal .reply-item-actions .quote-action-btn:hover {
    color: #5a6268 !important;             /* 懸停顏色加深 */
    text-decoration: underline !important; /* 懸停加下劃線 */
    background-color: transparent !important; /* 確保懸停時背景仍然透明 */
}

/* --- 可選：微調 Modal 內 Like 按鈕和計數的對齊 --- */
/* (如果因為上面按鈕變小導致對不齊) */
#message-detail-modal .reply-item-actions .like-btn {
    vertical-align: middle;
    padding-bottom: 1px; /* 可能需要微調 */
}
#message-detail-modal .reply-item-actions .like-count {
    vertical-align: middle;
}

/* --- 確保之前的按鈕樣式選擇器更具體，避免衝突 --- */
/* 例如，如果之前有 .btn-link 全局樣式，現在需要確保它不會影響 modal 內的 */
/* 檢查並調整你 style.css 中其他的 .btn, .btn-link, .btn-sm 等樣式， */
/* 確保它們的選擇器不會過於寬泛地應用到 modal 內的按鈕上， */
/* 或者使用更具體的選擇器如下面的例子 */

/* 比如之前的全局樣式是這樣: */
/* .btn-link { color: blue; ... } */

/* 可以改成只應用於特定區域，例如: */
/* .some-other-container .btn-link { color: blue; ... } */

/* 或者確保 Modal 內的樣式優先級更高 (如此處使用的 ID 選擇器) */