# SunnyYummy 應用程式

這是一個多功能會員網站，包含主網站系統和「廚房急先鋒」遊戲子系統。

## 系統架構

此專案包含兩個主要部分：

1. **主網站系統** (`server.js`)：
   - 運行在端口 3000
   - 處理主要會員功能和API
   - WebSocket路徑：`/ws`

2. **廚房急先鋒遊戲** (`cook-kitchen-rush.js`):
   - 運行在端口 3001
   - 處理遊戲相關功能和API
   - WebSocket路徑：`/cook-ws`
   - API路徑前綴：`/cook-api`

## 安裝步驟

### 前置需求

- Node.js (v14.0 或以上)
- PostgreSQL (v12.0 或以上)

### 安裝依賴

```bash
npm install
```

### 環境變數配置

創建 `.env` 文件，包含以下配置：

```
# 共用資料庫配置
DB_USER=postgres
DB_HOST=localhost
DB_NAME=sunnyyummy_db
DB_PASSWORD=your_password
DB_PORT=5432

# 主系統配置
PORT=3000
JWT_SECRET=your_main_jwt_secret

# 廚房急先鋒配置
COOK_PORT=3001
COOK_DB_USER=postgres
COOK_DB_HOST=localhost
COOK_DB_NAME=cook_game
COOK_DB_PASSWORD=your_password
COOK_DB_PORT=5432
COOK_JWT_SECRET=your_cook_game_jwt_secret
```

### 資料庫設置

1. 創建主網站資料庫：

```bash
createdb -U postgres sunnyyummy_db
psql -U postgres -d sunnyyummy_db -f db_schema_main.sql
```

2. 創建廚房急先鋒資料庫：

```bash
createdb -U postgres cook_game
psql -U postgres -d cook_game -f db_schema.sql
```

## 運行應用程式

### 開發模式

分別運行兩個服務：

```bash
# 運行主網站系統
npm run dev

# 在另一個終端窗口運行廚房急先鋒
npm run dev-cook-game
```

或者同時運行兩個服務：

```bash
npm run start-all
```

### 生產模式

```bash
# 運行主網站系統
npm start

# 在另一個終端窗口運行廚房急先鋒
npm run cook-game
```

## 訪問應用程式

- 主網站：`http://localhost:3000`
- 廚房急先鋒遊戲：`http://localhost:3000/cook-login.html`

注意：即使遊戲服務運行在3001端口，由於靜態文件通過主服務器提供，用戶仍然通過3000端口訪問遊戲界面，但遊戲API和WebSocket連接會自動連接到3001端口的服務。

## 開發指南

### API端點

#### 主網站API端點

- `/api/auth/*` - 認證相關API
- `/api/users/*` - 用戶相關API
- 更多...

#### 廚房急先鋒API端點

- `/cook-api/auth/login` - 遊戲登入
- `/cook-api/users/profile` - 獲取遊戲用戶資料
- `/cook-api/games/rooms` - 遊戲房間管理
- 更多...

### WebSocket消息

#### 廚房急先鋒WebSocket消息

- `authenticate` - 認證用戶
- `join_room` - 加入房間
- `player_ready` - 玩家準備
- `game_action` - 遊戲操作
- `chat_message` - 聊天消息

## 專案文件結構

```
/
├── server.js              # 主網站服務器
├── cook-kitchen-rush.js   # 廚房急先鋒遊戲服務器
├── public/                # 靜態文件
│   ├── index.html         # 主網站首頁
│   ├── cook-login.html    # 廚房急先鋒登入頁面
│   ├── cook-lobby.html    # 廚房急先鋒大廳頁面
│   ├── cook-game-room.html # 廚房急先鋒房間頁面
│   └── cook-game.html     # 廚房急先鋒遊戲頁面
├── db_schema.sql          # 廚房急先鋒資料庫結構
├── db_schema_main.sql     # 主網站資料庫結構
├── package.json           # 專案配置
└── README.md              # 本文檔
``` 