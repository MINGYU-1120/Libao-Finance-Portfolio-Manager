/**
 * importTradesService.test.ts
 *
 * Unit tests for the batch import service.
 * Pure function tests — no Firebase dependency.
 */

import { describe, it, expect } from 'vitest';
import {
    parseCsvText,
    validateRows,
    applyImport,
} from '../services/importTradesService';
import { PortfolioState } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal portfolio with one personal category and one martingale category */
const makePortfolio = (): PortfolioState => ({
    totalCapital: 1_000_000,
    settings: { usExchangeRate: 31, enableFees: true, usBroker: 'Firstrade', twFeeDiscount: 6 },
    categories: [
        {
            id: 'cat-personal-1',
            name: '個人長線',
            market: 'TW',
            allocationPercent: 100,
            assets: [],
        },
    ],
    transactions: [],
    capitalLogs: [
        { id: 'log-1', date: '2022-01-01', type: 'DEPOSIT', amount: 2_000_000, isMartingale: true },
        { id: 'log-2', date: '2022-01-01', type: 'DEPOSIT', amount: 1_000_000, isMartingale: false },
    ],
    martingale: [
        {
            id: 'cat-mart-1',
            name: '台股長波段',
            market: 'TW',
            allocationPercent: 60,
            assets: [],
        },
        {
            id: 'cat-mart-2',
            name: '美股成長',
            market: 'US',
            allocationPercent: 40,
            assets: [],
        },
    ],
});

/** Valid CSV header + 10 buy rows */
const VALID_CSV_10 = `external_id,trade_date,portfolio,category_name,market,symbol,name,side,quantity,price,exchange_rate,fee,tax,note
20220103-2330-BUY-1,2022-01-03,martingale,台股長波段,TW,2330,台積電,BUY,2000,620,1,1767,0,初始建倉
20220110-2330-BUY-2,2022-01-10,martingale,台股長波段,TW,2330,台積電,BUY,1000,590,1,841,0,加碼
20220215-2330-BUY-3,2022-02-15,martingale,台股長波段,TW,2330,台積電,BUY,500,560,1,399,0,
20220301-AAPL-BUY-1,2022-03-01,martingale,美股成長,US,AAPL,Apple Inc.,BUY,50,170,31.5,0,0,
20220315-MSFT-BUY-1,2022-03-15,martingale,美股成長,US,MSFT,Microsoft Corp.,BUY,30,290,31.2,0,0,
20221001-2330-BUY-4,2022-10-01,martingale,台股長波段,TW,2330,台積電,BUY,2000,430,1,1225,0,跌深加碼
20221115-2330-BUY-5,2022-11-15,martingale,台股長波段,TW,2330,台積電,BUY,1000,410,1,584,0,
20230201-AAPL-BUY-2,2023-02-01,martingale,美股成長,US,AAPL,Apple Inc.,BUY,30,140,30.5,0,0,
20230601-2330-BUY-6,2023-06-01,personal,個人長線,TW,2330,台積電,BUY,500,550,1,784,0,個人持倉
20230701-2330-BUY-7,2023-07-01,personal,個人長線,TW,2330,台積電,BUY,200,560,1,319,0,`;

/** Mix: 8 valid + 2 error rows */
const CSV_WITH_ERRORS = `external_id,trade_date,portfolio,category_name,market,symbol,name,side,quantity,price,exchange_rate,fee,tax,note
20220103-2330-BUY-1,2022-01-03,martingale,台股長波段,TW,2330,台積電,BUY,2000,620,1,1767,0,正常
20220110-2330-BUY-2,2022-01-10,martingale,台股長波段,TW,2330,台積電,BUY,1000,590,1,841,0,正常
20220215-2330-BUY-3,2022-02-15,martingale,台股長波段,TW,2330,台積電,BUY,500,560,1,399,0,正常
20220301-AAPL-BUY-1,2022-03-01,martingale,美股成長,US,AAPL,Apple Inc.,BUY,50,170,31.5,0,0,正常
20220315-MSFT-BUY-1,2022-03-15,martingale,美股成長,US,MSFT,Microsoft Corp.,BUY,30,290,31.2,0,0,正常
20221001-2330-BUY-4,2022-10-01,martingale,台股長波段,TW,2330,台積電,BUY,2000,430,1,1225,0,正常
20221115-2330-BUY-5,2022-11-15,martingale,台股長波段,TW,2330,台積電,BUY,1000,410,1,584,0,正常
20230201-AAPL-BUY-2,2023-02-01,martingale,美股成長,US,AAPL,Apple Inc.,BUY,30,140,30.5,0,0,正常
ERR-MISSING-SYMBOL,2022-05-01,martingale,台股長波段,TW,,台積電,BUY,1000,600,1,855,0,錯誤：symbol為空
ERR-INVALID-DATE,NOT-A-DATE,martingale,台股長波段,TW,2330,台積電,BUY,1000,600,1,855,0,錯誤：日期格式錯誤`;

