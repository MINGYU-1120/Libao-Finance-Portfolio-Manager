/**
 * convertHistoricalTrades.js
 *
 * 將簡化版歷史交易表格轉換為系統可匯入的 CSV 格式。
 *
 * 使用方式：
 *   node scripts/convertHistoricalTrades.js <輸入CSV> <倉位預計投入金額> [倉位名稱] [市場]
 *
 * 範例：
 *   node scripts/convertHistoricalTrades.js scripts/c_trades_raw.csv 2000000 "C倉(2022年長線)" TW
 *
 * 輸入 CSV 格式（用逗號分隔，第一行為 header）：
 *   日期,代號,股名,買入事件,買入價格,賣出事件,賣出價格
 *
 *   - 買入事件：例如 "新增5%", "加碼2.5%"（BUY）
 *   - 賣出事件：例如 "減碼3.67%"（SELL）
 *   - 每行只能有買入或賣出其中一種
 *   - 價格欄位的 $ 符號和逗號會自動移除
 *
 * 股數計算邏輯：
 *   股數 = floor(預計投入 × 比例% ÷ 價格)
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CLI Arguments
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

if (args.length < 2) {
    console.error('用法: node scripts/convertHistoricalTrades.js <輸入CSV> <預計投入金額> [倉位名稱] [市場]');
    console.error('範例: node scripts/convertHistoricalTrades.js scripts/c_trades_raw.csv 2000000 "C倉(2022年長線)" TW');
    process.exit(1);
}

const inputFile = args[0];
const projectedCapital = parseFloat(args[1]);
const categoryName = args[2] || 'C倉(2022年長線)';
const market = (args[3] || 'TW').toUpperCase();

if (isNaN(projectedCapital) || projectedCapital <= 0) {
    console.error('錯誤：預計投入金額必須為正數');
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Read & Parse Input CSV
// ---------------------------------------------------------------------------
const inputPath = path.resolve(inputFile);
if (!fs.existsSync(inputPath)) {
    console.error(`錯誤：找不到檔案 ${inputPath}`);
    process.exit(1);
}

const raw = fs.readFileSync(inputPath, 'utf-8');
const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());

if (lines.length < 2) {
    console.error('錯誤：CSV 至少需要一個 header 行與一筆資料');
    process.exit(1);
}

// Skip header
const header = lines[0];
console.log(`讀取 header: ${header}`);
console.log(`預計投入金額: ${projectedCapital.toLocaleString()}`);
console.log(`倉位: ${categoryName} | 市場: ${market}`);
console.log('---');

// ---------------------------------------------------------------------------
// Parse helper
// ---------------------------------------------------------------------------
function cleanPrice(s) {
    if (!s) return 0;
    return parseFloat(s.replace(/[$,，]/g, '').trim()) || 0;
}

function extractPercent(eventStr) {
    if (!eventStr) return { action: null, percent: 0 };
    const str = eventStr.trim();
    const match = str.match(/([\d.]+)%/);
    const percent = match ? parseFloat(match[1]) : 0;

    if (str.includes('新增') || str.includes('加碼')) {
        return { action: 'BUY', percent };
    } else if (str.includes('減碼')) {
        return { action: 'SELL', percent };
    }
    return { action: null, percent };
}

// ---------------------------------------------------------------------------
// Convert rows
// ---------------------------------------------------------------------------
const outputRows = [];
let seqCounter = 0;

for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    // Expected: 日期, 代號, 股名, 買入事件, 買入價格, 賣出事件, 賣出價格, [損益率]
    const date = cols[0];
    const symbol = cols[1];
    const name = cols[2];
    const buyEvent = cols[3] || '';
    const buyPrice = cleanPrice(cols[4]);
    const sellEvent = cols[5] || '';
    const sellPrice = cleanPrice(cols[6]);
    // cols[7] = 損益率 (ignored, system will compute)

    if (!date || !symbol) {
        console.warn(`跳過第 ${i + 1} 行：日期或代號為空`);
        continue;
    }

    // Determine if this is a BUY or SELL row
    const buy = extractPercent(buyEvent);
    const sell = extractPercent(sellEvent);

    if (buy.action === 'BUY' && buy.percent > 0 && buyPrice > 0) {
        seqCounter++;
        const amount = projectedCapital * (buy.percent / 100);
        const shares = Math.floor(amount / buyPrice);

        if (shares <= 0) {
            console.warn(`警告第 ${i + 1} 行：計算股數為 0 (金額=${amount.toFixed(0)}, 價格=${buyPrice})`);
            continue;
        }

        outputRows.push({
            external_id: `${categoryName.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '')}-${date}-${symbol}-BUY-${seqCounter}`,
            trade_date: date,
            portfolio: 'martingale',
            category_name: categoryName,
            market,
            symbol,
            name,
            side: 'BUY',
            quantity: shares,
            price: buyPrice,
            exchange_rate: 1,
            fee: 0,
            tax: 0,
            note: buyEvent
        });

        console.log(`✅ BUY  ${date} ${symbol} ${name} | ${buyEvent} @ $${buyPrice} → ${shares} 股 (金額 ${amount.toFixed(0)})`);
    }

    if (sell.action === 'SELL' && sell.percent > 0 && sellPrice > 0) {
        seqCounter++;
        const amount = projectedCapital * (sell.percent / 100);
        const shares = Math.floor(amount / sellPrice);

        if (shares <= 0) {
            console.warn(`警告第 ${i + 1} 行：計算股數為 0 (金額=${amount.toFixed(0)}, 價格=${sellPrice})`);
            continue;
        }

        outputRows.push({
            external_id: `${categoryName.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '')}-${date}-${symbol}-SELL-${seqCounter}`,
            trade_date: date,
            portfolio: 'martingale',
            category_name: categoryName,
            market,
            symbol,
            name,
            side: 'SELL',
            quantity: shares,
            price: sellPrice,
            exchange_rate: 1,
            fee: 0,
            tax: 0,
            note: sellEvent
        });

        console.log(`🔻 SELL ${date} ${symbol} ${name} | ${sellEvent} @ $${sellPrice} → ${shares} 股 (金額 ${amount.toFixed(0)})`);
    }

    if (!buy.action && !sell.action) {
        console.warn(`跳過第 ${i + 1} 行：無法解析事件 (買入="${buyEvent}", 賣出="${sellEvent}")`);
    }
}

// ---------------------------------------------------------------------------
// Write output CSV
// ---------------------------------------------------------------------------
const OUTPUT_HEADERS = [
    'external_id', 'trade_date', 'portfolio', 'category_name', 'market',
    'symbol', 'name', 'side', 'quantity', 'price',
    'exchange_rate', 'fee', 'tax', 'note'
];

const csvLines = [OUTPUT_HEADERS.join(',')];
for (const row of outputRows) {
    csvLines.push(OUTPUT_HEADERS.map(h => {
        const val = row[h];
        // Quote strings that might contain commas or special chars
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
            return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
    }).join(','));
}

const outputFile = inputPath.replace(/\.csv$/i, '_import.csv');
fs.writeFileSync(outputFile, '\ufeff' + csvLines.join('\n'), 'utf-8'); // BOM for Excel

console.log('\n---');
console.log(`✅ 轉換完成！共 ${outputRows.length} 筆交易`);
console.log(`📁 輸出檔案：${outputFile}`);
console.log(`\n下一步：在管理員面板中使用「匯入歷史交易」功能，選擇此檔案匯入。`);
