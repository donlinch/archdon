// 引入 pdf.js 函式庫 (ES Module 方式)
import * as pdfjsLib from '//mozilla.github.io/pdf.js/build/pdf.mjs';

// 設定 PDF.js worker 的來源路徑 (CDN 路徑通常比較穩定)
// 注意：確保瀏覽器可以訪問這個 mjs 文件
// 如果遇到 worker 問題，可能需要將 pdf.worker.mjs 下載到你的 public/ 目錄下並修改路徑
if (typeof pdfjsLib.GlobalWorkerOptions.workerSrc === 'string') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.mjs';
} else {
    console.warn('Cannot set PDF.js workerSrc, default worker might be used.');
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
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`${errorMessage}:`, error);
        throw error; // 重新拋出錯誤以便上層處理
    }
}

async function fetchArtists() {
    try {
        const artists = await fetchApi('/api/scores/artists', 'Error fetching artists');
        renderArtistFilters(artists);
    } catch (error) {
        artistFilterContainer.innerHTML = '<p style="color: red;">無法載入歌手列表。</p>';
    }
}

async function fetchSongs(artist = 'All') {
    songList.innerHTML = '<p>載入歌曲中...</p>'; // 載入提示
    currentSongId = null; // 清除當前選中的歌曲
    songDetailContainer.classList.remove('visible'); // 隱藏詳情區
    try {
        const url = artist === 'All' ? '/api/scores/songs' : `/api/scores/songs?artist=${encodeURIComponent(artist)}`;
        const songs = await fetchApi(url, `Error fetching songs for artist ${artist}`);
        renderSongList(songs);
    } catch (error) {
        songList.innerHTML = '<p style="color: red;">無法載入歌曲列表。</p>';
    }
}

async function fetchSongDetail(songId) {
    if (currentSongId === songId) return; // 避免重複載入同一首歌

    currentSongId = songId;
    songInfo.textContent = '載入歌曲詳情中...';
    youtubePlayerContainer.innerHTML = '';
    scoreSelectorContainer.innerHTML = ''; // 清空樂譜選擇區
    pdfViewerContainer.style.display = 'none'; // 隱藏 PDF 檢視器
    pdfError.style.display = 'none';
    pdfLoading.style.display = 'none';
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
            if (firstScoreButton) {
                firstScoreButton.click(); // 觸發點擊事件來載入 PDF
                firstScoreButton.classList.add('active'); // 手動添加 active class
            }
        } else {
             pdfViewerContainer.style.display = 'none'; // 確保沒有樂譜時隱藏
        }
    } catch (error) {
        songInfo.textContent = '無法載入歌曲詳情。';
        console.error('Song Detail Fetch Error:', error);
    }
}

// --- 渲染函數 ---
function renderArtistFilters(artists) {
    let buttonsHTML = `<button class="artist-filter-btn ${currentArtist === 'All' ? 'active' : ''}" data-artist="All">全部歌手</button>`;
    artists.forEach(artist => {
        const encodedArtist = encodeURIComponent(artist);
        buttonsHTML += `<button class="artist-filter-btn ${currentArtist === encodedArtist ? 'active' : ''}" data-artist="${encodedArtist}">${artist}</button>`;
    });
    artistFilterContainer.innerHTML = buttonsHTML;
}

function renderSongList(songs) {
    if (!songs || songs.length === 0) {
        songList.innerHTML = '<p>此分類下沒有包含樂譜的歌曲。</p>';
        return;
    }
    songList.innerHTML = songs.map(song => `
        <li data-song-id="${song.id}">
            <span class="song-title">${song.title}</span>
            <span class="song-artist">${song.artist}</span>
        </li>
    `).join('');
}

function renderSongDetail(song) {
    songInfo.textContent = `${song.title} - ${song.artist}`;

    // 渲染 YouTube 播放器
    if (song.youtube_video_id) {
        youtubePlayerContainer.innerHTML = `
            <iframe
                src="https://www.youtube.com/embed/${song.youtube_video_id}"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen>
            </iframe>`;
    } else {
        youtubePlayerContainer.innerHTML = '<p>此歌曲沒有可用的 YouTube 影片。</p>';
    }

    // 渲染樂譜選擇器
    if (song.scores && song.scores.length > 0) {
        const scoreButtonsHTML = song.scores.map(score => `
            <button class="action-btn score-type-btn" data-pdf-url="${encodeURIComponent(score.pdf_url)}">
                ${score.type} <!-- 直接顯示資料庫中的 type 字串 -->
            </button>
        `).join('');
        scoreSelectorContainer.innerHTML = `<h3>選擇樂譜類型:</h3> ${scoreButtonsHTML}`;
        // pdfViewerContainer.style.display = 'block'; // 先不要顯示，等點擊按鈕再顯示
    } else {
        scoreSelectorContainer.innerHTML = '<p>此歌曲沒有可用的樂譜。</p>';
        pdfViewerContainer.style.display = 'none'; // 隱藏 PDF 檢視器
    }
}

