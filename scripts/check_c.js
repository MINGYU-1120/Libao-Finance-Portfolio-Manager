const fs = require('fs');

const a = fs.readFileSync('c:\\Users\\user\\Desktop\\新增資料夾\\Libao-Finance-Portfolio-Manager\\scripts\\c_trades_raw_A_import.csv', 'utf8').trim().split('\n').map(l => l.trim('\r'));
const b = fs.readFileSync('c:\\Users\\user\\Desktop\\新增資料夾\\Libao-Finance-Portfolio-Manager\\scripts\\c_trades_raw_B_import.csv', 'utf8').trim().split('\n').map(l => l.trim('\r'));

const lines = [...a.slice(1), ...b.slice(1)];

const stocks = {};

for (const line of lines) {
    if (!line) continue;
    const parts = line.split(',');
    const symbol = parts[5];
    const name = parts[6];
    const side = parts[7];
    const qty = parseFloat(parts[8]);
    const price = parseFloat(parts[9]);

    if (!stocks[symbol]) {
        stocks[symbol] = { name, shares: 0, cost: 0, avgPrice: 0, buys: 0, sells: 0 };
    }

    if (side === 'BUY') {
        const totalCost = stocks[symbol].shares * stocks[symbol].avgPrice + qty * price;
        stocks[symbol].shares += qty;
        stocks[symbol].buys += qty;
        if (stocks[symbol].shares > 0) {
            stocks[symbol].avgPrice = totalCost / stocks[symbol].shares;
        }
    } else if (side === 'SELL') {
        stocks[symbol].shares -= qty;
        stocks[symbol].sells += qty;
        if (stocks[symbol].shares <= 1e-6) {
            stocks[symbol].shares = 0;
            // stocks[symbol].avgPrice = 0; // Keep it to see what it was
        }
    }
}

console.log("Current remaining shares:");
for (const sym of Object.keys(stocks)) {
    const s = stocks[sym];
    console.log(`${s.name} (${sym}): Shares: ${s.shares.toFixed(2)} (Buys: ${s.buys.toFixed(2)}, Sells: ${s.sells.toFixed(2)}), AvgPrice: ${s.avgPrice.toFixed(2)}`);
}
