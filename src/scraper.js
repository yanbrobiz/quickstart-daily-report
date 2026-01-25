const puppeteer = require('puppeteer');

const LOGIN_URL = 'https://app.quickclick.cc/console/eaa-login';
const STAT_URL = 'https://app.quickclick.cc/console/summary/stat';

// Helper function for delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 抓取 QuickClick 後台的當日營業數據
 * 於每天 23:00 執行，抓取當日 00:00~23:00 的數據
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

    // 2. 導航到營業概況頁面 (登入後預設就是今日數據)
    console.log('📊 前往營業概況頁面...');
    await page.goto(STAT_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await delay(5000); // 等待頁面完全載入

    // 3. 抓取數據 (頁面預設顯示今日 00:00~23:00 的數據)
    console.log('💰 抓取營業數據...');

    const data = await page.evaluate(() => {
      const result = {
        totalRevenue: 0,
        uberEatsRevenue: 0,
        displayedDate: null
      };

      const bodyText = document.body.innerText;

      // 從頁面抓取日期 (格式: 2026-01-25 12:00AM ~ 2026-01-25 10:45PM)
      const dateMatch = bodyText.match(/(\d{4}-\d{2}-\d{2})\s+\d{1,2}:\d{2}[AP]M\s*~\s*\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        result.displayedDate = dateMatch[1];
      }

      // 抓取總營業額 (頁面上第一個大金額，在「營業額」標籤下)
      // 找所有 $ 開頭的金額
      const moneyMatches = bodyText.match(/\$[\d,]+/g);
      if (moneyMatches) {
        const values = moneyMatches
          .map(m => parseInt(m.replace(/[$,]/g, '')))
          .filter(v => v > 100);

        if (values.length > 0) {
          // 第一個較大的金額通常是總營業額
          result.totalRevenue = values[0];
        }
      }

      // 抓取 Uber Eats 營業額
      // 頁面結構: "Uber Eats" 文字後面跟著金額
      const lines = bodyText.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('Uber') && line.includes('Eats')) {
          // 檢查同一行或下一行是否有金額
          const combinedText = line + ' ' + (lines[i + 1] || '');
          const match = combinedText.match(/\$?([\d,]+)/);
          if (match) {
            const val = parseInt(match[1].replace(/,/g, ''));
            if (val > 0 && val < result.totalRevenue) {
              result.uberEatsRevenue = val;
              break;
            }
          }
        }
      }

      // Fallback: 用更精確的方式找 Uber Eats 金額
      if (result.uberEatsRevenue === 0) {
        // 尋找包含 Uber Eats 的區塊
        const allElements = document.querySelectorAll('div, span, td');
        for (const el of allElements) {
          const text = el.textContent || '';
          if (text.includes('Uber') && text.includes('Eats') && text.includes('$')) {
            const match = text.match(/\$([\d,]+)/);
            if (match) {
              result.uberEatsRevenue = parseInt(match[1].replace(/,/g, ''));
              break;
            }
          }
        }
      }

      return result;
    });

    // 優先使用網站顯示的日期，若抓不到才用本地計算
    let dateStr = data.displayedDate;

    if (!dateStr) {
      console.log('⚠️ 無法從網站抓取日期，使用本地計算...');
      // 計算當日日期 (使用台灣時區 UTC+8)
      const now = new Date();
      const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
      dateStr = taiwanTime.toISOString().split('T')[0];
    } else {
      console.log(`✅ 從網站抓取到日期: ${dateStr}`);
    }

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
