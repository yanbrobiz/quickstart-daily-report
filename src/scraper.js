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
    // 等待頁面核心元素載入
    await page.waitForSelector('.el-main', { timeout: 30000 });
    await delay(2000);

    // 3. 選擇店家
    console.log(`🏪 選擇店家: ${SHOP_NAME}...`);

    // 3a. 點擊店家下拉選單 (使用 placeholder 定位)
    const dropdownSelector = "input[placeholder='(搜尋店家)']";
    await page.waitForSelector(dropdownSelector, { timeout: 10000 });
    await page.click(dropdownSelector);
    await delay(1000); // 等待下拉選單動畫

    // 3b. 選擇特定店家 (使用 XPath 定位含有特定文字的 li)
    const shopOptionXPath = `//li[.//span[contains(text(), '${SHOP_NAME}')]]`;
    await page.waitForXPath(shopOptionXPath, { timeout: 10000 });
    const [shopOption] = await page.$x(shopOptionXPath);

    if (shopOption) {
      await shopOption.click();
      console.log('✅ 已點擊店家選項');
    } else {
      throw new Error(`找不到店家: ${SHOP_NAME}`);
    }

    await delay(3000); // 等待資料刷新

    // 4. 點擊「昨日」按鈕
    console.log('📅 點擊昨日按鈕...');
    // 使用更精確的 XPath 尋找按鈕文字
    const yesterdayBtnXPath = "//button[contains(., '昨日')] | //div[contains(@class, 'el-radio-button')]/span[contains(., '昨日')]";
    await page.waitForXPath(yesterdayBtnXPath, { timeout: 10000 });
    const [yesterdayBtn] = await page.$x(yesterdayBtnXPath);

    if (yesterdayBtn) {
      await yesterdayBtn.click();
    } else {
      // Fallback: 遍歷查找 (保留原本的邏輯作為備案)
      await page.evaluate(() => {
        const elements = document.querySelectorAll('button, div, span');
        for (const el of elements) {
          if (el.textContent && el.textContent.trim() === '昨日') {
            el.click();
            break;
          }
        }
      });
    }

    await delay(5000); // 等待資料完全載入

    // 5. 抓取數據
    console.log('💰 抓取營業數據...');

    const data = await page.evaluate(() => {
      const result = {
        totalRevenue: 0,
        uberEatsRevenue: 0
      };

      const bodyText = document.body.innerText;

      // 方法1: 找總營業額 (通常是頁面上最大的金額)
      // 排除掉可能是日期的數字 (例如 2026) 和過小的數字
      const moneyMatches = bodyText.match(/\$[\d,]+/g);
      if (moneyMatches) {
        const values = moneyMatches
          .map(m => parseInt(m.replace(/[$,]/g, '')))
          .filter(v => v > 100); // 過濾掉太小的數字

        if (values.length > 0) {
          result.totalRevenue = Math.max(...values);
        }
      }

      // 如果方法1失敗，嘗試查找 "總營業額" 關鍵字附近的數字
      if (result.totalRevenue === 0) {
        const blocks = document.querySelectorAll('div, .card-panel-num');
        for (const block of blocks) {
          if (block.innerText.includes('總營業額')) {
            // 嘗試在該元素的父層或本身找數字
            const numMatch = (block.innerText + block.parentElement?.innerText).match(/\$?([\d,]+)/);
            if (numMatch) {
              const val = parseInt(numMatch[1].replace(/,/g, ''));
              if (val > result.totalRevenue) result.totalRevenue = val;
            }
          }
        }
      }

      // 方法2: 尋找 Uber Eats 相關的營業額
      const lines = bodyText.split('\n');
      for (const line of lines) {
        if (line.includes('Uber') && line.includes('Eats')) {
          const match = line.match(/\$?([\d,]+)/g);
          if (match && match.length > 0) {
            const nums = match.map(m => parseInt(m.replace(/[$,]/g, '')));
            // 取最後一個合理的數字
            for (let i = nums.length - 1; i >= 0; i--) {
              if (nums[i] > 0 && nums[i] < 100000) {
                result.uberEatsRevenue = nums[i];
                break;
              }
            }
          }
        }
      }

      return result;
    });

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
