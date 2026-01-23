require('dotenv').config();
const { scrapeReport } = require('./scraper');
const { sendToGoogleSheets } = require('./googleSheets');

async function main() {
    console.log('🚀 QuickClick 每日報表自動化開始執行');
    console.log(`📅 執行時間: ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`);

    // 從環境變數讀取設定
    const username = process.env.QC_USERNAME;
    const password = process.env.QC_PASSWORD;
    const gasWebAppUrl = process.env.GAS_WEB_APP_URL;

    // 驗證必要的環境變數
    if (!username || !password) {
        console.error('❌ 錯誤: 請設定 QC_USERNAME 和 QC_PASSWORD 環境變數');
        process.exit(1);
    }

    try {
        // 1. 抓取報表數據
        console.log('\n--- 步驟 1: 抓取網頁數據 ---');
        const data = await scrapeReport(username, password);
        console.log('📊 抓取結果:', data);

        // 2. 寫入 Google Sheets
        if (gasWebAppUrl) {
            console.log('\n--- 步驟 2: 寫入 Google Sheets ---');
            await sendToGoogleSheets(gasWebAppUrl, data);
        } else {
            console.log('\n⚠️ 未設定 GAS_WEB_APP_URL，跳過 Google Sheets 寫入');
            console.log('📋 抓取的數據:', JSON.stringify(data, null, 2));
        }

        console.log('\n✅ 執行完成!');
    } catch (error) {
        console.error('\n❌ 執行失敗:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
