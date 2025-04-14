document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('wheel');
    const ctx = canvas.getContext('2d');
    const spinBtn = document.getElementById('spin');
    const resultElement = document.getElementById('result');
     const optionsModal = document.getElementById('optionsModal');
    const closeModal = document.querySelector('.close');
    const saveOptionsBtn = document.getElementById('saveOptions');
    const addOptionBtn = document.getElementById('addOption');
    const optionsContainer = document.getElementById('optionsContainer');



// 在現有的全局變數下方添加這些新變數
const gameFooter = document.getElementById('gameFooter');
const currentThemeEl = document.getElementById('currentTheme');
const themeSelect = document.getElementById('themeSelect');
const exportJSONBtn = document.getElementById('exportJSONBtn');
const importJSONBtn = document.getElementById('importJSONBtn');
const jsonFileInput = document.getElementById('jsonFileInput');

let currentThemeName = '未命名';  // 當前主題名稱
let currentThemeId = null;        // 當前主題ID






    // 导航栏控制
    const navToggle = document.getElementById('navToggle');
    const gameHeader = document.getElementById('gameHeader');
    let navVisible = false;

   // 修改現有的導航切換代碼
   navToggle.addEventListener('click', function() {
    navVisible = !navVisible;
    if (navVisible) {
        gameHeader.classList.add('visible');
        gameFooter.style.display = 'block';
        navToggle.textContent = '×';
    } else {
        gameHeader.classList.remove('visible');
        gameFooter.style.display = 'none';
        navToggle.textContent = '≡';
    }
});

    // 預設顏色 (用於新選項或備用)
    const defaultColors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
        '#9966FF', '#FF9F40', '#7ED321', '#50E3C2',
        '#F8E71C', '#BD10E0', '#8B572A', '#4A90E2'
    ];
    const fallbackColor = '#cccccc';

    // 選項現在儲存為物件陣列 (包含文字和顏色)
    let options = [
        { text: '吃拉麵', color: '#FF6384' },
        { text: '吃牛排', color: '#9B7E12' },
        { text: '吃披薩', color: '#FFCE56' },
        { text: '吃漢堡', color: '#4BC0C0' }
    ];

    let spinning = false;
    let currentAngle = 0;
    let spinSpeed = 0;
    let maxSpinTime = 5000;
    let spinStartTime = 0;
    let animationId = null;

    // 繪製轉盤 (使用自訂顏色)
    function drawWheel() {
        const wheelRadius = canvas.width / 2;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const centerX = wheelRadius;
        const centerY = wheelRadius;
        const radius = wheelRadius - 10;

        // 繪製轉盤背景
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ddd';
        ctx.stroke();

        // 如果沒有選項，顯示提示文字
        if (options.length === 0) {
            ctx.fillStyle = '#888';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('請新增選項', centerX, centerY);
            return;
        }

        const sliceAngle = (2 * Math.PI) / options.length;

        // 繪製每個選項的扇形
        for (let i = 0; i < options.length; i++) {
            const option = options[i];
            const startAngle = currentAngle + i * sliceAngle;
            const endAngle = startAngle + sliceAngle;

            // 繪製扇形
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = option.color || fallbackColor;
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.stroke();

            // 計算文字大小和位置
            const text = option.text;
            const textAngle = startAngle + sliceAngle / 2;
            let textDistance = radius * 0.65;
            let fontSize = 14;
            
            // 根據選項數量調整文字大小
            if (options.length >= 8) {
                fontSize = 12;
                textDistance = radius * 0.7;
            }
            if (options.length >= 12) {
                fontSize = 10;
                textDistance = radius * 0.75;
            }

            // 計算文字座標
            const textX = centerX + Math.cos(textAngle) * textDistance;
            const textY = centerY + Math.sin(textAngle) * textDistance;

            // 繪製文字 (根據背景亮度調整文字顏色)
            ctx.save();
            ctx.translate(textX, textY);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const bgColor = option.color || fallbackColor;
            const brightness = calculateBrightness(bgColor);
            
            // 根據背景亮度選擇文字顏色
            if (brightness > 180) {
                ctx.fillStyle = '#333';
            } else {
                ctx.fillStyle = 'white';
                ctx.shadowColor = 'rgba(0,0,0,0.7)';
                ctx.shadowBlur = 3;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;
            }
            
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.fillText(text, 0, 0);
            ctx.restore();
        }

        // 繪製中心圓
        ctx.beginPath();
        ctx.arc(centerX, centerY, 15, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ccc';
        ctx.stroke();
    }

    // 計算顏色亮度 (0-255)
    function calculateBrightness(hexColor) {
        hexColor = hexColor.replace('#', '');
        let r = 0, g = 0, b = 0;
        
        if (hexColor.length === 3) {
            r = parseInt(hexColor[0] + hexColor[0], 16);
            g = parseInt(hexColor[1] + hexColor[1], 16);
            b = parseInt(hexColor[2] + hexColor[2], 16);
        } else if (hexColor.length === 6) {
            r = parseInt(hexColor.substring(0, 2), 16);
            g = parseInt(hexColor.substring(2, 4), 16);
            b = parseInt(hexColor.substring(4, 6), 16);
        }
        
        return (0.299 * r + 0.587 * g + 0.114 * b);
    }

    // 顯示選項編輯視窗
    function showOptionsModal() {
        optionsContainer.innerHTML = '';
        
        if (options.length === 0) {
            const noOptions = document.createElement('div');
            noOptions.className = 'no-options';
            noOptions.textContent = '目前沒有選項，請點擊下方按鈕新增';
            optionsContainer.appendChild(noOptions);
        } else {
            // 為每個選項創建輸入框
            options.forEach((option, index) => {
                addOptionToModal(option, index);
            });
        }
        
        optionsModal.style.display = 'block';
        optionsContainer.scrollTop = 0;
        
       
    }

    // 添加選項到編輯視窗
    function addOptionToModal(optionData = null, index = -1) {
        // 移除"沒有選項"提示
        const noOptions = optionsContainer.querySelector('.no-options');
        if (noOptions) noOptions.remove();

        const optionDiv = document.createElement('div');
        optionDiv.className = 'option-input';

        // 確定新選項的索引
        const effectiveIndex = index === -1 ? optionsContainer.querySelectorAll('.option-input').length : index;

        // 創建顏色選擇器
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'option-color-input';
        colorInput.value = optionData?.color || defaultColors[effectiveIndex % defaultColors.length] || fallbackColor;

        // 創建文字輸入框
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'option-text-input';
        textInput.value = optionData?.text || '';
        textInput.placeholder = `選項 ${effectiveIndex + 1}`;

        // 創建移除按鈕
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-option';
        removeBtn.textContent = '-';
        removeBtn.onclick = function() {
            optionDiv.remove();
            updatePlaceholders();
            
            // 如果沒有選項了，顯示提示
            if (optionsContainer.children.length === 0) {
                const noOptions = document.createElement('div');
                noOptions.className = 'no-options';
                noOptions.textContent = '目前沒有選項，請點擊下方按鈕新增';
                optionsContainer.appendChild(noOptions);
            }
        };

        // 將元素添加到選項容器
        optionDiv.appendChild(colorInput);
        optionDiv.appendChild(textInput);
        optionDiv.appendChild(removeBtn);
        optionsContainer.appendChild(optionDiv);

        // 如果是新選項，聚焦並高亮
        if (!optionData) {
            textInput.focus();
            optionDiv.classList.add('highlight');
            setTimeout(() => optionDiv.classList.remove('highlight'), 1000);
            optionsContainer.scrollTop = optionsContainer.scrollHeight;
        }
    }

    // 更新選項的佔位文字
    function updatePlaceholders() {
        const optionInputs = optionsContainer.querySelectorAll('.option-input');
        
        optionInputs.forEach((div, index) => {
            const textInput = div.querySelector('.option-text-input');
            if (textInput) {
                textInput.placeholder = `選項 ${index + 1}`;
            }
        });
    }

    // 儲存選項
    function saveOptions() {
        const inputs = optionsContainer.querySelectorAll('.option-input');
        const newOptions = [];

        // 收集所有選項的文字和顏色
        inputs.forEach(div => {
            const textInput = div.querySelector('.option-text-input');
            const colorInput = div.querySelector('.option-color-input');
            const textValue = textInput.value.trim();
            const colorValue = colorInput.value || fallbackColor;

            if (textValue !== '') {
                newOptions.push({ text: textValue, color: colorValue });
            }
        });

        // 處理不同情況的儲存邏輯
        if (newOptions.length > 0 || (options.length === 0 && newOptions.length === 0)) {
            options = newOptions;
            optionsModal.style.display = 'none';
            drawWheel();
        } else if (options.length > 0 && newOptions.length === 0) {
            if (confirm("您確定要刪除所有選項嗎？轉盤將無法使用。")) {
                options = newOptions;
                optionsModal.style.display = 'none';
                drawWheel();
            } else {
                return;
            }
        } else if (options.length === 0 && newOptions.length === 0) {
            optionsModal.style.display = 'none';
        }
    }

    // 轉盤動畫
    function animateWheel(timestamp) {
        if (!spinStartTime) spinStartTime = timestamp;
        const elapsedTime = timestamp - spinStartTime;

        if (spinning) {
            const progress = Math.min(elapsedTime / maxSpinTime, 1);
            const easingProgress = 1 - Math.pow(1 - progress, 4);
            const baseSpeed = 0.25;
            const decelerationFactor = 1 - easingProgress;
            spinSpeed = baseSpeed * decelerationFactor + 0.01;

            currentAngle += spinSpeed;
            drawWheel();

            if (progress >= 1) {
                finishSpin();
            } else {
                animationId = requestAnimationFrame(animateWheel);
            }
        }
    }

    // 結束旋轉
    function finishSpin() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }

        spinning = false;
        spinBtn.disabled = false;
        spinStartTime = 0;

        const numOptions = options.length;
        if (numOptions === 0) return;

        // 計算最終角度和結果
        const sliceAngle = (2 * Math.PI) / numOptions;
        const finalAngle = ((currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const pointerRad = (3 * Math.PI / 2);
        const pointerEffectiveAngle = ((pointerRad - finalAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        const resultIndex = Math.floor(pointerEffectiveAngle / sliceAngle);
        const finalResultIndex = resultIndex % numOptions;

        // 獲取獲勝選項
        const winningOption = options[finalResultIndex];

        // 顯示結果 (使用選項的文字和顏色)
        resultElement.textContent = `結果: ${winningOption.text}`;
        resultElement.style.color = winningOption.color || fallbackColor;
        resultElement.classList.add('show-result');
        playSound();

        // 添加轉盤放大效果
        canvas.style.transform = 'scale(1.05)';
        setTimeout(() => {
            canvas.style.transform = 'scale(1)';
        }, 300);
    }

    // 處理關閉編輯視窗
    function handleCloseModal() {
        const inputs = optionsContainer.querySelectorAll('.option-input .option-text-input');
        let hasNonEmpty = inputs.length > 0 && Array.from(inputs).some(input => input.value.trim() !== '');
        const hasInputsInModal = optionsContainer.querySelectorAll('.option-input').length > 0;

        if (options.length > 0 && !hasNonEmpty && hasInputsInModal) {
            if (confirm("您已清空所有選項文字，確定要關閉嗎？")) {
                optionsModal.style.display = 'none';
                saveOptions();
            }
        } else if (options.length > 0 && !hasInputsInModal) {
            if (confirm("您已移除所有選項，確定要關閉嗎？轉盤將無法使用。")) {
                optionsModal.style.display = 'none';
                saveOptions();
            }
        } else {
            optionsModal.style.display = 'none';
        }
    }

    // 處理鍵盤事件
    function handleKeyDown(event) {
        if (optionsModal.style.display === 'block') {
            const activeElement = document.activeElement;
            
            if (event.key === 'Enter' && activeElement?.tagName !== 'INPUT' && activeElement?.tagName !== 'BUTTON') {
                event.preventDefault();
                addOptionToModal();
            } else if (event.key === 'Enter' && event.ctrlKey) {
                event.preventDefault();
                saveOptions();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                handleCloseModal();
            }
        }
    }

    // 播放音效
    function playSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) {
                console.warn("瀏覽器不支持 AudioContext");
                return;
            }
            
            const audioCtx = new AudioContext();
            const oscillator = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            oscillator.connect(gain);
            gain.connect(audioCtx.destination);
            oscillator.type = 'triangle';
            
            const baseFreq = 440;
            oscillator.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
            oscillator.frequency.linearRampToValueAtTime(baseFreq * 1.5, audioCtx.currentTime + 0.1);
            oscillator.frequency.linearRampToValueAtTime(baseFreq * 1.2, audioCtx.currentTime + 0.2);
            oscillator.frequency.linearRampToValueAtTime(baseFreq * 2, audioCtx.currentTime + 0.3);
            
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
            
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.8);
            
            setTimeout(() => {
                if (audioCtx.state !== 'closed') audioCtx.close();
            }, 1000);
        } catch(e) {
            console.error('音效播放失敗:', e);
        }
    }

    // 初始化轉盤
    function initWheel() {
        drawWheel();

        // 旋轉按鈕事件
        spinBtn.addEventListener('click', function() {
            if (spinning) return;
            
            if (options.length === 0) {
                alert('請先編輯選項！');
                showOptionsModal();
                return;
            }
            
            if (options.length === 1) {
                alert('只有一個選項，不用轉啦！');
                const singleOption = options[0];
                resultElement.textContent = `結果: ${singleOption.text}`;
                resultElement.style.color = singleOption.color || fallbackColor;
                resultElement.classList.add('show-result');
                canvas.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    canvas.style.transform = 'scale(1)';
                }, 300);
                playSound();
                return;
            }
            
            spinning = true;
            spinBtn.disabled = true;
            resultElement.textContent = '';
            resultElement.classList.remove('show-result');
            spinStartTime = 0;
            currentAngle = ((currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            animationId = requestAnimationFrame(animateWheel);
        });



 // 添加新的事件監聽器
 themeSelect.addEventListener('change', function() {
    const selectedValue = this.value;
    if (selectedValue) {
        loadTheme(selectedValue);
    }
});

exportJSONBtn.addEventListener('click', exportToJSON);

importJSONBtn.addEventListener('click', function() {
    jsonFileInput.click();
});

jsonFileInput.addEventListener('change', function(e) {
    if (this.files && this.files[0]) {
        importFromJSON(this.files[0]);
        this.value = ''; // 重置文件輸入
    }
});


// 添加儲存主題按鈕事件
saveThemeBtn.addEventListener('click', saveCurrentAsTheme);

// 編輯選項按鈕事件監聽
editOptionsBtn.addEventListener('click', showOptionsModal);

        // 其他事件監聽器
        editOptionsBtn.addEventListener('click', showOptionsModal);
        closeModal.addEventListener('click', () => handleCloseModal());
        
        window.addEventListener('click', (event) => {
            if (event.target === optionsModal) handleCloseModal();
        });
        
        addOptionBtn.addEventListener('click', () => addOptionToModal());
        saveOptionsBtn.addEventListener('click', saveOptions);
        document.addEventListener('keydown', handleKeyDown);
    }

    // 啟動應用程式
    initWheel();
    loadThemeList();
});



