// public/VUE/js/game-data.js

// 遊戲中的所有物品
export const items = {
  // --- T0 (基礎食材) ---
  'raw_beef': { id: 'raw_beef', name: '生牛肉', symbol: '🐄', tier: 0, category: '肉類' },
  'raw_pork': { id: 'raw_pork', name: '生豬肉', symbol: '🐷', tier: 0, category: '肉類' },
  'raw_chicken': { id: 'raw_chicken', name: '生雞肉', symbol: '🐔', tier: 0, category: '肉類' },
  'raw_fish': { id: 'raw_fish', name: '生魚', symbol: '🐟', tier: 0, category: '肉類' },
  'raw_shrimp': { id: 'raw_shrimp', name: '生蝦', symbol: '🦐', tier: 0, category: '肉類' },
  'egg': { id: 'egg', name: '雞蛋', symbol: '🥚', tier: 0, category: '肉類' },
  'lettuce': { id: 'lettuce', name: '生菜', symbol: '🥬', tier: 0, category: '蔬菜' },
  'tomato': { id: 'tomato', name: '番茄', symbol: '🍅', tier: 0, category: '蔬菜' },
  'onion': { id: 'onion', name: '洋蔥', symbol: '🧅', tier: 0, category: '蔬菜' },
  'potato': { id: 'potato', name: '馬鈴薯', symbol: '🥔', tier: 0, category: '蔬菜' },
  'garlic': { id: 'garlic', name: '大蒜', symbol: '🧄', tier: 0, category: '蔬菜' },
  'flour': { id: 'flour', name: '麵粉', symbol: '🌾', tier: 0, category: '加工品' },
  'rice': { id: 'rice', name: '生米', symbol: '🍚', tier: 0, category: '加工品' },
  'noodles': { id: 'noodles', name: '生麵條', symbol: '🍜', tier: 0, category: '加工品' },
  'cheese': { id: 'cheese', name: '起司', symbol: '🧀', tier: 0, category: '加工品' },
  'butter': { id: 'butter', name: '奶油', symbol: '🧈', tier: 0, category: '加工品' },
  'salt': { id: 'salt', name: '鹽', symbol: '🧂', tier: 0, category: '調味醬料' },
  'pepper': { id: 'pepper', name: '胡椒', symbol: '🌶️', tier: 0, category: '調味醬料' },
  
  // --- T1 (半成品) ---
  'beef_patty': { id: 'beef_patty', name: '熟牛肉餅', symbol: '🍔', tier: 1 },
  'fried_pork': { id: 'fried_pork', name: '炸豬排', symbol: '🐖', tier: 1 },
  'grilled_chicken': { id: 'grilled_chicken', name: '烤雞腿', symbol: '🍗', tier: 1 },
  'fried_fish': { id: 'fried_fish', name: '炸魚排', symbol: '🐠', tier: 1 },
  'boiled_shrimp': { id: 'boiled_shrimp', name: '水煮蝦', symbol: '🍤', tier: 1 },
  'fried_egg': { id: 'fried_egg', name: '煎蛋', symbol: '🍳', tier: 1 },
  'salad': { id: 'salad', name: '沙拉', symbol: '🥗', tier: 1 },
  'tomato_sauce': { id: 'tomato_sauce', name: '番茄醬', symbol: '🥫', tier: 1 },
  'french_fries': { id: 'french_fries', name: '薯條', symbol: '🍟', tier: 1 },
  'baked_bread': { id: 'baked_bread', name: '烤麵包', symbol: '🍞', tier: 1 },
  'cooked_rice': { id: 'cooked_rice', name: '熟飯', symbol: '🍚', tier: 1 },
  'cooked_noodles': { id: 'cooked_noodles', name: '熟麵條', symbol: '🍜', tier: 1 },

  // --- T2 (最終料理) ---
  'cheeseburger': { id: 'cheeseburger', name: '起司漢堡', symbol: '🍔', tier: 2 },
  'pork_cutlet_bowl': { id: 'pork_cutlet_bowl', name: '豬排丼', symbol: '丼', tier: 2 },
  'chicken_salad': { id: 'chicken_salad', name: '雞肉沙拉', symbol: '🥗', tier: 2 },
  'fish_and_chips': { id: 'fish_and_chips', name: '炸魚薯條', symbol: '🐟🍟', tier: 2 },
  'shrimp_pasta': { id: 'shrimp_pasta', name: '鮮蝦義大利麵', symbol: '🍝', tier: 2 },
};

