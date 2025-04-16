const container = document.getElementById('game-container');
const board = document.getElementById('game-board');
const editorPanel = document.getElementById('editor-panel');
const titleInput = document.getElementById('edit-title');
const descInput = document.getElementById('edit-description');
const colorInput = document.getElementById('edit-color');
const imageInput = document.getElementById('edit-image');

let editingIndex = -1;
let cells = [];
let currentTemplateId = 1;
let backgroundColor = '#fff0f5';

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

// 打開編輯器
function openEditor(index) {
  editingIndex = index;
  const cell = cells[index];
  titleInput.value = cell.title;
  descInput.value = cell.description;
  colorInput.value = cell.color;
  imageInput.value = cell.image_url || '';
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
    .then(res => res.json())
    .then(data => {
      applyTemplateBackgroundColor(data.background_color);
      cells = data.cells;
      renderBoard();
    })
    .catch(err => {
      console.error('❌ 載入模板失敗:', err);
      alert('無法載入模板資料，請確認後端 API 有開！');
    });
}

// 儲存整份資料（背景顏色＋格子資料）
function saveAllChanges() {
  const body = JSON.stringify({
    background_color: backgroundColor,
    cells
  });

  fetch(`/api/rich-map/templates/${currentTemplateId}/full`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body
  })
    .then(res => {
      if (res.ok) {
        alert('✅ 儲存成功！');
      } else {
        throw new Error('伺服器錯誤');
      }
    })
    .catch(err => {
      console.error('❌ 儲存失敗:', err);
      alert('儲存失敗，請檢查後端連線');
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
