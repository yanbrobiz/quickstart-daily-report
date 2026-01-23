require('dotenv').config();
const { scrapeReport } = require('./src/scraper');

async function test() {
    console.log('🧪 開始測試爬蟲修復...');

    const username = process.env.QC_USERNAME;
    const password = process.env.QC_PASSWORD;

    if (!username || !password) {
        console.error('❌ 請確認 .env 檔案中已設定 QC_USERNAME 和 QC_PASSWORD');
        process.exit(1);
    }

    try {
        const data = await scrapeReport(username, password);
        console.log('✅ 測試完成！抓取到的數據：');
        console.log(JSON.stringify(data, null, 2));

        if (data.totalRevenue > 0) {
            console.log('✨ 成功抓取到營業額！修復有效。');
        } else {
            console.log('⚠️ 營業額仍為 0，可能需要再次檢查（或昨日確實無營業）。');
        }
    } catch (error) {
        console.error('❌ 測試失敗:', error);
    }
}

test();
