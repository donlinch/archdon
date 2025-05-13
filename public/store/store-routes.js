const express = require('express');
const router = express.Router();
const storeDb = require('./store-db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

 

// 配置文件上傳
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        // 使用與 store API 路徑匹配的目錄
        const uploadDir = path.join(__dirname, 'public/uploads/storemarket');
        // 確保目錄存在
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        // 生成唯一文件名
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 限制 5MB
    fileFilter: function(req, file, cb) {
        // 只接受圖片文件
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) { // 使用 i 忽略大小寫
            return cb(new Error('只能上傳圖片文件 (jpg, jpeg, png, gif)!'), false);
        }
        cb(null, true);
    }
});

// 初始化商店數據庫 (可選，用於測試)
// router.get('/init', async (req, res) => {
//     try {
//         await storeDb.initStoreDatabase();
//         res.json({ message: '商店數據庫初始化成功' });
//     } catch (err) {
//         console.error('初始化商店數據庫失敗:', err);
//         res.status(500).json({ error: '初始化失敗', details: err.message });
//     }
// });

// 獲取所有商品
router.get('/products', async (req, res) => {
    try {
        const category = req.query.category;
        const products = await storeDb.getAllProducts(category);
        res.json(products);
    } catch (err) {
        console.error('[Store Routes] 獲取商品列表失敗:', err);
        res.status(500).json({ error: '獲取商品列表失敗', details: err.message });
    }
});

// 獲取單個商品
router.get('/products/:id', async (req, res) => {
    try {
        // 驗證 ID 是否為數字
        const productId = parseInt(req.params.id);
        if (isNaN(productId)) {
            return res.status(400).json({ error: '無效的商品 ID' });
        }
        const product = await storeDb.getProductById(productId);
        if (!product) {
            return res.status(404).json({ error: '商品不存在' });
        }
        res.json(product);
    } catch (err) {
        console.error('[Store Routes] 獲取商品詳情失敗:', err);
        res.status(500).json({ error: '獲取商品詳情失敗', details: err.message });
    }
});

// 創建商品 (使用 upload.single('image') 來處理單個圖片上傳)
router.post('/products', upload.single('image'), async (req, res) => {
    try {
        const { name, description, price, stock, category } = req.body;

        if (!name || !price) {
            // 如果缺少必要字段，刪除可能已上傳的文件
            if (req.file) {
                 fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ error: '商品名稱和價格為必填項' });
        }

        // 獲取上傳的圖片相對路徑 (相對於 public 目錄)
        const imagePath = req.file ? `/uploads/storemarket/${req.file.filename}` : null;

        const productData = {
            name,
            description,
            price: parseFloat(price),
            image: imagePath,
            stock: parseInt(stock || 0),
            category
        };

        const newProduct = await storeDb.createProduct(productData);
        res.status(201).json(newProduct);
    } catch (err) {
        console.error('[Store Routes] 創建商品失敗:', err);
        // 如果創建失敗，刪除已上傳的文件
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkErr) {
                console.error('[Store Routes] 刪除上傳文件失敗:', unlinkErr);
            }
        }
        res.status(500).json({ error: '創建商品失敗', details: err.message });
    }
});


// 更新商品 (同樣處理圖片上傳)
router.put('/products/:id', upload.single('image'), async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        if (isNaN(productId)) {
            // 如果ID無效，刪除可能已上傳的文件
            if (req.file) {
                 fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ error: '無效的商品 ID' });
        }

        const { name, description, price, stock, category } = req.body;

        // 先獲取現有商品
        const existingProduct = await storeDb.getProductById(productId);
        if (!existingProduct) {
            // 如果商品不存在，刪除已上傳的文件
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(404).json({ error: '商品不存在' });
        }

        let imagePath = existingProduct.image;
        // 如果有新文件上傳
        if (req.file) {
            // 刪除舊圖片（如果存在且在指定目錄下）
            if (existingProduct.image && existingProduct.image.startsWith('/uploads/storemarket/')) {
                const oldImagePath = path.join(__dirname, 'public', existingProduct.image);
                 if (fs.existsSync(oldImagePath)) {
                     try {
                         fs.unlinkSync(oldImagePath);
                         console.log('[Store Routes] 刪除舊圖片:', oldImagePath);
                     } catch (unlinkErr) {
                         console.error('[Store Routes] 刪除舊圖片失敗:', unlinkErr);
                     }
                 }
            }
            // 更新為新圖片的路徑
            imagePath = `/uploads/storemarket/${req.file.filename}`;
        }

        const productData = {
            name: name !== undefined ? name : existingProduct.name,
            description: description !== undefined ? description : existingProduct.description,
            price: price !== undefined ? parseFloat(price) : existingProduct.price,
            image: imagePath,
            stock: stock !== undefined ? parseInt(stock) : existingProduct.stock,
            category: category !== undefined ? category : existingProduct.category
        };

        const updatedProduct = await storeDb.updateProduct(productId, productData);
        if (!updatedProduct) {
             // 如果更新失敗但有新文件，理論上不太可能，但還是處理一下
             if (req.file && imagePath === `/uploads/storemarket/${req.file.filename}`) {
                 fs.unlinkSync(req.file.path);
             }
             return res.status(500).json({ error: '更新商品失敗' });
        }
        res.json(updatedProduct);
    } catch (err) {
        console.error('[Store Routes] 更新商品失敗:', err);
         // 如果更新失敗，刪除已上傳的文件
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkErr) {
                 console.error('[Store Routes] 刪除上傳文件失敗:', unlinkErr);
            }
        }
        res.status(500).json({ error: '更新商品失敗', details: err.message });
    }
});


// 刪除商品
router.delete('/products/:id', async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        if (isNaN(productId)) {
            return res.status(400).json({ error: '無效的商品 ID' });
        }

        const product = await storeDb.getProductById(productId);
        if (!product) {
            return res.status(404).json({ error: '商品不存在' });
        }

        // 刪除商品圖片文件（如果存在且在指定目錄下）
        if (product.image && product.image.startsWith('/uploads/storemarket/')) {
            const imagePath = path.join(__dirname, 'public', product.image);
            if (fs.existsSync(imagePath)) {
                 try {
                     fs.unlinkSync(imagePath);
                     console.log('[Store Routes] 刪除商品圖片:', imagePath);
                 } catch (unlinkErr) {
                     console.error('[Store Routes] 刪除商品圖片失敗:', unlinkErr);
                 }
            }
        }

        const deleted = await storeDb.deleteProduct(productId);
        if (deleted) {
            res.status(204).send(); // 成功刪除，無內容返回
        } else {
            // 理論上如果前面找到了商品，這裡應該能刪除，除非並發問題
            res.status(500).json({ error: '刪除商品失敗' });
        }
    } catch (err) {
        console.error('[Store Routes] 刪除商品失敗:', err);
        res.status(500).json({ error: '刪除商品失敗', details: err.message });
    }
});

// 獲取所有類別
router.get('/categories', async (req, res) => {
    try {
        const categories = await storeDb.getAllCategories();
        res.json(categories);
    } catch (err) {
        console.error('[Store Routes] 獲取類別列表失敗:', err);
        res.status(500).json({ error: '獲取類別列表失敗', details: err.message });
    }
});

module.exports = router;