/** CSV for sell + FIFO test: buy 2000 then sell 1000 */
const CSV_SELL = `external_id,trade_date,portfolio,category_name,market,symbol,name,side,quantity,price,exchange_rate,fee,tax,note
20220103-2330-BUY-1,2022-01-03,martingale,台股長波段,TW,2330,台積電,BUY,2000,620,1,1767,0,
20220601-2330-SELL-1,2022-06-01,martingale,台股長波段,TW,2330,台積電,SELL,1000,530,1,755,1590,停利`;

// ---------------------------------------------------------------------------
// parseCsvText
// ---------------------------------------------------------------------------

describe('parseCsvText', () => {
    it('正確解析 10 筆有效資料', () => {
        const rows = parseCsvText(VALID_CSV_10);
        expect(rows).toHaveLength(10);
        expect(rows[0].external_id).toBe('20220103-2330-BUY-1');
        expect(rows[0].symbol).toBe('2330');
        expect(rows[0].side).toBe('BUY');
        expect(rows[0].quantity).toBe('2000');
        expect(rows[0]._lineNumber).toBe(2); // header is line 1
    });

    it('忽略空行', () => {
        const csv = `external_id,trade_date,portfolio,category_name,market,symbol,name,side,quantity,price,exchange_rate,fee,tax,note\n\n20220103-2330-BUY-1,2022-01-03,martingale,台股長波段,TW,2330,台積電,BUY,2000,620,1,1767,0,\n\n`;
        const rows = parseCsvText(csv);
        expect(rows).toHaveLength(1);
    });

    it('缺少必要 header 時拋出錯誤', () => {
        const badCsv = `symbol,name\n2330,台積電`;
        expect(() => parseCsvText(badCsv)).toThrow(/缺少必要欄位/);
    });

    it('少於 2 行時拋出錯誤', () => {
        expect(() => parseCsvText('external_id,trade_date')).toThrow(/至少需要/);
        expect(() => parseCsvText('')).toThrow(/至少需要/);
    });
});

// ---------------------------------------------------------------------------
// validateRows
// ---------------------------------------------------------------------------

