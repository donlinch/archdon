// 引入 pdf.js 函式庫 (ES Module 方式)
import * as pdfjsLib from '//mozilla.github.io/pdf.js/build/pdf.mjs';

// 設定 PDF.js worker 的來源路徑 (CDN 路徑通常比較穩定)
if (typeof pdfjsLib.GlobalWorkerOptions?.workerSrc === 'string') {
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.mjs';
    } catch (e) {
        console.warn('無法設定 PDF.js workerSrc (可能在不支援的環境中):', e);
    }
} else {
    console.warn('PDF.js GlobalWorkerOptions.workerSrc 無法設定，可能使用預設 worker。');
}


// --- DOM 元素獲取 ---
const artistFilterContainer = document.getElementById('artist-filter');
const songList = document.getElementById('song-list');
const songDetailContainer = document.getElementById('song-detail-container');
const songInfo = document.getElementById('song-info');
const youtubePlayerContainer = document.getElementById('youtube-player');
const scoreSelectorContainer = document.getElementById('score-selector');
const pdfViewerContainer = document.getElementById('pdf-viewer-container');
const pdfCanvas = document.getElementById('pdf-canvas');
const pdfLoading = document.getElementById('pdf-loading');
const pdfError = document.getElementById('pdf-error');
const pdfPrevBtn = document.getElementById('pdf-prev');
const pdfNextBtn = document.getElementById('pdf-next');
const pdfPageNum = document.getElementById('pdf-page-num');
const pdfPageCount = document.getElementById('pdf-page-count');

// --- 狀態變數 ---
let currentPdfDoc = null;
let currentPageNum = 1;
let currentSongId = null;
let currentArtist = 'All'; // 預設顯示全部
let pdfPageRendering = false; // PDF 頁面是否正在渲染
let pageNumPending = null; // 等待渲染的頁碼

// --- API 請求函數 ---
async function fetchApi(url, errorMessage) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            // 嘗試解析錯誤訊息，如果伺服器有回傳 JSON 的話
            let errorDetails = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorDetails += `, message: ${errorData.error || response.statusText}`;
            } catch (parseError) {
                // 如果解析 JSON 失敗，就用原始的 statusText
                errorDetails += `, message: ${response.statusText}`;
            }
            throw new Error(errorDetails);
        }
        // 檢查 Content-Type 是否為 JSON
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json();
        } else {
            // 如果不是 JSON，可能直接返回文本或拋出錯誤
            console.warn(`API ${url} did not return JSON. Content-Type: ${contentType}`);
            return await response.text(); // 或者根據需要處理
        }
    } catch (error) {
        console.error(`${errorMessage}:`, error);
        throw error; // 重新拋出錯誤以便上層處理
    }
}

async function fetchArtists() {
    // 確保容器存在
    if (!artistFilterContainer) {
        console.error('Artist filter container not found!');
        return;
    }
    artistFilterContainer.innerHTML = '<p>載入歌手中...</p>'; // 初始載入提示
    try {
        const artists = await fetchApi('/api/scores/artists', 'Error fetching artists');
        renderArtistFilters(artists);
    } catch (error) {
        artistFilterContainer.innerHTML = '<p style="color: red;">無法載入歌手列表。</p>';
    }
}

async function fetchSongs(artist = 'All') {
     // 確保列表元素存在
     if (!songList) {
         console.error('Song list element not found!');
         return;
     }
    songList.innerHTML = '<p>載入歌曲中...</p>'; // 載入提示
    currentSongId = null; // 清除當前選中的歌曲
    if (songDetailContainer) songDetailContainer.classList.remove('visible'); // 隱藏詳情區
    try {
        const decodedArtist = decodeURIComponent(artist); // 先解碼再判斷
        const url = decodedArtist === 'All' ? '/api/scores/songs' : `/api/scores/songs?artist=${artist}`; // 查詢時仍用編碼後的
        const songs = await fetchApi(url, `Error fetching songs for artist ${decodedArtist}`);
        renderSongList(songs);
    } catch (error) {
        songList.innerHTML = '<p style="color: red;">無法載入歌曲列表。</p>';
    }
}

