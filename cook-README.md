# 廚房急先鋒 (Kitchen Rush)

一款多人合作的實時廚房模擬遊戲，專為行動裝置優化，采用BBS風格的復古界面設計。

## 專案簡介

廚房急先鋒是一款強調團隊合作的多人烹飪遊戲，玩家需要在有限的時間內共同完成各種食譜訂單。遊戲采用了懷舊的BBS界面風格，同時優化了移動端的觸控體驗。

### 主要特點

- **多人合作遊戲**：2-4名玩家一起參與烹飪挑戰
- **實時操作**：基於WebSocket的實時遊戲體驗
- **BBS風格界面**：復古文字界面設計，帶來獨特的遊戲體驗
- **手機優化**：專為觸控操作優化的界面設計
- **會員系統**：支持用戶註冊、登錄、成就記錄
- **多道食譜**：提供多種難度的食譜挑戰

## 技術棧

- **前端**：HTML5, CSS3, JavaScript (原生)
- **後端**：Node.js, Express
- **資料庫**：PostgreSQL
- **實時通訊**：WebSocket
- **認證**：JWT Token

## 功能列表

- 用戶認證與授權
- 遊戲房間創建與加入
- 多人實時遊戲
- 食譜系統
- 成就系統
- 排行榜
- 移動端優化

## 安裝與運行

### 先決條件

- Node.js (v14+)
- PostgreSQL (v12+)

### 安裝步驟

1. 克隆專案
   ```bash
   git clone https://github.com/yourusername/sunnyyummy-app.git
   cd sunnyyummy-app
   ```

2. 安裝依賴
   ```bash
   npm install
   ```

3. 設置環境變數
   創建`.env`文件，並設置必要的環境變數：
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=cook_game
   DB_USER=postgres
   DB_PASSWORD=your_password
   JWT_SECRET=your_secret_key
   PORT=3000
   ```

4. 初始化資料庫
   ```bash
   psql -U postgres -f db_schema.sql
   ```

5. 運行應用
   ```bash
   node cook-kitchen-rush.js
   ```

6. 訪問應用
   打開瀏覽器，訪問 `http://localhost:3000/cook-login.html`

## 遊戲玩法

1. **註冊/登錄**：使用您的帳戶登錄，或創建新帳戶
2. **加入房間**：在大廳中選擇一個房間加入，或創建新房間
3. **準備就緒**：在房間中點擊「準備就緒」按鈕
4. **遊戲開始**：當所有玩家都準備好後，房主可以開始遊戲
5. **烹飪合作**：與隊友合作，在限定時間內完成訂單
6. **獲取分數**：根據完成的訂單數量和質量獲得分數

## 項目結構

```
sunnyyummy-app/
│
├── cook-kitchen-rush.js    # 主服務器文件
├── db_schema.sql           # 資料庫結構
├── package.json            # 項目依賴
├── .env                    # 環境變數（需自行創建）
│
├── public/                 # 靜態資源目錄
│   ├── cook-login.html     # 登錄頁面
│   ├── cook-lobby.html     # 遊戲大廳
│   ├── cook-game-room.html # 遊戲房間
│   ├── cook-game.html      # 遊戲主頁面
│   ├── cook-result.html    # 遊戲結果頁面
│   ├── cook-help.html      # 遊戲幫助頁面
│   └── manifest.json       # Web App 配置
│
└── README.md               # 專案文檔
```

## 貢獻指南

1. Fork 專案
2. 創建新的 Feature 分支 (`git checkout -b feature/amazing-feature`)
3. 提交變更 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

## 授權

此項目採用 MIT 授權 - 詳見 [LICENSE](LICENSE) 文件

## 聯繫方式

專案維護者 - [你的名字](mailto:your.email@example.com)

項目鏈接：[https://github.com/yourusername/sunnyyummy-app](https://github.com/yourusername/sunnyyummy-app)
