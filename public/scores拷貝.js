// scores.js - 樂譜與舞蹈頁面 JavaScript 代碼

// 引入 pdf.js 函式庫 (ES Module 方式)
import * as pdfjsLib from '//mozilla.github.io/pdf.js/build/pdf.mjs';

// --- *** 將 allSongsData 宣告移到最前面 *** ---
let allSongsData = [];

// 設定 PDF.js worker 的來源路徑
if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.mjs';
        console.log('PDF.js workerSrc 設定完成。');
    } catch (e) {
        console.warn('無法設定 PDF.js workerSrc:', e);
    }
} else {
    console.warn('PDF.js GlobalWorkerOptions 無法設定。');
}

// --- DOM 元素獲取 ---
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Error: Element with ID "${id}" not found.`);
    }
    return element;
}

const artistFilterContainer = getElement('artist-filter');
const songList = getElement('song-list');
const songDetailContainer = getElement('song-detail-container');
const songInfo = getElement('song-info');
const youtubePlayerContainer = getElement('youtube-player');
const scoreSelectorContainer = getElement('score-selector');
const pdfViewerContainer = getElement('pdf-viewer-container');
const pdfCanvas = getElement('pdf-canvas');
const pdfLoading = getElement('pdf-loading');
const pdfError = getElement('pdf-error');
const pdfPrevBtn = getElement('pdf-prev');
const pdfNextBtn = getElement('pdf-next');
const pdfPageNum = getElement('pdf-page-num');
const pdfPageCount = getElement('pdf-page-count');
const pdfPagination = getElement('pdf-pagination');
const backToTopButton = getElement('back-to-top');

// --- 狀態變數 ---
let currentPdfDoc = null;
let currentPageNum = 1;
let currentSongId = null;
let currentArtist = 'All'; // 預設顯示全部
let pdfPageRendering = false;
let pageNumPending = null;

// --- API 請求函數 ---
async function fetchApi(url, errorMessage) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            let errorDetails = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorDetails += `, message: ${errorData.error || response.statusText}`;
            } catch (parseError) {
                errorDetails += `, message: ${response.statusText}`;
            }
            throw new Error(errorDetails);
        }
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            return await response.json();
        } else {
            console.warn(`API ${url} did not return JSON. Content-Type: ${contentType}`);
            return {}; // 返回空物件
        }
    } catch (error) {
        console.error(`${errorMessage}:`, error);
        throw error;
    }
}

async function fetchArtists() {
    if (!artistFilterContainer) return;
    artistFilterContainer.innerHTML = '<p>載入歌手中...</p>';
    try {
        const artists = await fetchApi('/api/scores/artists', 'Error fetching artists');
        renderArtistFilters(artists);
    } catch (error) {
        artistFilterContainer.innerHTML = '<p style="color: red;">無法載入歌手列表。</p>';
    }
}

// --- 獲取歌曲列表函數 ---
async function fetchSongs(artist = 'All') {
    if (!songList) return;
    songList.innerHTML = '<p class="loading-message">載入歌曲中...</p>';
    currentSongId = null;
    
    if (songDetailContainer) {
        songDetailContainer.classList.remove('visible');
        setTimeout(() => {
            songDetailContainer.style.display = 'none';
        }, 300);
    }
    
    try {
        const decodedArtist = decodeURIComponent(artist);
        const url = decodedArtist === 'All' ? '/api/scores/songs' : `/api/scores/songs?artist=${artist}`;
        allSongsData = await fetchApi(url, `Error fetching songs for artist ${decodedArtist}`);
        renderSongList(allSongsData);
    } catch (error) {
        songList.innerHTML = '<p class="error-message">無法載入歌曲列表。</p>';
        allSongsData = []; // 出錯時清空
    }
}

// --- 渲染歌手過濾器 ---
function renderArtistFilters(artists) {
    if (!artistFilterContainer) return;
    const decodedCurrentArtist = decodeURIComponent(currentArtist);
    
    let buttonsHTML = `<button class="artist-filter-btn ${decodedCurrentArtist === 'All' ? 'active' : ''}" data-artist="All">全部歌手</button>`;
    
    artists.forEach((artist, index) => {
        const encodedArtist = encodeURIComponent(artist);
        buttonsHTML += `<button class="artist-filter-btn ${decodedCurrentArtist === artist ? 'active' : ''}" 
                               data-artist="${encodedArtist}">${artist}</button>`;
    });
    
    artistFilterContainer.innerHTML = buttonsHTML;
    
    // 添加動畫效果
    const buttons = artistFilterContainer.querySelectorAll('button');
    buttons.forEach((button, index) => {
        button.style.opacity = '0';
        button.style.transform = 'translateY(10px)';
        setTimeout(() => {
            button.style.transition = 'all 0.3s';
            button.style.opacity = '1';
            button.style.transform = 'translateY(0)';
        }, 50 * index);
    });
}

// --- 渲染歌曲列表 ---
function renderSongList(songs) {
    if (!songList) return;
    if (!songs || !Array.isArray(songs) || songs.length === 0) {
        songList.innerHTML = '<p>此分類下沒有包含樂譜的歌曲。</p>';
        return;
    }
    
    songList.innerHTML = '';
    
    songs.forEach((song, index) => {
        // 創建歌曲列表項目
        const li = document.createElement('li');
        li.dataset.songId = song.id;
        li.dataset.itemIndex = index;
        li.style.setProperty('--item-index', index);
        
        if (currentSongId !== null && currentSongId === song.id) {
            li.classList.add('active');
        }
        
        // 創建歌曲資訊容器
        const infoDiv = document.createElement('div');
        infoDiv.className = 'song-list-info';
        
        // 添加歌曲標題
        const titleSpan = document.createElement('span');
        titleSpan.className = 'song-title';
        titleSpan.textContent = song.title || '未知標題';
        
        // 添加歌手名稱
        const artistSpan = document.createElement('span');
        artistSpan.className = 'song-artist';
        artistSpan.textContent = song.artist || '未知歌手';
        
        // 創建樂譜按鈕容器
        const scoresDiv = document.createElement('div');
        scoresDiv.className = 'song-list-scores';
        
        // 添加樂譜按鈕
        if (song.scores && Array.isArray(song.scores) && song.scores.length > 0) {
            song.scores
                .filter(score => score.type && score.pdf_url && score.id)
                .forEach(score => {
                    const button = document.createElement('button');
                    button.className = 'score-type-btn list-score-btn';
                    button.dataset.songId = song.id;
                    button.dataset.scoreId = score.id;
                    button.dataset.pdfUrl = encodeURIComponent(score.pdf_url);
                    button.title = `查看 ${song.title} - ${score.type}`;
                    button.textContent = score.type;
                    
                    // 添加點擊事件
                    button.addEventListener('click', function(e) {
                        e.stopPropagation();
                        const songId = this.dataset.songId;
                        const scoreId = this.dataset.scoreId;
                        
                        if (songId && scoreId) {
                            console.log(`偵測到點擊，跳轉至: /score-viewer.html?musicId=${songId}&scoreId=${scoreId}`);
                            window.location.href = `/score-viewer.html?musicId=${songId}&scoreId=${scoreId}`;
                        } else {
                            console.warn('無法處理樂譜按鈕點擊：缺少 songId 或 scoreId。');
                            alert('無法打開樂譜，按鈕數據不完整。');
                        }
                    });
                    
                    scoresDiv.appendChild(button);
                });
        }
        
        // 組合歌曲列表項目
        infoDiv.appendChild(titleSpan);
        infoDiv.appendChild(artistSpan);
        infoDiv.appendChild(scoresDiv);
        li.appendChild(infoDiv);
        
        // 添加點擊事件 (點擊歌曲顯示詳情)
        li.addEventListener('click', function(e) {
            // 如果點擊的是按鈕，讓按鈕的事件處理器處理
            if (e.target.classList.contains('score-type-btn')) {
                return;
            }
            
            const songId = this.dataset.songId;
            if (!songId) return;
            
            // 移除其他歌曲的選中狀態
            document.querySelectorAll('#song-list li').forEach(item => {
                item.classList.remove('active');
            });
            
            // 添加當前歌曲的選中狀態
            this.classList.add('active');
            
            // 設定當前歌曲 ID
            currentSongId = songId;
            
            // 查找並顯示歌曲詳情
            const song = allSongsData.find(s => s.id === songId);
            if (song) {
                renderSongDetail(song);
            }
        });
        
        // 添加到歌曲列表中
        songList.appendChild(li);
    });
}

// --- 渲染歌曲詳情 ---
function renderSongDetail(song) {
    if (!songInfo || !youtubePlayerContainer || !songDetailContainer) return;

    // 重置/隱藏 PDF 查看器元素
    if (pdfViewerContainer) pdfViewerContainer.style.display = 'none';
    if (pdfCanvas) pdfCanvas.style.display = 'none';
    if (pdfPagination) pdfPagination.style.display = 'none';
    if (pdfLoading) pdfLoading.style.display = 'none';
    if (pdfError) pdfError.style.display = 'none';
    currentPdfDoc = null;

    // 清空樂譜選擇器
    if (scoreSelectorContainer) {
        scoreSelectorContainer.innerHTML = '<h3>選擇樂譜類型:</h3>';
        
        // 如果有樂譜，添加樂譜類型按鈕
        if (song.scores && Array.isArray(song.scores) && song.scores.length > 0) {
            const scoreButtonsContainer = document.createElement('div');
            scoreButtonsContainer.className = 'song-list-scores';
            
            song.scores
                .filter(score => score.type && score.pdf_url && score.id)
                .forEach(score => {
                    const button = document.createElement('button');
                    button.className = 'score-type-btn';
                    button.dataset.songId = song.id;
                    button.dataset.scoreId = score.id;
                    button.dataset.pdfUrl = encodeURIComponent(score.pdf_url);
                    button.title = `查看 ${song.title} - ${score.type}`;
                    button.textContent = score.type;
                    
                    // 添加點擊事件
                    button.addEventListener('click', function(e) {
                        e.stopPropagation();
                        const songId = this.dataset.songId;
                        const scoreId = this.dataset.scoreId;
                        
                        if (songId && scoreId) {
                            console.log(`偵測到點擊，跳轉至: /score-viewer.html?musicId=${songId}&scoreId=${scoreId}`);
                            window.location.href = `/score-viewer.html?musicId=${songId}&scoreId=${scoreId}`;
                        } else {
                            console.warn('無法處理樂譜按鈕點擊：缺少 songId 或 scoreId。');
                            alert('無法打開樂譜，按鈕數據不完整。');
                        }
                    });
                    
                    scoreButtonsContainer.appendChild(button);
                });
                
            scoreSelectorContainer.appendChild(scoreButtonsContainer);
        } else {
            const noScoresMsg = document.createElement('p');
            noScoresMsg.textContent = '此歌曲暫無可用樂譜。';
            scoreSelectorContainer.appendChild(noScoresMsg);
        }
    }

    // 設置歌曲標題和歌手
    songInfo.textContent = `${song.title || '未知標題'} - ${song.artist || '未知歌手'}`;

    // 設置 YouTube 播放器
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
        youtubePlayerContainer.style.display = 'block';
    } else {
        youtubePlayerContainer.innerHTML = '<p>此歌曲沒有可用的 YouTube 影片。</p>';
        youtubePlayerContainer.style.display = 'block';
    }

    // 顯示歌曲詳情容器
    songDetailContainer.style.display = 'flex';
    // 延遲添加可見類以觸發動畫效果
    setTimeout(() => {
        songDetailContainer.classList.add('visible');
    }, 10);
}

// --- PDF.js 相關函數 ---
async function loadPdf(encodedPdfUrl) {
    if (!encodedPdfUrl || typeof encodedPdfUrl !== 'string') {
        console.warn('loadPdf: 沒有提供 PDF URL 或格式無效。');
        if(pdfViewerContainer) pdfViewerContainer.style.display = 'none';
        return;
    }
    const requiredElements = [pdfLoading, pdfError, pdfCanvas, pdfViewerContainer, pdfPagination, pdfPrevBtn, pdfNextBtn, pdfPageNum, pdfPageCount];
    if (requiredElements.some(el => !el)) {
        console.error("loadPdf: PDF 檢視器 DOM 元素缺失。");
        return;
    }

    console.log("loadPdf: 開始載入 PDF...");
    pdfLoading.style.display = 'block';
    pdfError.style.display = 'none';
    pdfCanvas.style.display = 'none'; // 初始隱藏 Canvas
    pdfPagination.style.display = 'none'; // 初始隱藏分頁控制
    // 確保 PDF 查看器容器可見
    pdfViewerContainer.style.display = 'flex';
    pdfViewerContainer.style.flexDirection = 'column'; // 垂直排列 Canvas 和分頁

    pdfPrevBtn.disabled = true;
    pdfNextBtn.disabled = true;
    pdfPageNum.textContent = '-';
    pdfPageCount.textContent = '-';
    currentPdfDoc = null;
    currentPageNum = 1;

    const proxyUrl = `/api/scores/proxy?url=${encodedPdfUrl}`;
    console.log("loadPdf: 透過代理請求 PDF:", proxyUrl);

    try {
        const loadingTask = pdfjsLib.getDocument({
            url: proxyUrl,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
        });
        currentPdfDoc = await loadingTask.promise;
        console.log('loadPdf: PDF 載入成功. 頁數:', currentPdfDoc.numPages);
        pdfLoading.style.display = 'none';
        pdfPageCount.textContent = currentPdfDoc.numPages;
        renderPage(currentPageNum);
    } catch (reason) {
        console.error('loadPdf: 載入 PDF 時出錯:', reason);
        pdfLoading.style.display = 'none';
        pdfError.textContent = `無法載入 PDF。請檢查連結是否有效或稍後再試。`;
        if (reason && reason.message) pdfError.textContent += ` (錯誤: ${reason.message})`;
        else if (typeof reason === 'string') pdfError.textContent += ` (${reason})`;
        pdfError.style.display = 'block';
        pdfCanvas.style.display = 'none';
        pdfPagination.style.display = 'none';
    }
}

function renderPage(num) {
    if (!currentPdfDoc || !pdfCanvas || !pdfViewerContainer || !pdfPageNum || !pdfPrevBtn || !pdfNextBtn) {
        console.error("renderPage: 無法渲染頁面：缺少 PDF 文件物件或必要的 DOM 元素。");
        return;
    }
    pdfPageRendering = true;
    pdfPageNum.textContent = num;

    pdfPrevBtn.disabled = true;
    pdfNextBtn.disabled = true;

    // 使用 getPage promise
    currentPdfDoc.getPage(num).then(function(page) {
        console.log(`[renderPage] 獲取到頁面 ${num} 物件，準備渲染。`);

        // 使用 requestAnimationFrame 來延遲稍微讀取寬度
        requestAnimationFrame(() => {
             // 確保容器可見
            if (window.getComputedStyle(pdfViewerContainer).display === 'none') {
                 console.warn("[renderPage] pdfViewerContainer 在計算寬度前是 display:none，強制設為 flex。");
                 pdfViewerContainer.style.display = 'flex';
                 pdfViewerContainer.style.flexDirection = 'column';
            }

            // 計算容器寬度
            let desiredWidth = pdfViewerContainer.clientWidth * 0.95; // 容器寬度的 95%
            if (desiredWidth <= 0) {
                console.warn(`[renderPage] PDF 檢視器容器寬度 (${pdfViewerContainer.clientWidth}) 無效，使用後備寬度 600px。`);
                desiredWidth = 600; // 後備寬度
            }
            console.log(`[renderPage] 計算得到的 desiredWidth: ${desiredWidth}`);

            const viewportOriginal = page.getViewport({ scale: 1 });
            // 防止除以零或負數寬度
            const scale = (viewportOriginal.width > 0 && desiredWidth > 0) ? desiredWidth / viewportOriginal.width : 1;
            const viewport = page.getViewport({ scale: scale });
            console.log(`[renderPage] 計算得到的 scale: ${scale}, viewport width: ${viewport.width}, height: ${viewport.height}`);

            renderPageWithViewport(page, viewport, num);
        });

    }).catch(function(pageError){
         console.error(`[renderPage] 獲取頁面 ${num} 時出錯:`, pageError);
         pdfPageRendering = false;
         if(pdfError) {
             pdfError.textContent = `獲取頁面 ${num} 時出錯。`;
             pdfError.style.display = 'block';
         }
         if(pdfCanvas) pdfCanvas.style.display = 'none';
         if(pdfPagination) pdfPagination.style.display = 'none';
         if(pdfPrevBtn) pdfPrevBtn.disabled = (num <= 1);
         if(pdfNextBtn && currentPdfDoc) pdfNextBtn.disabled = (num >= currentPdfDoc.numPages);
    });
}

function renderPageWithViewport(page, viewport, pageNumber) {
    if (!pdfCanvas || !pdfError || !pdfPrevBtn || !pdfNextBtn || !pdfViewerContainer || !pdfPagination) {
        console.error("[renderPageWithViewport] 渲染頁面時缺少必要的 Canvas 或控制按鈕或容器或分頁。");
        pdfPageRendering = false;
        return;
    }
    const canvasContext = pdfCanvas.getContext('2d');
    if (!canvasContext) {
         console.error("[renderPageWithViewport] 無法獲取 Canvas 2D 上下文。");
         pdfPageRendering = false;
         if (pdfError) {
            pdfError.textContent = '無法渲染 PDF (Canvas Context Error)。';
            pdfError.style.display = 'block';
         }
         pdfViewerContainer.style.display = 'flex'; // 保持容器可見
         pdfCanvas.style.display = 'none';
         pdfPagination.style.display = 'none';
         if(pdfPrevBtn) pdfPrevBtn.disabled = (pageNumber <= 1);
         if(currentPdfDoc && pdfNextBtn) pdfNextBtn.disabled = (pageNumber >= currentPdfDoc.numPages);
         return;
    }

    // 確保元素在繪製前可見
    pdfCanvas.style.display = 'block';
    pdfViewerContainer.style.display = 'flex';
    pdfViewerContainer.style.flexDirection = 'column';
    pdfPagination.style.display = 'flex';
    pdfError.style.display = 'none';

    // 使用 Math.ceil 避免小數像素
    pdfCanvas.height = Math.ceil(viewport.height);
    pdfCanvas.width = Math.ceil(viewport.width);
    console.log(`[renderPageWithViewport] Setting canvas display: block, dimensions: W=${pdfCanvas.width}, H=${pdfCanvas.height}`);

    // 設置畫布樣式尺寸，防止潛在的 CSS 覆蓋問題
    pdfCanvas.style.width = `${pdfCanvas.width}px`;
    pdfCanvas.style.height = `${pdfCanvas.height}px`;

    const renderContext = {
        canvasContext: canvasContext,
        viewport: viewport
    };
    const renderTask = page.render(renderContext);

    renderTask.promise.then(function() {
        console.log(`[renderPageWithViewport] 頁面 ${pageNumber} 渲染完成`);
        pdfPageRendering = false;
        if(pdfPrevBtn) pdfPrevBtn.disabled = (pageNumber <= 1);
        if(currentPdfDoc && pdfNextBtn) pdfNextBtn.disabled = (pageNumber >= currentPdfDoc.numPages);
        if (pageNumPending !== null) {
            console.log(`[renderPageWithViewport] 處理待定頁面: ${pageNumPending}`);
            renderPage(pageNumPending);
            pageNumPending = null;
        }
    }).catch(function(renderError) {
        console.error(`[renderPageWithViewport] 渲染頁面 ${pageNumber} 時出錯:`, renderError);
        pdfPageRendering = false;
        if (pdfError) {
            pdfError.textContent = `渲染頁面 ${pageNumber} 時出錯。`;
            pdfError.style.display = 'block';
        }
         pdfCanvas.style.display = 'none';
         pdfPagination.style.display = 'none';
        if(pdfPrevBtn) pdfPrevBtn.disabled = (pageNumber <= 1);
        if(currentPdfDoc && pdfNextBtn) pdfNextBtn.disabled = (pageNumber >= currentPdfDoc.numPages);
    });
}

function queueRenderPage(num) {
    if (pdfPageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

// --- 設置返回頂部按鈕 ---
function setupBackToTop() {
    if (!backToTopButton) return;
    
    // 監聽滾動事件
    window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
    });
    
    // 點擊返回頂部
    backToTopButton.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// --- 事件處理函數 ---
function handleArtistFilterClick(event) {
    const target = event.target;
    if (target && target.tagName === 'BUTTON' && target.classList.contains('artist-filter-btn')) {
        if (!artistFilterContainer) return;
        
        artistFilterContainer.querySelectorAll('.artist-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        target.classList.add('active');
        currentArtist = target.dataset.artist;
        fetchSongs(currentArtist);
    }
}

function onPrevPage() {
    if (currentPageNum <= 1) return;
    currentPageNum--;
    queueRenderPage(currentPageNum);
}

function onNextPage() {
    if (!currentPdfDoc || currentPageNum >= currentPdfDoc.numPages) return;
    currentPageNum++;
    queueRenderPage(currentPageNum);
}

// --- 檢測設備類型 ---
function detectDevice() {
    const isMobile = window.innerWidth <= 767;
    document.body.classList.toggle('is-mobile', isMobile);
}

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    const essentialElements = [artistFilterContainer, songList, songDetailContainer, songInfo, youtubePlayerContainer]; 
    if (essentialElements.some(el => !el)) {
        console.error("頁面初始化失敗：缺少必要的 DOM 元素。請檢查 HTML 結構和 ID 是否正確。");
        if(document.body) document.body.innerHTML = '<p style="color:red; padding: 2rem; text-align: center;">頁面載入錯誤，缺少必要的元件。</p>';
        return;
    }

    // 初始化各功能
    fetchArtists();
    fetchSongs('All'); // 預設載入所有歌曲
    setupBackToTop();
    detectDevice(); // 檢測設備類型

    // --- 事件監聽器綁定 ---
    artistFilterContainer.addEventListener('click', handleArtistFilterClick);
    if(pdfPrevBtn) pdfPrevBtn.addEventListener('click', onPrevPage);
    if(pdfNextBtn) pdfNextBtn.addEventListener('click', onNextPage);
    
    // 監聽窗口尺寸變化
    window.addEventListener('resize', detectDevice);

    // 初始隱藏詳情容器
    if(songDetailContainer) {
        songDetailContainer.classList.remove('visible');
        songDetailContainer.style.display = 'none';
    }
});