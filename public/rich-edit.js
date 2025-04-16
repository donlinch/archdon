const container = document.getElementById('game-container');
const board = document.getElementById('game-board');
const editorPanel = document.getElementById('editor-panel');
const titleInput = document.getElementById('edit-title');
const descInput = document.getElementById('edit-description');
const colorInput = document.getElementById('edit-color');
const imageInput = document.getElementById('edit-image');


// ▼▼▼ 新增獲取 Logo 元素 ▼▼▼
const logoUrlInput = document.getElementById('edit-logo-url');
const logoPreview = document.getElementById('logo-preview');
// ▲▲▲ 新增獲取 Logo 元素 ▲▲▲



let editingIndex = -1;
let cells = [];
let currentTemplateId = 1;
let backgroundColor = '#fff0f5';
// ▼▼▼ 新增全域變數儲存 Logo URL ▼▼▼
let currentLogoUrl = '';
// ▲▲▲ 新增全域變數儲存 Logo URL ▲▲▲

// 套用背景顏色
function applyTemplateBackgroundColor(color) {
  backgroundColor = color || '#fff0f5';
  container.style.backgroundColor = backgroundColor;
}






// 渲染地圖格子
function renderBoard() {
  board.innerHTML = '';
  cells.forEach((cell, i) => {
    const div = document.createElement('div');
    div.className = 'cell';
    div.style.left = `${cell.x * 125}px`;
    div.style.top = `${cell.y * 100}px`;
    div.style.backgroundColor = cell.color;

    if (cell.image_url) {
      const img = document.createElement('img');
      img.src = cell.image_url;
      img.alt = cell.title;
      div.appendChild(img);
    }

    const titleDiv = document.createElement('div');
    titleDiv.textContent = cell.title;
    div.appendChild(titleDiv);

    const descDiv = document.createElement('div');
    descDiv.style.fontSize = '0.7rem';
    descDiv.style.lineHeight = '1.2';
    descDiv.textContent = cell.description;
    div.appendChild(descDiv);

    div.onclick = () => openEditor(i);
    board.appendChild(div);
  });
}





// --- 面板內圖片上傳邏輯 ---
const panelImageFile = document.getElementById('panel-image-file');
const uploadPanelImageBtn = document.getElementById('upload-panel-image-btn');

uploadPanelImageBtn.addEventListener('click', () => {
  if (panelImageFile.files.length > 0) {
    const file = panelImageFile.files[0];
    // 呼叫你已經寫好的 uploadImage 函數
    uploadImage(file, (uploadedUrl) => {
      if (uploadedUrl) {
        // 上傳成功後，更新 URL 輸入框和預覽圖
        imageInput.value = uploadedUrl;
        document.getElementById('preview-image').src = uploadedUrl;
        alert('圖片上傳成功！URL 已填入。');
      } else {
        alert('圖片上傳失敗，請檢查後端或網路連線。');
      }
    });
  } else {
    alert('請先選擇要上傳的圖片檔案。');
  }
});




// 打開編輯器
function openEditor(index) {
  editingIndex = index;
  const cell = cells[index];
  titleInput.value = cell.title;
  descInput.value = cell.description;
  colorInput.value = cell.color;
  imageInput.value = cell.image_url || '';
  document.getElementById('preview-image').src = cell.image_url || ''; // 如果沒有圖片URL，設為空字串
  editorPanel.style.display = 'flex';
}