describe('validateRows', () => {
    it('正常 10 筆全部通過驗證', () => {
        const rows = parseCsvText(VALID_CSV_10);
        const portfolio = makePortfolio();
        const result = validateRows(rows, portfolio);
        expect(result.valid).toHaveLength(10);
        expect(result.failures).toHaveLength(0);
        expect(result.duplicates).toHaveLength(0);
    });

    it('external_id 已存在 → 標記 duplicate，不入 failures', () => {
        const rows = parseCsvText(VALID_CSV_10);
        const portfolio = makePortfolio();
        // Pre-load one transaction with same id
        portfolio.transactions = [
            {
                id: '20220103-2330-BUY-1',
                date: '2022-01-03',
                symbol: '2330',
                name: '台積電',
                type: 'BUY',
                shares: 2000,
                price: 620,
                amount: 1_240_000,
                fee: 1767,
                tax: 0,
                exchangeRate: 1,
                categoryName: '台股長波段',
                isMartingale: true,
                realizedPnL: 0,
                portfolioRatio: 0,
            },
        ];
        const result = validateRows(rows, portfolio);
        expect(result.duplicates).toHaveLength(1);
        expect(result.duplicates[0].externalId).toBe('20220103-2330-BUY-1');
        expect(result.valid).toHaveLength(9); // 10 - 1 duplicate
        expect(result.failures).toHaveLength(0);
    });

    it('symbol 為空 → 驗證失敗，附原因', () => {
        const rows = parseCsvText(CSV_WITH_ERRORS);
        const portfolio = makePortfolio();
        const result = validateRows(rows, portfolio);
        const symbolErr = result.failures.find(f => f.externalId === 'ERR-MISSING-SYMBOL');
        expect(symbolErr).toBeDefined();
        expect(symbolErr!.reason).toMatch(/symbol/);
    });

    it('trade_date 格式錯誤 → 驗證失敗，附原因', () => {
        const rows = parseCsvText(CSV_WITH_ERRORS);
        const portfolio = makePortfolio();
        const result = validateRows(rows, portfolio);
        const dateErr = result.failures.find(f => f.externalId === 'ERR-INVALID-DATE');
        expect(dateErr).toBeDefined();
        expect(dateErr!.reason).toMatch(/trade_date/);
    });

    it('category_name 不存在於 portfolio → 驗證失敗', () => {
        const csv = `external_id,trade_date,portfolio,category_name,market,symbol,name,side,quantity,price,exchange_rate,fee,tax,note\n20220103-X-BUY-1,2022-01-03,martingale,不存在的分類,TW,2330,台積電,BUY,1000,620,1,855,0,`;
        const rows = parseCsvText(csv);
        const portfolio = makePortfolio();
        const result = validateRows(rows, portfolio);
        expect(result.failures).toHaveLength(1);
        expect(result.failures[0].reason).toMatch(/不存在/);
        // Should list available categories in the error message
        expect(result.failures[0].reason).toMatch(/台股長波段/);
    });

    it('2 筆錯誤 + 8 筆正常 → valid 有 8 筆 failures 有 2 筆', () => {
        const rows = parseCsvText(CSV_WITH_ERRORS);
        const portfolio = makePortfolio();
        const result = validateRows(rows, portfolio);
        expect(result.valid).toHaveLength(8);
        expect(result.failures).toHaveLength(2);
    });
});

// ---------------------------------------------------------------------------
// applyImport
// ---------------------------------------------------------------------------

