<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import VueLogin from './components/VueLogin.vue';
import AnimationDemo from './components/AnimationDemo.vue';

const phaserContainer = ref();

// 用戶狀態
const user = reactive({
  isLoggedIn: false,
  username: '',
  avatar: '/vue-game/images/a01girlmove.gif',
  displayName: ''
});

// 獲取基礎路徑
const getBasePath = () => {
  // 檢查是否是開發環境
  const isDev = import.meta.env.DEV;
  // 開發環境使用相對路徑，生產環境使用設定的基礎路徑
  return isDev ? '' : '/vue-game';
};

onMounted(() => {
  // 檢查是否有已保存的登入信息
  const savedUserId = localStorage.getItem('boxCurrentUserId');
  const savedUserToken = localStorage.getItem(`boxUserToken_${savedUserId}`);
  const savedUserAvatarUrl = localStorage.getItem('boxCurrentUserAvatar');
  const savedUserName = localStorage.getItem('boxCurrentUsername');
  const savedDisplayName = localStorage.getItem('boxCurrentDisplayName') || savedUserName;

  if (savedUserId && savedUserToken && savedUserName) {
    user.isLoggedIn = true;
    user.username = savedUserName;
    user.avatar = savedUserAvatarUrl || '/vue-game/images/a01girlmove.gif';
    user.displayName = savedDisplayName;
  }
});

// 處理登入
const handleLogin = (userData) => {
  user.isLoggedIn = true;
  user.username = userData.username;
  user.avatar = userData.avatar || '/vue-game/images/a01girlmove.gif';
  user.displayName = userData.displayName || userData.username;
  
  ElMessage.success(`歡迎回來，${user.displayName}！`);
};

// 處理登出
const handleLogout = () => {
  localStorage.removeItem('boxCurrentUserId');
  localStorage.removeItem('boxCurrentUsername');
  localStorage.removeItem('boxCurrentUserAvatar');
  localStorage.removeItem('boxCurrentDisplayName');
  
  user.isLoggedIn = false;
  user.username = '';
  user.avatar = '/vue-game/images/a01girlmove.gif';
  user.displayName = '';
  
  ElMessage.info('您已登出');
};

// 前往會員編輯頁面
const goToUserEditor = () => {
  const savedUserId = localStorage.getItem('boxCurrentUserId');
  if (savedUserId) {
    window.location.href = `/member-editor.html?userId=${savedUserId}`;
  }
};
</script>

<template>
  <div class="app-container">
    <!-- 用戶狀態顯示 -->
    <div class="user-status" @click="user.isLoggedIn ? goToUserEditor() : null">
      <img class="user-avatar" :src="user.avatar" alt="User Avatar">
      <span class="username">{{ user.isLoggedIn ? user.displayName : '未登入' }}</span>
      <button v-if="user.isLoggedIn" class="logout-btn" @click.stop="handleLogout">登出</button>
    </div>

    <!-- 主要內容 -->
    <main>
      <div v-if="!user.isLoggedIn" class="login-container">
        <AnimationDemo />
        <VueLogin @login-success="handleLogin" />
      </div>
      <div v-else class="welcome-container">
        <h1>歡迎回來，{{ user.displayName }}！</h1>
        <div class="game-options">
          <a href="/VUE/cooking-game.html" class="game-link">
            <div class="game-card">
              <h3>料理急先鋒</h3>
              <p>測試你的烹飪技能，製作各種美味料理！</p>
            </div>
          </a>
          <a href="/vue-game/pet-game.html" class="game-link">
            <div class="game-card">
              <h3>寵物遊戲</h3>
              <p>照顧你的虛擬寵物，讓它快樂成長！</p>
            </div>
          </a>
          <a href="/vue-game/wheel-game.html" class="game-link">
            <div class="game-card">
              <h3>幸運輪盤</h3>
              <p>轉動幸運輪盤，贏取豐富獎品！</p>
            </div>
          </a>
        </div>
      </div>
    </main>

    <!-- 頁腳 -->
    <footer>
      <p>&copy; 2024 SunnyYummy. All rights reserved.</p>
    </footer>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.user-status {
  display: flex;
  align-items: center;
  padding: 10px 20px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  margin: 10px;
  cursor: pointer;
  position: relative;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  margin-right: 10px;
}

.username {
  font-weight: bold;
  color: #fff;
}

.logout-btn {
  position: absolute;
  right: 10px;
  background-color: #f56c6c;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
}

main {
  flex: 1;
  padding: 20px;
}

.welcome-container {
  text-align: center;
  margin-top: 40px;
}

.game-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-top: 30px;
}

.game-link {
  text-decoration: none;
}

.game-card {
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  transition: transform 0.3s, box-shadow 0.3s;
  height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.game-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
  background-color: rgba(255, 255, 255, 0.2);
}

.game-card h3 {
  color: #409EFF;
  font-size: 1.5rem;
  margin-bottom: 10px;
}

.game-card p {
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.5;
}

footer {
  background-color: rgba(0, 0, 0, 0.2);
  color: rgba(255, 255, 255, 0.6);
  padding: 10px;
  text-align: center;
  margin-top: 40px;
}

.login-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2rem;
  padding: 2rem;
}

@media (prefers-color-scheme: light) {
  .user-status {
    background-color: rgba(0, 0, 0, 0.05);
  }
  
  .username {
    color: #333;
  }
  
  .game-card {
    background-color: rgba(0, 0, 0, 0.03);
  }
  
  .game-card:hover {
    background-color: rgba(0, 0, 0, 0.06);
  }
  
  .game-card p {
    color: #666;
  }
  
  footer {
    background-color: rgba(0, 0, 0, 0.05);
    color: #666;
  }
}
</style> 