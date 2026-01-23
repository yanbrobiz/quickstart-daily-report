const puppeteer = require('puppeteer');

const LOGIN_URL = 'https://app.quickclick.cc/console/eaa-login';
const SHOP_STAT_URL = 'https://app.quickclick.cc/console/summary/shop-stat';
const SHOP_NAME = '天心坊湯包虎林店';

// Helper function for delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 抓取 QuickClick 後台的昨日營業數據
 * @param {string} username - 登入帳號
 * @param {string} password - 登入密碼
 * @returns {Promise<{date: string, totalRevenue: number, uberEatsRevenue: number}>}
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
    await page.setViewport({ width: 1280, height: 800 });

    // 1. 登入
    console.log('🔐 登入中...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // 等待登入表單載入
    await page.waitForSelector('input[name="username"]', { timeout: 30000 });

    // 輸入帳號密碼
    await page.type('input[name="username"]', username, { delay: 50 });
    await page.type('input[name="password"]', password, { delay: 50 });

    // 點擊登入按鈕
    await page.click('button[type="submit"]');

    // 等待登入完成
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
    console.log('✅ 登入成功');

    // 2. 導航到店家報表頁面
    console.log('📊 前往店家報表頁面...');
    await page.goto(SHOP_STAT_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await delay(2000);

    // 3. 選擇店家
    console.log(`🏪 選擇店家: ${SHOP_NAME}...`);

    // 點擊店家選單
    const shopDropdown = await page.$('div[class*="select"]') || await page.$('button[class*="dropdown"]');
    if (shopDropdown) {
      await shopDropdown.click();
      await delay(1000);
    }

    // 選擇店家
    await page.evaluate((shopName) => {
      const elements = document.querySelectorAll('div, li, span, option');
      for (const el of elements) {
        if (el.textContent && el.textContent.includes(shopName)) {
          el.click();
          break;
        }
      }
    }, SHOP_NAME);
    await delay(2000);

    // 4. 點擊「昨日」按鈕
    console.log('📅 點擊昨日按鈕...');
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, div[class*="btn"], span');
      for (const btn of buttons) {
        if (btn.textContent && btn.textContent.trim() === '昨日') {
          btn.click();
          break;
        }
      }
    });
    await delay(3000);

    // 5. 抓取數據
    console.log('💰 抓取營業數據...');

    const data = await page.evaluate(() => {
      const result = {
        totalRevenue: 0,
        uberEatsRevenue: 0
      };

      // 方法1: 尋找包含 "總營業額" 文字的元素，取其相鄰的數值
      const allDivs = Array.from(document.querySelectorAll('div, span, h3'));
      for (const el of allDivs) {
        const text = el.innerText || '';

        // 總營業額 - 找到標籤後取父元素中的金額
        if (text.trim() === '總營業額') {
          const parent = el.closest('div');
          if (parent) {
            const valueMatch = parent.innerText.match(/\$?([\d,]+)/);
            if (valueMatch) {
              result.totalRevenue = parseInt(valueMatch[1].replace(/,/g, ''));
            }
          }
        }
      }

      // 方法2: 尋找 Uber Eats 營業額
      const allElements = Array.from(document.querySelectorAll('div, tr, td'));
      for (const el of allElements) {
        const text = el.innerText || '';
        if (text.includes('Uber') && text.includes('Eats')) {
          // 找到包含金額的子元素
          const matches = text.match(/\$?([\d,]+)/g);
          if (matches && matches.length > 0) {
            // 取最後一個匹配（通常是營業額）
            const lastMatch = matches[matches.length - 1];
            result.uberEatsRevenue = parseInt(lastMatch.replace(/[,$]/g, ''));
          }
        }
      }

      // 備用方法: 如果找不到總營業額，嘗試找 info-title 類別
      if (result.totalRevenue === 0) {
        const infoTitles = document.querySelectorAll('h3.info-title, .info-title');
        if (infoTitles.length > 0) {
          const firstValue = infoTitles[0].innerText;
          const match = firstValue.match(/\$?([\d,]+)/);
          if (match) {
            result.totalRevenue = parseInt(match[1].replace(/,/g, ''));
          }
        }
      }

      return result;
    });

    // 計算昨日日期
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

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
