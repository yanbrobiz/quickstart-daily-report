/**
 * 使用 GAS Web App 寫入 Google Sheets（免設定 API）
 */

/**
 * 將數據發送到 Google Apps Script Web App
 * @param {string} webAppUrl - GAS Web App 的 URL
 * @param {object} data - 要寫入的數據 { date, totalRevenue, uberEatsRevenue }
 */
async function sendToGoogleSheets(webAppUrl, data) {
    console.log('📝 發送資料到 Google Sheets...');

    try {
        const response = await fetch(webAppUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            redirect: 'follow'
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ 資料已成功寫入 Google Sheets');
        } else {
            console.error('❌ 寫入失敗:', result.error);
        }

        return result;
    } catch (error) {
        console.error('❌ 發送失敗:', error.message);
        throw error;
    }
}

module.exports = { sendToGoogleSheets };
