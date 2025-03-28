const express = require('express');
const path = require('path'); // Node.js 內建模組，用來處理檔案路徑

const app = express();
const port = process.env.PORT || 3000; // Render 會設定 PORT 環境變數，本地測試用 3000

// 設定靜態檔案目錄 (重要！)
// 告訴 Express 去哪裡找 HTML, CSS, JS 檔案
app.use(express.static(path.join(__dirname, 'public')));

// 基本的首頁路由 (非必要，因為 express.static 會自動找 index.html)
// 如果 public 資料夾裡有 index.html，訪問 '/' 會自動顯示它
// app.get('/', (req, res) => {
//   // 你也可以在這裡明確指定發送哪個檔案
//   // res.sendFile(path.join(__dirname, 'public', 'index.html'));
//   res.send('Hello from Express!'); // 或者只發送簡單文字
// });

// 加入一個簡單的 API 路由，測試後端是否運作
app.get('/api/hello', (req, res) => {
  res.json({ message: '來自後端的 SunnyYummy API 回應！' });
});


app.listen(port, () => {
  console.log(`伺服器正在監聽 port ${port}`);
});