// 匯出為JSON檔案
function exportToJSON() {
    const themeData = {
        theme: {
            name: currentThemeName || "未命名主題",
            created_at: new Date().toISOString()
        },
        options: options.map(option => ({
            text: option.text,
            color: option.color,
            display_order: options.indexOf(option)
        }))
    };
    
    const dataStr = JSON.stringify(themeData, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `${currentThemeName || 'wheel-theme'}.json`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// 匯入JSON檔案
function importFromJSON(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonData = JSON.parse(e.target.result);
            
            // 驗證JSON格式
            if (!jsonData.options || !Array.isArray(jsonData.options)) {
                alert('無效的JSON格式：缺少選項陣列');
                return;
            }
            
            // 提取主題名稱（如果有）
            if (jsonData.theme && jsonData.theme.name) {
                currentThemeName = jsonData.theme.name;
                currentThemeEl.textContent = `目前主題: ${currentThemeName}`;
            }
            
            // 提取選項
            const importedOptions = jsonData.options.map(opt => ({
                text: opt.text || '',
                color: opt.color || fallbackColor
            }));
            
            if (importedOptions.length === 0) {
                alert('JSON檔案中沒有有效的選項');
                return;
            }
            
            // 更新選項並重繪轉盤
            options = importedOptions;
            drawWheel();
            
            alert('成功匯入主題：' + currentThemeName);
            
        } catch (err) {
            console.error('匯入JSON時出錯:', err);
            alert('匯入JSON時出錯：' + err.message);
        }
    };
    reader.readAsText(file);
}

