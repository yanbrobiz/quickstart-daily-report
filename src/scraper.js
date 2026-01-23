const puppeteer = require('puppeteer');

const LOGIN_URL = 'https://app.quickclick.cc/console/eaa-login';
const SHOP_STAT_URL = 'https://app.quickclick.cc/console/summary/shop-stat';
const SHOP_NAME = '天心坊湯包虎林店';

// Helper function for delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 抓取 QuickClick 後台的昨日營業數據
 */
async function scrapeReport(username, password) {
  console.log('🚀 啟動瀏覽器...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();

    // 設定 User-Agent 偽裝成桌面瀏覽器
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    // 1. 登入
    console.log('🔐 登入中...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('input[name="username"]', { timeout: 30000 });
    await page.type('input[name="username"]', username, { delay: 50 });
    await page.type('input[name="password"]', password, { delay: 50 });
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
    console.log('✅ 登入成功');

    // 2. 導航到店家報表頁面
    console.log('📊 前往店家報表頁面...');
    await page.goto(SHOP_STAT_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await delay(3000); // 增加等待時間

    // 3. 選擇店家
    console.log(`🏪 選擇店家: ${SHOP_NAME}...`);

    // 點擊店家下拉選單
    await page.evaluate((shopName) => {
      // 找到包含 "搜尋店家" 或店家選擇器的元素
      const selectors = document.querySelectorAll('div[class*="select"], button, input');
      for (const el of selectors) {
        if (el.textContent && (el.textContent.includes('搜尋店家') || el.textContent.includes('選擇'))) {
          el.click();
          break;
        }
      }
    });
    await delay(1500);

    // 選擇特定店家
    await page.evaluate((shopName) => {
      const elements = document.querySelectorAll('div, li, span, option');
      for (const el of elements) {
        if (el.textContent && el.textContent.trim().includes(shopName)) {
          el.click();
          break;
        }
      }
    }, SHOP_NAME);
    await delay(3000); // 等待資料載入

    // 4. 點擊「昨日」按鈕
    console.log('📅 點擊昨日按鈕...');
    await page.evaluate(() => {
      const elements = document.querySelectorAll('button, div, span');
      for (const el of elements) {
        if (el.textContent && el.textContent.trim() === '昨日') {
          el.click();
          break;
        }
      }
    });
    await delay(5000); // 增加等待時間，讓資料完全載入

    // 5. 抓取數據
    console.log('💰 抓取營業數據...');

    // 先截圖 debug
    const pageContent = await page.content();
    console.log('📄 頁面長度:', pageContent.length);

    const data = await page.evaluate(() => {
      const result = {
        totalRevenue: 0,
        uberEatsRevenue: 0,
        debug: []
      };

      // 方法1: 找所有包含 $ 符號的元素
      const allText = document.body.innerText;
      result.debug.push('頁面文字內容(前500字): ' + allText.substring(0, 500).replace(/\n/g, ' '));

      // 找總營業額 - 通常是最大的金額數字
      const moneyMatches = allText.match(/\$[\d,]+/g);
      if (moneyMatches) {
        result.debug.push('找到金額數量: ' + moneyMatches.length);
        // 轉換並找最大值
        const values = moneyMatches.map(m => parseInt(m.replace(/[$,]/g, '')));
        result.totalRevenue = Math.max(...values);
      }

      // 方法2: 尋找 Uber Eats 相關的營業額
      const bodyText = document.body.innerText;
      const lines = bodyText.split('\n');
      for (const line of lines) {
        if (line.includes('Uber') && line.includes('Eats')) {
          const match = line.match(/\$?([\d,]+)/g);
          if (match && match.length > 0) {
            // 取數字部分
            const nums = match.map(m => parseInt(m.replace(/[$,]/g, '')));
            // 取最後一個非零數字（通常是營業額）
            for (let i = nums.length - 1; i >= 0; i--) {
              if (nums[i] > 0 && nums[i] < 100000) {
                result.uberEatsRevenue = nums[i];
                break;
              }
            }
          }
        }
      }

      // 方法3: 如果還是找不到總營業額，用更精確的方式
      if (result.totalRevenue === 0) {
        const divs = document.querySelectorAll('div, h3, span');
        for (const div of divs) {
          const text = div.innerText || '';
          if (text.includes('總營業額')) {
            const parent = div.parentElement;
            if (parent) {
              const match = parent.innerText.match(/\$?([\d,]+)/);
              if (match) {
                result.totalRevenue = parseInt(match[1].replace(/,/g, ''));
              }
            }
          }
        }
      }

      return result;
    });

    // 輸出 debug 資訊
    if (data.debug) {
      data.debug.forEach(d => console.log('🔍', d));
      delete data.debug;
    }

    // 計算昨日日期
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    console.log(`📈 數據: 日期=${dateStr}, 總營業額=${data.totalRevenue}, UberEats=${data.uberEatsRevenue}`);

    return {
      date: dateStr,
      totalRevenue: data.totalRevenue,
      uberEatsRevenue: data.uberEatsRevenue
    };

  } finally {
    await browser.close();
    console.log('🏁 瀏覽器已關閉');
  }
}

module.exports = { scrapeReport };