async function fetchSongDetail(songId) {
    if (currentSongId === songId || !songDetailContainer || !songInfo || !youtubePlayerContainer || !scoreSelectorContainer || !pdfViewerContainer) {
        if(currentSongId === songId) console.log("Already viewing this song:", songId);
        else console.error("Song detail DOM elements missing.");
        return;
    }

    currentSongId = songId;
    songInfo.textContent = '載入歌曲詳情中...';
    youtubePlayerContainer.innerHTML = '';
    scoreSelectorContainer.innerHTML = ''; // 清空樂譜選擇區
    pdfViewerContainer.style.display = 'none'; // 隱藏 PDF 檢視器
    if(pdfError) pdfError.style.display = 'none';
    if(pdfLoading) pdfLoading.style.display = 'none';
    songDetailContainer.classList.add('visible'); // 顯示詳情區

    // --- 更新歌曲列表的選中狀態 ---
    document.querySelectorAll('#song-list li').forEach(li => {
        li.classList.toggle('active', li.dataset.songId === songId.toString());
    });
    // --- 更新結束 ---

    try {
        const song = await fetchApi(`/api/music/${songId}`, `Error fetching song detail for id ${songId}`);
        renderSongDetail(song);

        // 自動載入第一個樂譜（如果存在）
        if (song.scores && song.scores.length > 0) {
            const firstScoreButton = scoreSelectorContainer.querySelector('.score-type-btn');
            if (firstScoreButton && firstScoreButton.dataset.pdfUrl) {
                // 移除之前可能存在的 active class
                scoreSelectorContainer.querySelectorAll('.score-type-btn.active').forEach(btn => btn.classList.remove('active'));
                // 添加 active class 到第一個按鈕
                firstScoreButton.classList.add('active');
                // 載入 PDF
                loadPdf(firstScoreButton.dataset.pdfUrl); // 傳遞已編碼的 URL
            } else {
                 console.log("No valid first score button found or it's missing the URL.");
                 if(pdfViewerContainer) pdfViewerContainer.style.display = 'none';
            }
        } else {
             if(pdfViewerContainer) pdfViewerContainer.style.display = 'none'; // 確保沒有樂譜時隱藏
        }
    } catch (error) {
        songInfo.textContent = '無法載入歌曲詳情。';
        console.error('Song Detail Fetch Error:', error);
    }
}

// --- 渲染函數 ---
function renderArtistFilters(artists) {
     if (!artistFilterContainer) return;
     const decodedCurrentArtist = decodeURIComponent(currentArtist);
    let buttonsHTML = `<button class="artist-filter-btn ${decodedCurrentArtist === 'All' ? 'active' : ''}" data-artist="All">全部歌手</button>`;
    artists.forEach(artist => {
        const encodedArtist = encodeURIComponent(artist);
        // 比較時用解碼後的，設置 data-artist 時用編碼後的
        buttonsHTML += `<button class="artist-filter-btn ${decodedCurrentArtist === artist ? 'active' : ''}" data-artist="${encodedArtist}">${artist}</button>`;
    });
    artistFilterContainer.innerHTML = buttonsHTML;
}

function renderSongList(songs) {
     if (!songList) return;
    if (!songs || songs.length === 0) {
        songList.innerHTML = '<p>此分類下沒有包含樂譜的歌曲。</p>';
        return;
    }
    songList.innerHTML = songs.map(song => `
        <li data-song-id="${song.id}">
            <span class="song-title">${song.title || '未知標題'}</span>
            <span class="song-artist">${song.artist || '未知歌手'}</span>
        </li>
    `).join('');
}

function renderSongDetail(song) {
    if (!songInfo || !youtubePlayerContainer || !scoreSelectorContainer) return;

    songInfo.textContent = `${song.title || '未知標題'} - ${song.artist || '未知歌手'}`;

    // 渲染 YouTube 播放器
    if (song.youtube_video_id) {
        youtubePlayerContainer.innerHTML = `
            <iframe
                src="https://www.youtube.com/embed/${song.youtube_video_id}"
                title="YouTube video player for ${song.title || ''}"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen>
            </iframe>`;
    } else {
        youtubePlayerContainer.innerHTML = '<p>此歌曲沒有可用的 YouTube 影片。</p>';
    }

    // 渲染樂譜選擇器
    if (song.scores && Array.isArray(song.scores) && song.scores.length > 0) {
        const scoreButtonsHTML = song.scores
            .filter(score => score.type && score.pdf_url) // 過濾掉無效的樂譜數據
            .map(score => `
            <button class="action-btn score-type-btn" data-pdf-url="${encodeURIComponent(score.pdf_url)}">
                ${score.type}
            </button>
        `).join('');

        if (scoreButtonsHTML) { // 確保過濾後仍有按鈕
             scoreSelectorContainer.innerHTML = `<h3>選擇樂譜類型:</h3> ${scoreButtonsHTML}`;
        } else {
             scoreSelectorContainer.innerHTML = '<p>此歌曲沒有可用的樂譜連結。</p>';
             if(pdfViewerContainer) pdfViewerContainer.style.display = 'none'; // 隱藏 PDF 檢視器
        }
    } else {
        scoreSelectorContainer.innerHTML = '<p>此歌曲沒有可用的樂譜。</p>';
        if(pdfViewerContainer) pdfViewerContainer.style.display = 'none'; // 隱藏 PDF 檢視器
    }
}