// 從資料庫加載主題列表
async function loadThemeList() {
    try {
        const response = await fetch('/api/wheel-game/themes');
        if (response.ok) {
            const themes = await response.json();
            populateThemeSelect(themes);
        } else {
            console.error('無法獲取主題列表');
        }
    } catch (err) {
        console.error('獲取主題列表時出錯:', err);
    }
}

// 填充主題選單
function populateThemeSelect(themes) {
    // 清空選單，保留預設選項
    themeSelect.innerHTML = '<option value="" disabled selected>-- 載入主題 --</option>';
    
    // 添加主題選項
    themes.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme.id;
        option.textContent = theme.name;
        themeSelect.appendChild(option);
    });
}

// 從資料庫加載特定主題
async function loadTheme(themeId) {
    try {
        const response = await fetch(`/api/wheel-game/themes/${themeId}`);
        if (response.ok) {
            const themeData = await response.json();
            applyThemeData(themeData);
            return true;
        } else {
            console.error('無法獲取主題');
            return false;
        }
    } catch (err) {
        console.error('獲取主題時出錯:', err);
        return false;
    }
}

// 應用主題數據
function applyThemeData(themeData) {
    // 設置主題名稱
    currentThemeName = themeData.name;
    currentThemeId = themeData.id;
    currentThemeEl.textContent = `目前主題: ${currentThemeName}`;
    
    // 設置選項
    if (themeData.options && Array.isArray(themeData.options)) {
        options = themeData.options.map(opt => ({
            text: opt.text,
            color: opt.color
        }));
        
        // 重繪轉盤
        drawWheel();
    }
}

// 保存當前主題到資料庫
async function saveTheme(themeName) {
    if (!themeName || !options.length) {
        alert('請輸入主題名稱且確保有至少一個選項');
        return false;
    }
    
    try {
        const themeData = {
            name: themeName,
            options: options.map(option => ({
                text: option.text,
                color: option.color,
                display_order: options.indexOf(option)
            }))
        };
        
        const response = await fetch('/api/wheel-game/themes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(themeData)
        });
        
        if (response.ok) {
            const result = await response.json();
            currentThemeName = themeName;
            currentThemeId = result.id;
            currentThemeEl.textContent = `目前主題: ${currentThemeName}`;
            
            // 重新加載主題列表
            loadThemeList();
            
            return true;
        } else {
            const error = await response.json();
            alert('儲存主題失敗: ' + (error.error || '未知錯誤'));
            return false;
        }
    } catch (err) {
        console.error('儲存主題時出錯:', err);
        alert('儲存主題時發生錯誤: ' + err.message);
        return false;
    }
}

// 儲存當前選項為新主題
function saveCurrentAsTheme() {
    const themeName = prompt('請輸入主題名稱:', currentThemeName);
    if (themeName) {
        saveTheme(themeName);
    }
}