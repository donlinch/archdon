const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // 連線字串
  ssl: { rejectUnauthorized: false },
});

async function testInsert() {
  try {
    await pool.query(
      `INSERT INTO guestbook_messages (author_name, content, created_at, updated_at, is_visible, like_count)
       VALUES ($1, $2, NOW(), NOW(), true, 0)`,
      ['測試人員', '這是一筆測試留言'] // 你可以換成自己想測試的內容
    );
    console.log("✅ 寫入成功！");
  } catch (err) {
    console.error("❌ 寫入失敗：", err);
  } finally {
    pool.end();
  }
}

testInsert();
