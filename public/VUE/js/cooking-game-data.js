// cooking-game-data.js - 料理急先鋒 V3 遊戲數據

// T0 基礎食材
export const rawIngredients = [
    { id: 'basil', name: '九層塔', symbol: '🌿', tier: 0, category: '蔬菜' },
    { id: 'bacon', name: '培根', symbol: '🥓', tier: 0, category: '肉類' },
    { id: 'garlic', name: '大蒜', symbol: '🧄', tier: 0, category: '蔬菜' },
    { id: 'butter', name: '奶油', symbol: '🧈', tier: 0, category: '加工品' },
    { id: 'lemon', name: '檸檬', symbol: '🍋', tier: 0, category: '蔬菜' },
    { id: 'onion', name: '洋蔥', symbol: '🧅', tier: 0, category: '蔬菜' },
    { id: 'seaweed', name: '海苔', symbol: '🌿', tier: 0, category: '蔬菜' },
    { id: 'milk', name: '牛奶', symbol: '🥛', tier: 0, category: '加工品' },
    { id: 'corn', name: '玉米', symbol: '🌽', tier: 0, category: '蔬菜' },
    { id: 'bell_pepper', name: '甜椒', symbol: '🫑', tier: 0, category: '蔬菜' },
    { id: 'raw_beef', name: '生牛肉', symbol: '🐄', tier: 0, category: '肉類' },
    { id: 'rice', name: '生米', symbol: '🌾', tier: 0, category: '加工品' },
    { id: 'raw_lamb', name: '生羊肉', symbol: '🐑', tier: 0, category: '肉類' },
    { id: 'lettuce', name: '生菜', symbol: '🥬', tier: 0, category: '蔬菜' },
    { id: 'raw_shrimp', name: '生蝦', symbol: '🦐', tier: 0, category: '肉類' },
    { id: 'raw_crab', name: '生蟹', symbol: '🦀', tier: 0, category: '肉類' },
    { id: 'raw_pork', name: '生豬肉', symbol: '🐷', tier: 0, category: '肉類' },
    { id: 'raw_chicken', name: '生雞肉', symbol: '🐔', tier: 0, category: '肉類' },
    { id: 'raw_fish', name: '生魚', symbol: '🐟', tier: 0, category: '肉類' },
    { id: 'raw_squid', name: '生魷魚', symbol: '🦑', tier: 0, category: '肉類' },
    { id: 'noodles', name: '生麵條', symbol: '🍜', tier: 0, category: '加工品' },
    { id: 'tomato', name: '番茄', symbol: '🍅', tier: 0, category: '蔬菜' },
    { id: 'bamboo_shoot', name: '竹筍', symbol: '🎍', tier: 0, category: '蔬菜' },
    { id: 'sugar', name: '糖', symbol: '🧂', tier: 0, category: '調味醬料' },
    { id: 'pepper', name: '胡椒', symbol: '🧂', tier: 0, category: '調味醬料' },
    { id: 'carrot', name: '胡蘿蔔', symbol: '🥕', tier: 0, category: '蔬菜' },
    { id: 'mango', name: '芒果', symbol: '🥭', tier: 0, category: '蔬菜' },
    { id: 'peanut', name: '花生', symbol: '🥜', tier: 0, category: '加工品' },
    { id: 'strawberry', name: '草莓', symbol: '🍓', tier: 0, category: '蔬菜' },
    { id: 'grape', name: '葡萄', symbol: '🍇', tier: 0, category: '蔬菜' },
    { id: 'scallion', name: '蔥', symbol: '🌿', tier: 0, category: '蔬菜' },
    { id: 'ginger', name: '薑', symbol: '🌿', tier: 0, category: '蔬菜' },
    { id: 'apple', name: '蘋果', symbol: '🍎', tier: 0, category: '蔬菜' },
    { id: 'mushroom', name: '蘑菇', symbol: '🍄', tier: 0, category: '蔬菜' },
    { id: 'honey', name: '蜂蜜', symbol: '🍯', tier: 0, category: '調味醬料' },
    { id: 'broccoli', name: '西蘭花', symbol: '🥦', tier: 0, category: '蔬菜' },
    { id: 'tofu', name: '豆腐', symbol: '⬜', tier: 0, category: '加工品' },
    { id: 'cheese', name: '起司', symbol: '🧀', tier: 0, category: '加工品' },
    { id: 'chili', name: '辣椒', symbol: '🌶️', tier: 0, category: '蔬菜' },
    { id: 'avocado', name: '酪梨', symbol: '🥑', tier: 0, category: '蔬菜' },
    { id: 'vinegar', name: '醋', symbol: '💧', tier: 0, category: '調味醬料' },
    { id: 'soy_sauce', name: '醬油', symbol: '💧', tier: 0, category: '調味醬料' },
    { id: 'egg', name: '雞蛋', symbol: '🥚', tier: 0, category: '肉類' },
    { id: 'cooking_oil', name: '食用油', symbol: '💧', tier: 0, category: '調味醬料' },
    { id: 'potato', name: '馬鈴薯', symbol: '🥔', tier: 0, category: '蔬菜' },
    { id: 'cabbage', name: '高麗菜', symbol: '🥬', tier: 0, category: '蔬菜' },
    { id: 'pineapple', name: '鳳梨', symbol: '🍍', tier: 0, category: '蔬菜' },
    { id: 'salt', name: '鹽', symbol: '🧂', tier: 0, category: '調味醬料' },
    { id: 'flour', name: '麵粉', symbol: '🌾', tier: 0, category: '加工品' },
    { id: 'sesame_oil', name: '麻油', symbol: '💧', tier: 0, category: '調味醬料' },
    { id: 'cucumber', name: '黃瓜', symbol: '🥒', tier: 0, category: '蔬菜' }
];

