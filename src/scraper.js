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

    // 先輸出頁面文字內容供除錯
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('📄 頁面文字內容 (前 1500 字):');
    console.log(pageText.substring(0, 1500));
    console.log('--- 頁面內容結束 ---');

    const data = await page.evaluate(() => {
      const result = {
        totalRevenue: 0,
        uberEatsRevenue: 0,
        displayedDate: null,
        debug: {}
      };

      const bodyText = document.body.innerText;

      // 從頁面抓取日期
      const datePatterns = [
        /(\d{4}-\d{2}-\d{2})\s+\d{1,2}:\d{2}\s*[AP]M/i,
        /(\d{4}-\d{2}-\d{2})/,
        /(\d{4}\/\d{2}\/\d{2})/,  // 支援 2026/01/25 格式
      ];
      for (const pattern of datePatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          result.displayedDate = match[1].replace(/\//g, '-');
          break;
        }
      }

      // 抓取總營業額 - 嘗試多種格式
      // 格式1: $1,234
      let moneyMatches = bodyText.match(/\$[\d,]+/g);
      // 格式2: NT$1,234 或 NT$ 1,234
      if (!moneyMatches || moneyMatches.length === 0) {
        moneyMatches = bodyText.match(/NT\$?\s*[\d,]+/gi);
      }
      // 格式3: 純數字（找營業額附近的數字）
      if (!moneyMatches || moneyMatches.length === 0) {
        // 找「營業額」後面的數字
        const revenueMatch = bodyText.match(/營業額[^\d]*?([\d,]+)/);
        if (revenueMatch) {
          moneyMatches = [revenueMatch[1]];
        }
      }

      result.debug.moneyMatches = moneyMatches;

      if (moneyMatches && moneyMatches.length > 0) {
        const values = moneyMatches
          .map(m => parseInt(m.replace(/[^\d]/g, '')))
          .filter(v => v > 100);

        result.debug.parsedValues = values;

        if (values.length > 0) {
          result.totalRevenue = Math.max(...values); // 取最大值作為總營業額
        }
      }

      // 抓取 Uber Eats 營業額
      // 方法1: 找包含 ubereats 圖片的容器
      const images = document.querySelectorAll('img');
      for (const img of images) {
        const src = (img.src || '').toLowerCase();
        const alt = (img.alt || '').toLowerCase();
        if (src.includes('ubereats') || src.includes('uber-eats') || src.includes('uber_eats') ||
            alt.includes('ubereats') || alt.includes('uber')) {
          let parent = img.parentElement;
          for (let i = 0; i < 8 && parent; i++) {
            const text = parent.textContent || '';
            // 嘗試多種金額格式
            let match = text.match(/\$([\d,]+)/);
            if (!match) match = text.match(/NT\$?\s*([\d,]+)/i);
            if (!match) match = text.match(/([\d,]{3,})/); // 至少3位數字
            if (match) {
              const val = parseInt(match[1].replace(/,/g, ''));
              if (val > 0) {
                result.uberEatsRevenue = val;
                break;
              }
            }
            parent = parent.parentElement;
          }
          if (result.uberEatsRevenue > 0) break;
        }
      }

      // 方法2: 找包含 "Uber" 文字的行
      if (result.uberEatsRevenue === 0) {
        const lines = bodyText.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.toLowerCase().includes('uber')) {
            const context = lines.slice(Math.max(0, i - 2), i + 4).join(' ');
            let match = context.match(/\$([\d,]+)/);
            if (!match) match = context.match(/NT\$?\s*([\d,]+)/i);
            if (!match) match = context.match(/([\d,]{3,})/);
            if (match) {
              const val = parseInt(match[1].replace(/,/g, ''));
              if (val > 0) {
                result.uberEatsRevenue = val;
                break;
              }
            }
          }
        }
      }

      return result;
    });

    console.log('🔍 除錯資訊:', JSON.stringify(data.debug, null, 2));

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
