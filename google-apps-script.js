/**
 * QuickClick 每日報表 - Google Apps Script
 * 
 * 使用步驟：
 * 1. 在 Google Sheets 中，點擊「擴充功能」→「Apps Script」
 * 2. 把這段程式碼貼進去（取代原有內容）
 * 3. 點擊「部署」→「新增部署」（或管理部署→編輯→新版本）
 * 4. 選擇「網頁應用程式」
 * 5. 「擁有權限者」選「任何人」
 * 6. 點擊「部署」並授權
 * 7. 複製產生的網址
 */

// 處理 GET 請求（用於測試）
function doGet(e) {
    return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', message: 'GAS is working!' }))
        .setMimeType(ContentService.MimeType.JSON);
}

// 處理 POST 請求
function doPost(e) {
    try {
        // 解析傳入的 JSON 資料
        const data = JSON.parse(e.postData.contents);

        // 取得當前試算表的第一個工作表
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

        // 檢查是否有標題列，如果沒有就新增
        if (sheet.getLastRow() === 0) {
            sheet.appendRow(['日期', '總營業額', 'UberEats營業額']);
        }

        // 新增資料列
        sheet.appendRow([
            data.date,
            data.totalRevenue,
            data.uberEatsRevenue
        ]);

        // 回傳成功訊息
        return ContentService
            .createTextOutput(JSON.stringify({ success: true, message: '資料已寫入' }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        // 回傳錯誤訊息
        return ContentService
            .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

// 測試用函數 - 在 Apps Script 編輯器中執行
function testAppend() {
    const testData = {
        date: '2026-01-22',
        totalRevenue: 10346,
        uberEatsRevenue: 1751
    };

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    if (sheet.getLastRow() === 0) {
        sheet.appendRow(['日期', '總營業額', 'UberEats營業額']);
    }

    sheet.appendRow([testData.date, testData.totalRevenue, testData.uberEatsRevenue]);

    Logger.log('測試資料已寫入!');
}