// T1 半成品
export const intermediateGoods = [
    { id: 'whipped_cream', name: '打發鮮奶油', symbol: '🍦', tier: 1 },
    { id: 'boiled_noodles', name: '水煮麵', symbol: '🍜', tier: 1 },
    { id: 'deep_fried_shrimp', name: '炸蝦仁', symbol: '🍤', tier: 1 },
    { id: 'grilled_fish', name: '烤魚排', symbol: '🐟', tier: 1 },
    { id: 'baked_bread', name: '烤麵包', symbol: '🍞', tier: 1 },
    { id: 'caramelized_onions', name: '焦糖洋蔥', symbol: '🧅', tier: 1 },
    { id: 'pan_fried_pork', name: '煎豬肉', symbol: '🥓', tier: 1 },
    { id: 'tomato_sauce', name: '番茄醬', symbol: '🥫', tier: 1 },
    { id: 'steamed_crab', name: '蒸螃蟹', symbol: '🦀', tier: 1 },
    { id: 'cheese_sauce', name: '起司醬', symbol: '🧀', tier: 1 },
    // 添加更多T1物品
    { id: 'beef_patty', name: '牛肉餅', symbol: '🍖', tier: 1 },
    { id: 'fried_egg', name: '煎蛋', symbol: '🍳', tier: 1 },
    { id: 'french_fries', name: '薯條', symbol: '🍟', tier: 1 },
    { id: 'cooked_rice', name: '熟飯', symbol: '🍚', tier: 1 },
    { id: 'grilled_chicken', name: '烤雞肉', symbol: '🍗', tier: 1 },
    { id: 'boiled_vegetables', name: '水煮蔬菜', symbol: '🥦', tier: 1 }
];

// T2 最終料理
export const finalDishes = [
    { id: 'seafood_pasta_with_tomato_sauce', name: '番茄海鮮義大利麵', symbol: '🍝', tier: 2, basePoints: 200 },
    { id: 'club_fish_sandwich', name: '總匯烤魚三明治', symbol: '🥪', tier: 2, basePoints: 170 },
    { id: 'deluxe_pork_burger', name: '豪華豬肉堡', symbol: '🍔', tier: 2, basePoints: 180 },
    // 添加更多T2物品
    { id: 'beef_burger', name: '牛肉漢堡', symbol: '🍔', tier: 2, basePoints: 150 },
    { id: 'fried_rice', name: '炒飯', symbol: '🍚', tier: 2, basePoints: 120 },
    { id: 'vegetable_salad', name: '蔬菜沙拉', symbol: '🥗', tier: 2, basePoints: 100 }
];