// 改進 loadPdf 函數
async function loadPdf(encodedPdfUrl) {
    if (!encodedPdfUrl || typeof encodedPdfUrl !== 'string') {
        console.warn('No PDF URL provided or invalid URL format.');
        if(pdfViewerContainer) pdfViewerContainer.style.display = 'none';
        return;
    }
    
    // 確保相關元素都存在
    if (!pdfLoading || !pdfError || !pdfCanvas || !pdfViewerContainer || 
        !pdfPrevBtn || !pdfNextBtn || !pdfPageNum || !pdfPageCount) {
        console.error("PDF viewer DOM elements missing.");
        return;
    }

    // 顯示載入狀態
    pdfLoading.style.display = 'block';
    pdfError.style.display = 'none';
    pdfCanvas.style.display = 'none';
    pdfViewerContainer.style.display = 'block';
    pdfPrevBtn.disabled = true;
    pdfNextBtn.disabled = true;
    pdfPageNum.textContent = '-';
    pdfPageCount.textContent = '-';
    currentPdfDoc = null;
    currentPageNum = 1;

    try {
        // 使用代理 URL 載入 PDF
        const proxyUrl = `/api/scores/proxy?url=${encodedPdfUrl}`;
        console.log("Requesting PDF via proxy:", proxyUrl);

        const loadingTask = pdfjsLib.getDocument({
            url: proxyUrl,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@2.10.377/cmaps/',
            cMapPacked: true
        });
        
        currentPdfDoc = await loadingTask.promise;
        console.log('PDF loaded successfully. Pages:', currentPdfDoc.numPages);
        
        // 更新 UI 狀態
        pdfLoading.style.display = 'none';
        pdfPageCount.textContent = currentPdfDoc.numPages;
        pdfCanvas.style.display = 'block';
        
        // 顯示分頁控制
        document.getElementById('pdf-pagination').style.display = 'flex';
        
        // 渲染第一頁
        renderPage(currentPageNum);
    } catch (error) {
        console.error('Error loading PDF:', error);
        pdfLoading.style.display = 'none';
        pdfError.textContent = `無法載入 PDF。請檢查連結是否有效或稍後再試。`;
        if (error.message) {
            pdfError.textContent += ` (錯誤: ${error.message})`;
        }
        pdfError.style.display = 'block';
        pdfCanvas.style.display = 'none';
    }
}

// 改進 renderPage 函數
function renderPage(num) {
    if (!currentPdfDoc || !pdfCanvas) return;
    pdfPageRendering = true;
    if(pdfPageNum) pdfPageNum.textContent = num;

    // 禁用分頁按鈕
    if(pdfPrevBtn) pdfPrevBtn.disabled = true;
    if(pdfNextBtn) pdfNextBtn.disabled = true;

    currentPdfDoc.getPage(num).then(function(page) {
        console.log(`Rendering page ${num}`);
        
        // 計算適合的縮放比例
        const viewport = page.getViewport({ scale: 1.0 });
        const containerWidth = pdfViewerContainer.clientWidth * 0.9; // 留邊距
        const scale = containerWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale: scale });

        // 設定 canvas 尺寸
        pdfCanvas.height = scaledViewport.height;
        pdfCanvas.width = scaledViewport.width;

        // 渲染 PDF 頁面
        const renderContext = {
            canvasContext: pdfCanvas.getContext('2d'),
            viewport: scaledViewport
        };
        
        const renderTask = page.render(renderContext);
        
        renderTask.promise.then(function() {
            console.log(`Page ${num} rendered`);
            pdfPageRendering = false;
            
            // 更新分頁按鈕狀態
            if(pdfPrevBtn) pdfPrevBtn.disabled = (num <= 1);
            if(pdfNextBtn) pdfNextBtn.disabled = (num >= currentPdfDoc.numPages);
            
            // 處理排隊中的頁面渲染請求
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    }).catch(function(error) {
        console.error(`Error rendering page ${num}:`, error);
        pdfPageRendering = false;
        if(pdfError) {
            pdfError.textContent = `渲染頁面時出錯: ${error.message || error}`;
            pdfError.style.display = 'block';
        }
    });
}


