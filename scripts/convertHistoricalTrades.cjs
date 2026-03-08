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
const initialCapital = parseFloat(args[1]);
const categoryName = args[2] || 'C倉(2022年長線)';
const market = (args[3] || 'TW').toUpperCase();

if (isNaN(initialCapital) || initialCapital <= 0) {
    console.error('錯誤：預計投入金額必須為正數');
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Multi-category Budget Tracker (為了讓 C 倉等人鎖死金額)
// ---------------------------------------------------------------------------
const allCategoryBudgets = {
    "C倉(2022年長線)": 5000000,
    "黃標": 1250000,
    "D倉(長線)": 5000000,
    "E倉": 1250000
};
// 確保啟動時的 currentCapital 是跟 D 倉對齊的
let currentCapital = allCategoryBudgets[categoryName] || initialCapital;
const initialPercent = 40;
const reinvestmentPool = { amount: 0 };

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
console.log(`初始本金 (Initial Capital): ${initialCapital.toLocaleString()}`);
console.log(`倉位: ${categoryName} | 市場: ${market}`);
console.log('---');

// ---------------------------------------------------------------------------
// Parse helper
// ---------------------------------------------------------------------------
function cleanPrice(s) {
    if (!s) return 0;
    return parseFloat(s.toString().replace(/[$,，]/g, '').trim()) || 0;
}

function extractPercent(eventStr, isRedLabel = false, isYellowLabel = false) {
    if (!eventStr) return { action: null, percent: 0 };
    const str = eventStr.trim();

    if (str.includes('股利') || str.includes('現金')) return { action: 'IGNORE', percent: 0 };

    let percent = 0;
    const base = isRedLabel ? 33.3333 : (isYellowLabel ? 12.5 : 100);

    const matchPercent = str.match(/([\d.]+)%/);
    const matchFraction = str.match(/(\d+)\/(\d+)/);
    const matchDecimal = str.match(/(?<![\d.])(\d\.\d+)(?![\d.])/);

    if (matchPercent) {
        percent = parseFloat(matchPercent[1]);
    } else if (matchFraction) {
        percent = (parseInt(matchFraction[1]) / parseInt(matchFraction[2])) * base;
    } else if (str.includes('一半')) {
        percent = 50; // 語意上的「一半」，在 SELL 時代表賣掉庫存的一半
    } else if (matchDecimal) {
        const decimalValue = parseFloat(matchDecimal[1]);
        if (decimalValue === 0.5 && (str.includes('減碼') || str.includes('剔除'))) {
            percent = 50; // 在 D 倉中，使用者說減碼 0.5 通常指一半庫存，或是比例一半
        } else {
            percent = decimalValue * base;
        }
    } else if (str === '新增' || str === '加碼') {
        percent = base;
    } else if (str.includes('出場')) {
        percent = 100;
    }

    if (str.includes('新增') || str.includes('加碼')) return { action: 'BUY', percent };
    if (str.includes('減碼') || str.includes('剔除') || str.includes('出場')) return { action: 'SELL', percent };

    return { action: null, percent };
}

// ---------------------------------------------------------------------------
// Convert rows
const outputRows = [];
let seqCounter = 0;
const inventory = {}; // symbol -> { totalShares, totalCost, accumulatedPercent }

// 斷點字母 (A, B, C...)
const PART_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
let currentPartIndex = 0;

function flushOutputRows(isFinal = false) {
    if (outputRows.length === 0) return;

    const OUTPUT_HEADERS = [
        'external_id', 'trade_date', 'portfolio', 'category_name', 'market',
        'symbol', 'name', 'side', 'quantity', 'price',
        'exchange_rate', 'fee', 'tax', 'note'
    ];

    const csvLines = [OUTPUT_HEADERS.join(',')];
    for (const row of outputRows) {
        csvLines.push(OUTPUT_HEADERS.map(h => {
            const val = row[h];
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        }).join(','));
    }

    const partSuffix = `_${PART_LETTERS[currentPartIndex]}_import.csv`;
    const outputFile = inputPath.replace(/\.csv$/i, partSuffix);
    fs.writeFileSync(outputFile, '\ufeff' + csvLines.join('\n'), 'utf-8');

    console.log(`\n📁 輸出斷點檔案 [${PART_LETTERS[currentPartIndex]}]：${outputFile} (共 ${outputRows.length} 筆)`);

    // Reset for next part
    outputRows.length = 0;
    if (!isFinal) currentPartIndex++;
}

for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const date = cols[0];
    const symbol = cols[1];
    const name = cols[2];
    const buyEvent = (cols[3] || '').trim();
    const buyPrice = cleanPrice(cols[4]);
    const sellEvent = (cols[5] || '').trim();
    const sellPrice = cleanPrice(cols[6]);

    if (!date || !symbol) continue;

    const isRedLabel = (categoryName || '').includes('紅標');
    const isYellowLabel = (categoryName || '').includes('黃標');
    const buy = extractPercent(buyEvent, isRedLabel, isYellowLabel);
    const sell = extractPercent(sellEvent, isRedLabel, isYellowLabel);

    if (buy.action === 'IGNORE' || sell.action === 'IGNORE') continue;

    // --- 特殊邏輯 1: 預算變動 (擴大分母) ---
    if (buyEvent.includes('擴大分母') || buyEvent.includes('BUDGET CHANGE')) {
        const amtMatch = buyEvent.match(/NT\$?\s*([\d,]+)/);
        if (amtMatch) {
            const addedAmtCategory = parseFloat(amtMatch[1].replace(/,/g, ''));

            // 遇到預算變動時，先把前面的紀錄結帳印出
            if (outputRows.length > 0) {
                flushOutputRows(false);
            }

            // 重要：當預算變動時，所有既有持倉的比例需要按 (舊預算/新預算) 比例縮放
            const oldBudget = allCategoryBudgets[categoryName] || initialCapital;
            const newBudget = oldBudget + addedAmtCategory;
            const scaleFactor = oldBudget / newBudget;

            for (const sym in inventory) {
                if (inventory[sym].accumulatedPercent > 0) {
                    const oldP = inventory[sym].accumulatedPercent;
                    inventory[sym].accumulatedPercent *= scaleFactor;
                    console.log(`📉 [LOG] ${date}: ${sym} 佔比縮放 ${oldP.toFixed(2)}% -> ${inventory[sym].accumulatedPercent.toFixed(2)}% (因預算增加)`);
                }
            }

            // 更新預算，後續的 BUY 會沿用這個新本金來算股數
            allCategoryBudgets[categoryName] = newBudget;
            currentCapital = allCategoryBudgets[categoryName];
            console.log(`💰 [LOG] ${date}: 斷點切割，並擴大分母 +NT$ ${addedAmtCategory.toLocaleString()} (新預算: ${currentCapital.toLocaleString()})`);
        }
        continue;
    }

    // --- 特殊邏輯 2: 拆股 / 合股 ---
    const splitMatch = buyEvent.match(/(?:拆股|合股)(\d+):(\d+)/);
    if (splitMatch && inventory[symbol]) {
        const x = parseInt(splitMatch[1]);
        const y = parseInt(splitMatch[2]);
        const inv = inventory[symbol];
        const oldShares = inv.totalShares;
        const multiplier = x / y;
        inv.totalShares = Math.floor(inv.totalShares * multiplier);

        // 產生一筆 SPLIT 紀錄，讓系統匯入時也同步調整股數
        outputRows.push({
            external_id: `SPLIT-${date}-${symbol}-${seqCounter++}`,
            trade_date: date,
            portfolio: 'martingale',
            category_name: categoryName,
            market, symbol, name,
            side: 'SPLIT',
            quantity: multiplier,
            price: 1, exchange_rate: 1, fee: 0, tax: 0,
            note: buyEvent
        });

        console.log(`🔄 [LOG] ${date} ${symbol} 執行拆/合股 ${x}:${y} | ${oldShares} -> ${inv.totalShares} 股`);
        continue;
    }

    if (!inventory[symbol]) {
        inventory[symbol] = { totalShares: 0, totalCost: 0, accumulatedPercent: 0 };
    }

    // --- BUY ---
    if (buy.action === 'BUY' && buy.percent > 0) {
        seqCounter++;
        let amount = 0;
        const exchangeRate = (market === 'US') ? 33 : 1;

        if (buyEvent.includes('以上減碼後的資金')) {
            amount = reinvestmentPool.amount;
            reinvestmentPool.amount = 0;
            console.log(`✨ [LOG] ${date} ${symbol} 使用再投資資金: $${amount.toFixed(2)}`);
        } else {
            amount = currentCapital * (buy.percent / 100);
        }

        // 重要修正：台股本來就沒小數點，匯入時需取整數
        // 美股則維持 6 位小數位與 Excel 精度對齊
        const rawShares = amount / ((buyPrice * exchangeRate) || 1);
        const shares = (market === 'TW') ? Math.round(rawShares) : parseFloat(rawShares.toFixed(6));

        if (shares > 0) {
            inventory[symbol].totalShares = (market === 'TW')
                ? (inventory[symbol].totalShares + shares)
                : parseFloat((inventory[symbol].totalShares + shares).toFixed(6));
            inventory[symbol].totalCost += (shares * buyPrice * exchangeRate);
            inventory[symbol].accumulatedPercent += buy.percent;

            outputRows.push({
                external_id: `${categoryName.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '')}-${date}-${symbol}-BUY-${seqCounter}`,
                trade_date: date,
                portfolio: 'martingale',
                category_name: categoryName,
                market, symbol, name,
                side: 'BUY',
                quantity: shares,
                price: buyPrice,
                exchange_rate: exchangeRate,
                fee: 0, tax: 0, note: buyEvent
            });
            console.log(`✅ BUY  ${date} ${symbol} | ${buyEvent} @ $${buyPrice} (匯率 ${exchangeRate}) -> ${shares} 股`);
        }
    }

    // --- SELL ---
    if (sell.action === 'SELL' && sell.percent > 0 && sellPrice > 0) {
        seqCounter++;
        const inv = inventory[symbol];
        let shares = 0;
        const exchangeRate = (market === 'US') ? 33 : 1;

        if (sellEvent.includes('一半')) {
            shares = parseFloat((inv.totalShares * 0.5).toFixed(2));
        } else if (sell.percent >= 100 || sellEvent === '出場' || sellEvent === '剔除') {
            // 只有在明確說「出場」或「剔除」(沒趴數的情況) 或 100% 時才賣光
            shares = inv.totalShares;
        } else {
            // 賣出股數 = (當前預算 * 減碼佔比) / 庫存平均成本
            const avgCost = inv.totalShares > 0 ? (inv.totalCost / inv.totalShares) : (sellPrice * exchangeRate);
            const targetCostToReduction = currentCapital * (sell.percent / 100);
            const rawReductionShares = targetCostToReduction / avgCost;
            shares = (market === 'TW') ? Math.round(rawReductionShares) : parseFloat(rawReductionShares.toFixed(6));

            if (shares > inv.totalShares) shares = inv.totalShares;
        }

        if (shares > 0) {
            const avgCost = inv.totalShares > 0 ? (inv.totalCost / inv.totalShares) : (sellPrice * exchangeRate);
            const sellAmountTWD = shares * sellPrice * exchangeRate;

            reinvestmentPool.amount += sellAmountTWD;

            inv.totalShares = (market === 'TW')
                ? (inv.totalShares - shares)
                : parseFloat((inv.totalShares - shares).toFixed(6));
            inv.totalCost -= (shares * avgCost);

            outputRows.push({
                external_id: `${categoryName.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '')}-${date}-${symbol}-SELL-${seqCounter}`,
                trade_date: date,
                portfolio: 'martingale',
                category_name: categoryName,
                market, symbol, name,
                side: 'SELL',
                quantity: shares,
                price: sellPrice,
                exchange_rate: exchangeRate,
                fee: 0, tax: 0, note: sellEvent
            });
            console.log(`🔻 SELL ${date} ${symbol} | ${sellEvent} @ $${sellPrice} (匯率 ${exchangeRate}) -> ${shares} 股`);
        }
    }
}

// ---------------------------------------------------------------------------
// Flush remaining lines
// ---------------------------------------------------------------------------
if (outputRows.length > 0) {
    flushOutputRows(true);
}

console.log('\n---');
console.log(`✅ 轉換完成！所有斷點檔案皆已產生。`);
console.log(`\n下一步：請依序 (A -> B -> C...) 至管理員面板匯入檔案，若遇到擴大分母的斷點，請先至「出/入金」面板手動入金至目標倉位後，再匯入下一份檔案。`);
