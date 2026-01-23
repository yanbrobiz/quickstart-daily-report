/**
 * 測試 GAS Web App 連線
 * 執行: node test-gas.js
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwyRMAoMwdGfN1IPdl205fFT_5H5wC4AKKGn1CzIuuvXERdwVlGQ-WtmLDmrriRAjPD1g/exec';

const testData = {
    date: '2026-01-22',
    totalRevenue: 10346,
    uberEatsRevenue: 1751
};

async function testGAS() {
    console.log('📤 發送測試資料到 GAS...');
    console.log('Data:', JSON.stringify(testData, null, 2));

    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData),
            redirect: 'follow'
        });

        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Response:', text);

        if (response.ok) {
            console.log('✅ 測試成功！請檢查 Google Sheets 是否有新增資料');
        } else {
            console.log('❌ 測試失敗');
        }
    } catch (error) {
        console.error('❌ 錯誤:', error.message);
    }
}

testGAS();
