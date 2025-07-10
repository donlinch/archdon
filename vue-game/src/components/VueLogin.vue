<script setup>
import { ref, reactive } from 'vue';
import { ElMessage, ElLoading } from 'element-plus';

const emit = defineEmits(['login']);

const loginForm = reactive({
  username: '',
  password: ''
});

const isLoading = ref(false);
const formRef = ref(null);

// 獲取基礎路徑
const getBasePath = () => {
  // 檢查是否是開發環境
  const isDev = import.meta.env.DEV;
  // 開發環境使用相對路徑，生產環境使用設定的基礎路徑
  return isDev ? '' : '/vue-game';
};

// 登入規則
const rules = {
  username: [
    { required: true, message: '請輸入用戶名', trigger: 'blur' },
    { min: 3, max: 20, message: '長度需在 3 到 20 個字符之間', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '請輸入密碼', trigger: 'blur' },
    { min: 6, max: 30, message: '長度需在 6 到 30 個字符之間', trigger: 'blur' }
  ]
};

// 登入方法
const handleLogin = async () => {
  // 表單驗證
  if (!formRef.value) return;
  
  await formRef.value.validate(async (valid, fields) => {
    if (!valid) {
      return false;
    }
    
    isLoading.value = true;
    const loadingInstance = ElLoading.service({
      lock: true,
      text: '登入中...',
      background: 'rgba(0, 0, 0, 0.7)'
    });
    
    try {
      // 這裡應該是實際的API請求，現在我們使用模擬數據
      // 如果需要訪問後端 API，應使用絕對路徑或相對於當前域的路徑
      // const apiUrl = `${getBasePath()}/api/login`;
      // const response = await fetch(apiUrl, {...});
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 模擬登入成功
      const userData = {
        id: 'user123',
        username: loginForm.username,
        displayName: loginForm.username,
        avatar: '/vue-game/images/a01girlmove.gif', // 修改為正確的 base 路徑
        token: 'mock-token-12345'
      };
      
      // 存儲用戶信息到 localStorage
      localStorage.setItem('boxCurrentUserId', userData.id);
      localStorage.setItem('boxCurrentUsername', userData.username);
      localStorage.setItem('boxCurrentDisplayName', userData.displayName);
      localStorage.setItem('boxCurrentUserAvatar', userData.avatar);
      localStorage.setItem(`boxUserToken_${userData.id}`, userData.token);
      
      // 觸發登入事件
      emit('login', userData);
      
      ElMessage.success('登入成功！');
    } catch (error) {
      ElMessage.error('登入失敗：' + (error.message || '未知錯誤'));
    } finally {
      loadingInstance.close();
      isLoading.value = false;
    }
  });
};

// 直接切換到註冊頁面
const goToRegister = () => {
  window.location.href = '/member-register.html';
};
</script>

<template>
  <div class="vue-login-container">
    <h1>會員登入</h1>
    
    <el-form
      ref="formRef"
      :model="loginForm"
      :rules="rules"
      label-position="top"
      class="login-form">
      
      <el-form-item label="用戶名" prop="username">
        <el-input 
          v-model="loginForm.username" 
          placeholder="請輸入用戶名"
          prefix-icon="el-icon-user"
          :disabled="isLoading" />
      </el-form-item>
      
      <el-form-item label="密碼" prop="password">
        <el-input 
          v-model="loginForm.password" 
          type="password" 
          placeholder="請輸入密碼"
          prefix-icon="el-icon-lock"
          show-password
          :disabled="isLoading" />
      </el-form-item>
      
      <div class="form-actions">
        <el-button type="primary" @click="handleLogin" :loading="isLoading" :disabled="isLoading">
          登入
        </el-button>
        <el-button type="primary" link @click="goToRegister" :disabled="isLoading">
          還沒有帳號？立即註冊
        </el-button>
      </div>
    </el-form>
    
    <div class="login-options">
      <p>或使用以下方式登入：</p>
      <div class="social-login">
        <button class="social-btn facebook">Facebook 登入</button>
        <button class="social-btn google">Google 登入</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vue-login-container {
  max-width: 400px;
  margin: 0 auto;
  padding: 20px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

h1 {
  text-align: center;
  margin-bottom: 30px;
  color: #409EFF;
}

.login-form {
  margin-bottom: 20px;
}

.form-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  margin-top: 20px;
}

.el-button--primary {
  width: 100%;
  padding: 12px;
  font-size: 16px;
}

.login-options {
  margin-top: 30px;
  text-align: center;
}

.social-login {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 15px;
}

.social-btn {
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.facebook {
  background-color: #3b5998;
  color: white;
}

.facebook:hover {
  background-color: #2d4373;
}

.google {
  background-color: #db4437;
  color: white;
}

.google:hover {
  background-color: #c1351d;
}

@media (prefers-color-scheme: light) {
  .vue-login-container {
    background-color: white;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  }
}
</style> 