// 食譜列表
export const recipes = [
    // T1 食譜 - 只能使用T0食材
    { 
        id: 'whip_cream', 
        name: '打發鮮奶油', 
        method: 'pan_fry', 
        cookTime: 30,
        requirements: [{ itemId: 'milk', quantity: 1 }],
        outputId: 'whipped_cream'
    },
    { 
        id: 'boil_noodles', 
        name: '煮麵', 
        method: 'boil', 
        cookTime: 40,
        requirements: [{ itemId: 'noodles', quantity: 1 }],
        outputId: 'boiled_noodles'
    },
    { 
        id: 'deep_fry_shrimp', 
        name: '炸蝦', 
        method: 'deep_fry', 
        cookTime: 35,
        requirements: [{ itemId: 'raw_shrimp', quantity: 1 }],
        outputId: 'deep_fried_shrimp'
    },
    { 
        id: 'grill_fish', 
        name: '烤魚', 
        method: 'grill', 
        cookTime: 45,
        requirements: [{ itemId: 'raw_fish', quantity: 1 }],
        outputId: 'grilled_fish'
    },
    { 
        id: 'bake_bread', 
        name: '烤麵包', 
        method: 'grill', 
        cookTime: 40,
        requirements: [{ itemId: 'flour', quantity: 1 }],
        outputId: 'baked_bread'
    },
    { 
        id: 'caramelize_onions', 
        name: '焦糖洋蔥', 
        method: 'pan_fry', 
        cookTime: 25,
        requirements: [{ itemId: 'onion', quantity: 1 }],
        outputId: 'caramelized_onions'
    },
    { 
        id: 'pan_fry_pork', 
        name: '煎豬肉', 
        method: 'pan_fry', 
        cookTime: 35,
        requirements: [{ itemId: 'raw_pork', quantity: 1 }],
        outputId: 'pan_fried_pork'
    },
    { 
        id: 'make_tomato_sauce', 
        name: '製作番茄醬', 
        method: 'boil', 
        cookTime: 30,
        requirements: [{ itemId: 'tomato', quantity: 1 }],
        outputId: 'tomato_sauce'
    },
    { 
        id: 'steam_crab', 
        name: '蒸螃蟹', 
        method: 'boil', 
        cookTime: 40,
        requirements: [{ itemId: 'raw_crab', quantity: 1 }],
        outputId: 'steamed_crab'
    },
    { 
        id: 'make_cheese_sauce', 
        name: '製作起司醬', 
        method: 'pan_fry', 
        cookTime: 25,
        requirements: [{ itemId: 'cheese', quantity: 1 }],
        outputId: 'cheese_sauce'
    },
    { 
        id: 'cook_beef_patty', 
        name: '煎牛肉餅', 
        method: 'pan_fry', 
        cookTime: 30,
        requirements: [{ itemId: 'raw_beef', quantity: 1 }],
        outputId: 'beef_patty'
    },
    { 
        id: 'fry_egg', 
        name: '煎蛋', 
        method: 'pan_fry', 
        cookTime: 15,
        requirements: [{ itemId: 'egg', quantity: 1 }],
        outputId: 'fried_egg'
    },
    { 
        id: 'fry_potato', 
        name: '炸薯條', 
        method: 'deep_fry', 
        cookTime: 25,
        requirements: [{ itemId: 'potato', quantity: 1 }],
        outputId: 'french_fries'
    },
    { 
        id: 'cook_rice', 
        name: '煮飯', 
        method: 'boil', 
        cookTime: 30,
        requirements: [{ itemId: 'rice', quantity: 1 }],
        outputId: 'cooked_rice'
    },
    { 
        id: 'grill_chicken', 
        name: '烤雞肉', 
        method: 'grill', 
        cookTime: 35,
        requirements: [{ itemId: 'raw_chicken', quantity: 1 }],
        outputId: 'grilled_chicken'
    },
    { 
        id: 'boil_vegetables', 
        name: '水煮蔬菜', 
        method: 'boil', 
        cookTime: 20,
        requirements: [{ itemId: 'broccoli', quantity: 1 }],
        outputId: 'boiled_vegetables'
    },

    // T2 食譜 - 可以使用T1半成品和/或T0食材
    { 
        id: 'make_seafood_pasta', 
        name: '製作番茄海鮮義大利麵', 
        method: 'assembly', 
        cookTime: 20,
        requirements: [
            { itemId: 'boiled_noodles', quantity: 1 },
            { itemId: 'tomato_sauce', quantity: 1 },
            { itemId: 'deep_fried_shrimp', quantity: 1 }
        ],
        outputId: 'seafood_pasta_with_tomato_sauce'
    },
    { 
        id: 'make_fish_sandwich', 
        name: '製作總匯烤魚三明治', 
        method: 'assembly', 
        cookTime: 15,
        requirements: [
            { itemId: 'grilled_fish', quantity: 1 },
            { itemId: 'baked_bread', quantity: 1 },
            { itemId: 'lettuce', quantity: 1 }
        ],
        outputId: 'club_fish_sandwich'
    },
    { 
        id: 'make_pork_burger', 
        name: '製作豪華豬肉堡', 
        method: 'assembly', 
        cookTime: 15,
        requirements: [
            { itemId: 'pan_fried_pork', quantity: 1 },
            { itemId: 'baked_bread', quantity: 1 },
            { itemId: 'cheese_sauce', quantity: 1 }
        ],
        outputId: 'deluxe_pork_burger'
    },
    { 
        id: 'make_beef_burger', 
        name: '製作牛肉漢堡', 
        method: 'assembly', 
        cookTime: 15,
        requirements: [
            { itemId: 'beef_patty', quantity: 1 },
            { itemId: 'baked_bread', quantity: 1 },
            { itemId: 'lettuce', quantity: 1 }
        ],
        outputId: 'beef_burger'
    },
    { 
        id: 'make_fried_rice', 
        name: '製作炒飯', 
        method: 'assembly', 
        cookTime: 20,
        requirements: [
            { itemId: 'cooked_rice', quantity: 1 },
            { itemId: 'fried_egg', quantity: 1 },
            { itemId: 'scallion', quantity: 1 }
        ],
        outputId: 'fried_rice'
    },
    { 
        id: 'make_vegetable_salad', 
        name: '製作蔬菜沙拉', 
        method: 'assembly', 
        cookTime: 10,
        requirements: [
            { itemId: 'lettuce', quantity: 1 },
            { itemId: 'tomato', quantity: 1 },
            { itemId: 'cucumber', quantity: 1 }
        ],
        outputId: 'vegetable_salad'
    }
];