// --- PDF.js 相關函數 ---
async function loadPdf(pdfUrl) {
    if (!pdfUrl) {
        console.warn('No PDF URL provided to loadPdf');
        pdfViewerContainer.style.display = 'none';
        return;
    }

    pdfLoading.style.display = 'block';
    pdfError.style.display = 'none';
    pdfCanvas.style.display = 'none';
    pdfViewerContainer.style.display = 'block'; // 顯示容器以展示 loading 或 error
    pdfPrevBtn.disabled = true;
    pdfNextBtn.disabled = true;
    pdfPageNum.textContent = '-';
    pdfPageCount.textContent = '-';
    currentPdfDoc = null;
    currentPageNum = 1;

    const proxyUrl = `/api/scores/proxy?url=${pdfUrl}`; // 使用之前傳入的已編碼 URL
    console.log("Requesting PDF via proxy:", proxyUrl);

    try {
        // 使用 pdfjsLib 非同步載入 PDF 文件
        const loadingTask = pdfjsLib.getDocument(proxyUrl);
        currentPdfDoc = await loadingTask.promise;
        console.log('PDF loaded successfully. Pages:', currentPdfDoc.numPages);
        pdfLoading.style.display = 'none';
        pdfPageCount.textContent = currentPdfDoc.numPages; // 更新總頁數
        pdfCanvas.style.display = 'block'; // 顯示 canvas

        // 初始渲染第一頁
        renderPage(currentPageNum);
    } catch (reason) {
        console.error('Error loading PDF:', reason);
        pdfLoading.style.display = 'none';
        pdfError.textContent = `無法載入 PDF: ${reason.message || reason}`;
        pdfError.style.display = 'block';
        pdfCanvas.style.display = 'none';
    }
}

function renderPage(num) {
    if (!currentPdfDoc) return; // 確保 PDF 已載入
    pdfPageRendering = true;
    pdfPageNum.textContent = num; // 更新當前頁碼顯示

    // 在渲染時禁用按鈕
    pdfPrevBtn.disabled = true;
    pdfNextBtn.disabled = true;

    // 使用 Promise 獲取頁面
    currentPdfDoc.getPage(num).then(function(page) {
        console.log(`Rendering page ${num}`);
        const desiredWidth = pdfViewerContainer.clientWidth * 0.95; // 基於容器寬度計算期望寬度
        const viewportOriginal = page.getViewport({ scale: 1 });
        const scale = desiredWidth / viewportOriginal.width;
        const viewport = page.getViewport({ scale: scale });

        const canvasContext = pdfCanvas.getContext('2d');
        pdfCanvas.height = viewport.height;
        pdfCanvas.width = viewport.width;

        // 將 PDF 頁面渲染到畫布上下文中
        const renderContext = {
            canvasContext: canvasContext,
            viewport: viewport
        };
        const renderTask = page.render(renderContext);

        // 等待渲染完成
        renderTask.promise.then(function() {
            console.log(`Page ${num} rendered`);
            pdfPageRendering = false;

            // 更新按鈕狀態
            pdfPrevBtn.disabled = (num <= 1);
            pdfNextBtn.disabled = (num >= currentPdfDoc.numPages);

            // 如果有待處理的頁面渲染請求，執行它
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        }).catch(function(renderError) {
            console.error(`Error rendering page ${num}:`, renderError);
            pdfPageRendering = false;
             pdfError.textContent = `渲染頁面 ${num} 時出錯。`;
             pdfError.style.display = 'block';
             // 即使渲染失敗也要嘗試啟用按鈕
             pdfPrevBtn.disabled = (num <= 1);
             pdfNextBtn.disabled = (num >= currentPdfDoc.numPages);
        });
    }).catch(function(pageError){
         console.error(`Error getting page ${num}:`, pageError);
         pdfPageRendering = false; // 重置狀態
         pdfError.textContent = `獲取頁面 ${num} 時出錯。`;
         pdfError.style.display = 'block';
    });
}

// 如果正在渲染，將請求排隊；否則直接渲染
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
        // 移除所有按鈕的 active class
        artistFilterContainer.querySelectorAll('.artist-filter-btn').forEach(btn => btn.classList.remove('active'));
        // 為被點擊的按鈕添加 active class
        target.classList.add('active');

        currentArtist = target.dataset.artist;
        fetchSongs(currentArtist === 'All' ? undefined : decodeURIComponent(currentArtist));
    }
}

function handleSongListItemClick(event) {
    const listItem = event.target.closest('li[data-song-id]');
    if (listItem) {
        const songId = listItem.dataset.songId;
        fetchSongDetail(songId);
    }
}

function handleScoreButtonClick(event) {
    const target = event.target;
    if (target.tagName === 'BUTTON' && target.classList.contains('score-type-btn')) {
        // 移除所有樂譜按鈕的 active class
        scoreSelectorContainer.querySelectorAll('.score-type-btn').forEach(btn => btn.classList.remove('active'));
        // 為被點擊的按鈕添加 active class
        target.classList.add('active');

        const encodedPdfUrl = target.dataset.pdfUrl;
        loadPdf(encodedPdfUrl); // 直接傳遞編碼後的 URL
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
    fetchArtists(); // 先載入歌手列表
    // fetchSongs(); // 移除這裡的調用，讓使用者先選擇歌手

    // --- 事件監聽器綁定 ---
    artistFilterContainer.addEventListener('click', handleArtistFilterClick);
    songList.addEventListener('click', handleSongListItemClick);
    scoreSelectorContainer.addEventListener('click', handleScoreButtonClick);
    pdfPrevBtn.addEventListener('click', onPrevPage);
    pdfNextBtn.addEventListener('click', onNextPage);
});