// 將實際的 Canvas 渲染邏輯獨立出來
function renderPageWithViewport(page, viewport, pageNumber) {
    const canvasContext = pdfCanvas.getContext('2d');
    pdfCanvas.height = viewport.height;
    pdfCanvas.width = viewport.width;

    const renderContext = {
        canvasContext: canvasContext,
        viewport: viewport
    };
    const renderTask = page.render(renderContext);

    renderTask.promise.then(function() {
        console.log(`Page ${pageNumber} rendered`);
        pdfPageRendering = false;

        // 更新按鈕狀態
        if(pdfPrevBtn) pdfPrevBtn.disabled = (pageNumber <= 1);
        if(pdfNextBtn && currentPdfDoc) pdfNextBtn.disabled = (pageNumber >= currentPdfDoc.numPages);

        if (pageNumPending !== null) {
            renderPage(pageNumPending);
            pageNumPending = null;
        }
    }).catch(function(renderError) {
        console.error(`Error rendering page ${pageNumber}:`, renderError);
        pdfPageRendering = false;
        if(pdfError) {
            pdfError.textContent = `渲染頁面 ${pageNumber} 時出錯。`;
            pdfError.style.display = 'block';
        }
        // 即使渲染失敗也要嘗試啟用按鈕
        if(pdfPrevBtn) pdfPrevBtn.disabled = (pageNumber <= 1);
        if(pdfNextBtn && currentPdfDoc) pdfNextBtn.disabled = (pageNumber >= currentPdfDoc.numPages);
    });
}


function queueRenderPage(num) {
    if (pdfPageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

// --- 事件處理函數 ---
function handleArtistFilterClick(event) {
    const target = event.target;
    if (target.tagName === 'BUTTON' && target.classList.contains('artist-filter-btn')) {
        if (!artistFilterContainer) return; // 添加防禦性檢查
        artistFilterContainer.querySelectorAll('.artist-filter-btn').forEach(btn => btn.classList.remove('active'));
        target.classList.add('active');
        currentArtist = target.dataset.artist; // 直接使用 data-artist 的值 (可能是 All 或編碼後的)
        fetchSongs(currentArtist); // 傳遞可能是 All 或編碼後的 artist
    }
}

function handleSongListItemClick(event) {
    const listItem = event.target.closest('li[data-song-id]');
    if (listItem) {
        const songId = listItem.dataset.songId;
        if(songId) fetchSongDetail(songId);
    }
}

function handleScoreButtonClick(event) {
    const target = event.target;
    if (target.tagName === 'BUTTON' && target.classList.contains('score-type-btn')) {
        if (!scoreSelectorContainer) return; // 添加防禦性檢查
        scoreSelectorContainer.querySelectorAll('.score-type-btn').forEach(btn => btn.classList.remove('active'));
        target.classList.add('active');
        const encodedPdfUrl = target.dataset.pdfUrl;
        if(encodedPdfUrl) loadPdf(encodedPdfUrl); // 確保 URL 存在
    }
}

function onPrevPage() {
    if (currentPageNum <= 1) { return; }
    currentPageNum--;
    queueRenderPage(currentPageNum);
}

function onNextPage() {
    if (!currentPdfDoc || currentPageNum >= currentPdfDoc.numPages) { return; }
    currentPageNum++;
    queueRenderPage(currentPageNum);
}

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    // 確保所有需要的元素都已加載
    if (!artistFilterContainer || !songList || !scoreSelectorContainer || !pdfPrevBtn || !pdfNextBtn) {
        console.error("頁面初始化失敗：缺少必要的 DOM 元素。");
        return;
    }

    fetchArtists(); // 載入歌手列表
    fetchSongs('All'); // 載入頁面時就獲取所有歌曲

    // --- 事件監聽器綁定 ---
    artistFilterContainer.addEventListener('click', handleArtistFilterClick);
    songList.addEventListener('click', handleSongListItemClick);
    scoreSelectorContainer.addEventListener('click', handleScoreButtonClick);
    pdfPrevBtn.addEventListener('click', onPrevPage);
    pdfNextBtn.addEventListener('click', onNextPage);
});