// 遊戲中的所有食譜
export const recipes = {
  // --- T1 食譜 (T0 -> T1) ---
  'grill_beef': { id: 'grill_beef', output: 'beef_patty', method: 'grill', requirements: [{ itemId: 'raw_beef', quantity: 1 }] },
  'deep_fry_pork': { id: 'deep_fry_pork', output: 'fried_pork', method: 'deep_fry', requirements: [{ itemId: 'raw_pork', quantity: 1 }] },
  'grill_chicken': { id: 'grill_chicken', output: 'grilled_chicken', method: 'grill', requirements: [{ itemId: 'raw_chicken', quantity: 1 }] },
  'deep_fry_fish': { id: 'deep_fry_fish', output: 'fried_fish', method: 'deep_fry', requirements: [{ itemId: 'raw_fish', quantity: 1 }] },
  'boil_shrimp': { id: 'boil_shrimp', output: 'boiled_shrimp', method: 'boil', requirements: [{ itemId: 'raw_shrimp', quantity: 1 }] },
  'pan_fry_egg': { id: 'pan_fry_egg', output: 'fried_egg', method: 'pan_fry', requirements: [{ itemId: 'egg', quantity: 1 }] },
  'make_salad': { id: 'make_salad', output: 'salad', method: 'assembly', requirements: [{ itemId: 'lettuce', quantity: 1 }] }, // 簡單組合也算
  'boil_tomato_sauce': { id: 'boil_tomato_sauce', output: 'tomato_sauce', method: 'boil', requirements: [{ itemId: 'tomato', quantity: 1 }] },
  'deep_fry_potato': { id: 'deep_fry_potato', output: 'french_fries', method: 'deep_fry', requirements: [{ itemId: 'potato', quantity: 1 }] },
  'grill_flour': { id: 'grill_flour', output: 'baked_bread', method: 'grill', requirements: [{ itemId: 'flour', quantity: 1 }] }, // 簡化：烤麵粉=麵包
  'boil_rice': { id: 'boil_rice', output: 'cooked_rice', method: 'boil', requirements: [{ itemId: 'rice', quantity: 1 }] },
  'boil_noodles': { id: 'boil_noodles', output: 'cooked_noodles', method: 'boil', requirements: [{ itemId: 'noodles', quantity: 1 }] },

  // --- T2 食譜 (T0/T1 -> T2) ---
  'make_cheeseburger': { 
    id: 'make_cheeseburger', 
    output: 'cheeseburger', 
    method: 'assembly', 
    requirements: [
      { itemId: 'beef_patty', quantity: 1 },
      { itemId: 'baked_bread', quantity: 1 },
      { itemId: 'cheese', quantity: 1 }
    ] 
  },
  'make_pork_cutlet_bowl': { 
    id: 'make_pork_cutlet_bowl', 
    output: 'pork_cutlet_bowl', 
    method: 'assembly', 
    requirements: [
      { itemId: 'fried_pork', quantity: 1 },
      { itemId: 'cooked_rice', quantity: 1 },
      { itemId: 'fried_egg', quantity: 1 }
    ] 
  },
  'make_chicken_salad': { 
    id: 'make_chicken_salad', 
    output: 'chicken_salad', 
    method: 'assembly', 
    requirements: [
      { itemId: 'grilled_chicken', quantity: 1 },
      { itemId: 'salad', quantity: 1 }
    ] 
  },
  'make_fish_and_chips': { 
    id: 'make_fish_and_chips', 
    output: 'fish_and_chips', 
    method: 'assembly', 
    requirements: [
      { itemId: 'fried_fish', quantity: 1 },
      { itemId: 'french_fries', quantity: 1 }
    ] 
  },
  'make_shrimp_pasta': { 
    id: 'make_shrimp_pasta', 
    output: 'shrimp_pasta', 
    method: 'assembly', 
    requirements: [
      { itemId: 'boiled_shrimp', quantity: 1 },
      { itemId: 'cooked_noodles', quantity: 1 },
      { itemId: 'tomato_sauce', quantity: 1 }
    ] 
  },
};