// 儲存單一格子編輯
function saveCellChanges() {
  const cell = cells[editingIndex];
  cell.title = titleInput.value;
  cell.description = descInput.value;
  cell.color = colorInput.value;
  cell.image_url = imageInput.value;
  renderBoard();
  editorPanel.style.display = 'none';
}
// 載入資料庫中的模板資料
function loadTemplate(templateId = 1) {
    currentTemplateId = templateId;
    fetch(`/api/rich-map/templates/${templateId}/full`)
      .then(res => {
          // ▼▼▼ 檢查回應是否 OK ▼▼▼
          if (!res.ok) {
              // 如果 fetch 成功但伺服器回傳錯誤 (例如 404, 500)
              return res.json().then(errData => { // 嘗試解析錯誤訊息
                 throw new Error(`伺服器錯誤 ${res.status}: ${errData.error || res.statusText}`);
              }).catch(() => { // 如果連錯誤訊息都無法解析
                  throw new Error(`伺服器錯誤 ${res.status}: ${res.statusText}`);
              });
          }
          return res.json(); // 如果 OK，解析正常的回應
          // ▲▲▲ 檢查回應是否 OK ▲▲▲
      })
      .then(data => {
        applyTemplateBackgroundColor(data.background_color);
        cells = data.cells || []; // 確保 cells 是陣列
        // ▼▼▼ 設定 Logo URL 和預覽 ▼▼▼
        currentLogoUrl = data.logo_url || '';
        logoUrlInput.value = currentLogoUrl;
        logoPreview.src = currentLogoUrl;
        // ▲▲▲ 設定 Logo URL 和預覽 ▲▲▲
        renderBoard();
      })
      .catch(err => {
        console.error('❌ 載入模板失敗:', err);
        // 顯示更詳細的錯誤給使用者
        alert(`無法載入模板資料：\n${err.message}\n請檢查後端 API 是否正常運作，以及模板 ID 是否存在。`);
        // 清空畫面或顯示錯誤提示
        board.innerHTML = '<p style="color: red; text-align: center;">載入地圖失敗</p>';
        cells = [];
        currentLogoUrl = '';
        logoUrlInput.value = '';
        logoPreview.src = '';
      });
  }
  // 儲存整份資料（背景顏色＋格子資料 + Logo URL）
  function saveAllChanges() {
    console.log("準備儲存:", { backgroundColor, currentLogoUrl, cells }); // 增加日誌，方便除錯
    const body = JSON.stringify({
      background_color: backgroundColor,
      logo_url: currentLogoUrl, // <-- 加入 logo_url
      cells
    });
  
    fetch(`/api/rich-map/templates/${currentTemplateId}/full`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body
    })
      .then(res => {
        if (res.ok) {
          return res.json(); // <-- 如果成功，解析可能的成功訊息
        } else {
          // 如果失敗，嘗試解析錯誤訊息再拋出
          return res.json().then(errData => {
              throw new Error(`伺服器錯誤 ${res.status}: ${errData.error || '未知錯誤'}`);
          }).catch(() => { // 如果連錯誤 JSON 都解析不了
              throw new Error(`伺服器錯誤 ${res.status}`);
          });
        }
      })
      .then(data => { // <-- 處理成功的回應
          console.log("儲存成功回應:", data);
          alert(`✅ 儲存成功！ (${data.message || ''})`);
      })
      .catch(err => {
        console.error('❌ 儲存失敗:', err);
        alert(`儲存失敗：\n${err.message}\n請檢查後端連線及伺服器日誌。`);
      });
  }
  
// 加入一顆儲存按鈕（你可以改成 UI 按鈕呼叫）
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    saveAllChanges();
  }
});



// ✦ 讓面板可拖曳
const dragPanel = document.getElementById('editor-panel');
const header = dragPanel.querySelector('.editor-header');

let isDragging = false;
let offsetX, offsetY;

header.addEventListener('mousedown', e => {
  isDragging = true;
  offsetX = e.clientX - dragPanel.offsetLeft;
  offsetY = e.clientY - dragPanel.offsetTop;
});

document.addEventListener('mouseup', () => {
  isDragging = false;
});

document.addEventListener('mousemove', e => {
  if (isDragging) {
    dragPanel.style.left = `${e.clientX - offsetX}px`;
    dragPanel.style.top = `${e.clientY - offsetY}px`;
    dragPanel.style.transform = 'translate(0, 0)'; // 拖移後取消置中位移
  }
});


/* 
const imageFileInput = document.getElementById('edit-image-file');
imageFileInput.addEventListener('change', () => {
  const file = imageFileInput.files[0];
  if (file) {
    uploadImage(file, url => {
      imageInput.value = url;
      document.getElementById('preview-image').src = url;

    });
  }
});

*/

function uploadImage(file, callback) {
    const formData = new FormData();
    formData.append('image', file);
  
    fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        callback(data.url); // 成功回傳圖片 URL
      })
      .catch(err => {
        alert('❌ 圖片上傳失敗');
        console.error(err);
      });
  }
  



// 初始化
loadTemplate();