describe('applyImport', () => {
    it('dry-run: 不修改 portfolio，回傳 newPortfolio=null', () => {
        const rows = parseCsvText(VALID_CSV_10);
        const portfolio = makePortfolio();
        const { valid } = validateRows(rows, portfolio);
        const result = applyImport(portfolio, valid, { dryRun: true });
        expect(result.newPortfolio).toBeNull();
        expect(result.successCount).toBe(10);
        expect(result.failureCount).toBe(0);
        // Original portfolio untouched
        expect(portfolio.transactions).toHaveLength(0);
    });

    it('正常匯入 10 筆 → 持倉 lot/avgCost/shares 正確', () => {
        const rows = parseCsvText(VALID_CSV_10);
        const portfolio = makePortfolio();
        const { valid } = validateRows(rows, portfolio);
        const result = applyImport(portfolio, valid);
        expect(result.successCount).toBe(10);
        expect(result.failureCount).toBe(0);
        expect(result.newPortfolio).not.toBeNull();

        const newPortfolio = result.newPortfolio!;
        // Verify martingale 台股長波段: 2000+1000+500+2000+1000 = 6500 shares
        const martCat = newPortfolio.martingale?.find(c => c.name === '台股長波段');
        expect(martCat).toBeDefined();
        const ts2330 = martCat!.assets.find(a => a.symbol === '2330');
        expect(ts2330).toBeDefined();
        expect(ts2330!.shares).toBe(6500);
        expect(ts2330!.lots).toHaveLength(5);
        // avgCost should be weighted average of all purchases
        const expectedAvgCost = (2000 * 620 + 1000 * 590 + 500 * 560 + 2000 * 430 + 1000 * 410) / 6500;
        expect(ts2330!.avgCost).toBeCloseTo(expectedAvgCost, 2);

        // transactions should have 10 entries
        expect(newPortfolio.transactions).toHaveLength(10);
        // isMartingale flags
        const martTransactions = newPortfolio.transactions.filter(t => t.isMartingale === true);
        const personalTransactions = newPortfolio.transactions.filter(t => t.isMartingale === false);
        expect(martTransactions).toHaveLength(8); // rows 1-8 are martingale
        expect(personalTransactions).toHaveLength(2); // rows 9-10 are personal
    });

    it('2 筆錯誤混入 → 部分成功，failures 含 2 筆', () => {
        const rows = parseCsvText(CSV_WITH_ERRORS);
        const portfolio = makePortfolio();
        const { valid, failures: validationFailures } = validateRows(rows, portfolio);
        const result = applyImport(portfolio, valid);
        // validation already caught 2 errors, applyImport succeeds for all 8 valid rows
        expect(validationFailures).toHaveLength(2);
        expect(result.successCount).toBe(8);
        expect(result.failureCount).toBe(0); // no additional runtime errors
    });

    it('重複 external_id → skippedDuplicates 計入，不重複入庫', () => {
        const rows = parseCsvText(VALID_CSV_10);
        const portfolio = makePortfolio();

        // First import
        const { valid: valid1 } = validateRows(rows, portfolio);
        const result1 = applyImport(portfolio, valid1);
        expect(result1.successCount).toBe(10);

        // Second import attempt with same data → all should be duplicates
        const newPortfolio1 = result1.newPortfolio!;
        const { valid: valid2, duplicates } = validateRows(rows, newPortfolio1);
        expect(duplicates).toHaveLength(10);
        expect(valid2).toHaveLength(0);
        // applyImport on empty valid array
        const result2 = applyImport(newPortfolio1, valid2);
        result2.skippedDuplicates = duplicates.length;
        expect(result2.successCount).toBe(0);
        expect(result2.skippedDuplicates).toBe(10);
        // Portfolio unchanged
        expect(result2.newPortfolio?.transactions).toHaveLength(10);
    });

    it('SELL 計算 FIFO realizedPnL 正確', () => {
        const rows = parseCsvText(CSV_SELL);
        const portfolio = makePortfolio();
        const { valid } = validateRows(rows, portfolio);
        const result = applyImport(portfolio, valid);
        expect(result.successCount).toBe(2);

        const newPortfolio = result.newPortfolio!;
        // After buying 2000@620 and selling 1000@530
        const martCat = newPortfolio.martingale?.find(c => c.name === '台股長波段');
        const ts2330 = martCat!.assets.find(a => a.symbol === '2330');
        expect(ts2330!.shares).toBe(1000); // 2000 - 1000

        // SELL tx: amount = 1000 * 530 * 1 = 530000
        // cost of sold = 1000 * 620 * 1 = 620000
        // fee = 755, tax = 1590
        // realizedPnL = 530000 - 620000 - 755 - 1590 = -92345
        const sellTx = newPortfolio.transactions.find(t => t.type === 'SELL');
        expect(sellTx).toBeDefined();
        expect(sellTx!.realizedPnL).toBeCloseTo(-92345, 0);
    });

    it('isMartingale 旗標根據 portfolio 欄位正確設定', () => {
        const csv = `external_id,trade_date,portfolio,category_name,market,symbol,name,side,quantity,price,exchange_rate,fee,tax,note\n20230101-2330-P-1,2023-01-01,personal,個人長線,TW,2330,台積電,BUY,100,500,1,0,0,\n20230101-2330-M-1,2023-01-01,martingale,台股長波段,TW,2330,台積電,BUY,100,500,1,0,0,`;
        const rows = parseCsvText(csv);
        const portfolio = makePortfolio();
        const { valid } = validateRows(rows, portfolio);
        const result = applyImport(portfolio, valid);

        const txPersonal = result.newPortfolio!.transactions.find(t => t.id === '20230101-2330-P-1');
        const txMart = result.newPortfolio!.transactions.find(t => t.id === '20230101-2330-M-1');
        expect(txPersonal!.isMartingale).toBe(false);
        expect(txMart!.isMartingale).toBe(true);
    });
});
