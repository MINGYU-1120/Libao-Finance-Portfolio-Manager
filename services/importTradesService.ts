/**
 * importTradesService.ts
 *
 * Pure-function service for batch-importing historical trades from CSV.
 * No Firebase calls here — all side-effects are handled by the caller (App.tsx).
 * This makes the service fully testable without mocking Firebase.
 *
 * Supported flow:
 *   parseCsvText → validateRows → applyImport (with optional dryRun)
 */

import { v4 as uuidv4 } from 'uuid';
import { PortfolioState, TransactionRecord, AssetLot } from '../types';

// ---------------------------------------------------------------------------
// Raw row from CSV (string values before parsing)
// ---------------------------------------------------------------------------
export interface RawImportRow {
    /** Unique external identifier for dedup. e.g. "20220103-2330-BUY-1" */
    external_id: string;
    trade_date: string;
    portfolio: string;
    category_name: string;
    market: string;
    symbol: string;
    name: string;
    side: string;
    quantity: string;
    price: string;
    exchange_rate: string;
    fee: string;
    tax: string;
    note: string;
    /** 1-based line number in the original CSV (including header) */
    _lineNumber: number;
}

// ---------------------------------------------------------------------------
// Validated row (typed values, ready for import)
// ---------------------------------------------------------------------------
export interface ValidatedRow {
    externalId: string;
    tradeDate: string;        // ISO-8601 string e.g. "2022-01-03T00:00:00.000Z"
    portfolio: 'personal' | 'martingale';
    categoryName: string;
    market: 'TW' | 'US';
    symbol: string;
    name: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    exchangeRate: number;
    fee: number;
    tax: number;
    note: string;
    lineNumber: number;
}

// ---------------------------------------------------------------------------
// Failure record — returned so the user can locate and fix the problem
// ---------------------------------------------------------------------------
export interface ImportFailure {
    /** 1-based CSV line number */
    lineNumber: number;
    externalId: string;
    symbol: string;
    tradeDate: string;
    reason: string;
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------
export interface ValidationResult {
    valid: ValidatedRow[];
    failures: ImportFailure[];
    /** external_ids that already exist in portfolio.transactions */
    duplicates: { lineNumber: number; externalId: string }[];
}

// ---------------------------------------------------------------------------
// Import result
// ---------------------------------------------------------------------------
export interface ImportResult {
    /** The updated PortfolioState. null when dryRun=true */
    newPortfolio: PortfolioState | null;
    successCount: number;
    failureCount: number;
    skippedDuplicates: number;
    failures: ImportFailure[];
    /** duplicates are counted in skippedDuplicates, NOT in failures */
    duplicatesDetail: { lineNumber: number; externalId: string }[];
}

export interface ImportOptions {
    dryRun?: boolean;
}

// ===========================================================================
// 1. parseCsvText
// ===========================================================================

const REQUIRED_HEADERS = [
    'external_id', 'trade_date', 'portfolio', 'category_name', 'market',
    'symbol', 'name', 'side', 'quantity', 'price',
];

/**
 * Parse CSV text into raw row objects.
 * Throws if required headers are missing.
 */
export function parseCsvText(text: string): RawImportRow[] {
    const lines = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n');

    const nonEmptyLines = lines.map((l, i) => ({ raw: l.trim(), idx: i })).filter(l => l.raw);
    if (nonEmptyLines.length < 2) {
        throw new Error('CSV 至少需要一個 header 行與一筆資料');
    }

    // Parse header (first non-empty line)
    const headers = splitCsvLine(nonEmptyLines[0].raw).map(h => h.trim().toLowerCase());

    // Validate required headers
    const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h));
    if (missing.length > 0) {
        throw new Error(`CSV 缺少必要欄位: ${missing.join(', ')}`);
    }

    const rows: RawImportRow[] = [];
    for (let i = 1; i < nonEmptyLines.length; i++) {
        const { raw, idx } = nonEmptyLines[i];
        const values = splitCsvLine(raw);
        const row: Record<string, string> = {};
        headers.forEach((h, hi) => {
            row[h] = (values[hi] ?? '').trim();
        });

        rows.push({
            external_id: row['external_id'] ?? '',
            trade_date: row['trade_date'] ?? '',
            portfolio: row['portfolio'] ?? '',
            category_name: row['category_name'] ?? '',
            market: row['market'] ?? '',
            symbol: row['symbol'] ?? '',
            name: row['name'] ?? '',
            side: row['side'] ?? '',
            quantity: row['quantity'] ?? '',
            price: row['price'] ?? '',
            exchange_rate: row['exchange_rate'] ?? '',
            fee: row['fee'] ?? '',
            tax: row['tax'] ?? '',
            note: row['note'] ?? '',
            _lineNumber: idx + 1, // 1-based, includes header line
        });
    }

    return rows;
}

/** Split a single CSV line, respecting double-quoted fields */
function splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // skip escaped quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

// ===========================================================================
// 2. validateRows
// ===========================================================================

/**
 * Validate raw rows against business rules and existing portfolio data.
 *
 * Rules:
 *  - required fields must be non-empty
 *  - trade_date must be a parseable date
 *  - portfolio must be 'personal' or 'martingale'
 *  - market must be 'TW' or 'US'
 *  - side must be 'BUY' or 'SELL'
 *  - quantity and price must be positive numbers
 *  - exchange_rate must be positive (default 1 if empty)
 *  - fee, tax must be non-negative (default 0 if empty)
 *  - category_name must exist in portfolio (personal or martingale)
 *  - external_id must be non-empty
 *  - duplicate external_ids (already in portfolio.transactions) are separated from failures
 */
export function validateRows(
    rows: RawImportRow[],
    portfolio: PortfolioState
): ValidationResult {
    const valid: ValidatedRow[] = [];
    const failures: ImportFailure[] = [];
    const duplicates: { lineNumber: number; externalId: string }[] = [];

    // Build lookup sets for fast checks
    const existingIds = new Set(portfolio.transactions.map(t => t.id));
    const personalCatNames = new Set(portfolio.categories.map(c => c.name));
    const martingaleCatNames = new Set(
        Array.isArray(portfolio.martingale) ? portfolio.martingale.map(c => c.name) : []
    );

    for (const row of rows) {
        const errs: string[] = [];
        const ln = row._lineNumber;

        // --- Required field checks ---
        if (!row.external_id) errs.push('external_id 為空');
        if (!row.trade_date) errs.push('trade_date 為空');
        if (!row.symbol) errs.push('symbol 為空');
        if (!row.name) errs.push('name 為空');
        if (!row.side) errs.push('side 為空');
        if (!row.quantity) errs.push('quantity 為空');
        if (!row.price) errs.push('price 為空');
        if (!row.category_name) errs.push('category_name 為空');

        // --- Format/value checks (only if field is present) ---
        let parsedDate: Date | null = null;
        if (row.trade_date) {
            parsedDate = new Date(row.trade_date);
            if (isNaN(parsedDate.getTime())) {
                errs.push(`trade_date 格式錯誤（需為 YYYY-MM-DD），收到：${row.trade_date}`);
                parsedDate = null;
            }
        }

        const portfolio_lower = row.portfolio.toLowerCase();
        if (portfolio_lower !== 'personal' && portfolio_lower !== 'martingale') {
            errs.push(`portfolio 值無效，需為 personal 或 martingale，收到：${row.portfolio}`);
        }

        const market_upper = row.market.toUpperCase();
        if (market_upper !== 'TW' && market_upper !== 'US') {
            errs.push(`market 值無效，需為 TW 或 US，收到：${row.market}`);
        }

        const side_upper = row.side.toUpperCase();
        if (side_upper !== 'BUY' && side_upper !== 'SELL') {
            errs.push(`side 值無效，需為 BUY 或 SELL，收到：${row.side}`);
        }

        const quantity = parseFloat(row.quantity);
        if (row.quantity && (isNaN(quantity) || quantity <= 0)) {
            errs.push(`quantity 需為正數，收到：${row.quantity}`);
        }

        const price = parseFloat(row.price);
        if (row.price && (isNaN(price) || price <= 0)) {
            errs.push(`price 需為正數，收到：${row.price}`);
        }

        const exchangeRate = row.exchange_rate ? parseFloat(row.exchange_rate) : 1;
        if (row.exchange_rate && (isNaN(exchangeRate) || exchangeRate <= 0)) {
            errs.push(`exchange_rate 需為正數，收到：${row.exchange_rate}`);
        }

        const fee = row.fee ? parseFloat(row.fee) : 0;
        if (row.fee && (isNaN(fee) || fee < 0)) {
            errs.push(`fee 需為非負數，收到：${row.fee}`);
        }

        const tax = row.tax ? parseFloat(row.tax) : 0;
        if (row.tax && (isNaN(tax) || tax < 0)) {
            errs.push(`tax 需為非負數，收到：${row.tax}`);
        }

        // --- Category existence check (only if portfolio field is valid) ---
        if (!errs.some(e => e.includes('portfolio 值無效'))) {
            if (portfolio_lower === 'personal' && row.category_name && !personalCatNames.has(row.category_name)) {
                errs.push(`category_name "${row.category_name}" 在個人持倉中不存在。現有：${[...personalCatNames].join('、')}`);
            }
            if (portfolio_lower === 'martingale' && row.category_name && !martingaleCatNames.has(row.category_name)) {
                errs.push(`category_name "${row.category_name}" 在馬丁持倉中不存在。現有：${[...martingaleCatNames].join('、')}`);
            }
        }

        // --- If any validation error, record as failure ---
        if (errs.length > 0) {
            failures.push({
                lineNumber: ln,
                externalId: row.external_id || '(空白)',
                symbol: row.symbol || '(空白)',
                tradeDate: row.trade_date || '(空白)',
                reason: errs.join('；'),
            });
            continue;
        }

        // --- Duplicate check (after validation passes) ---
        if (existingIds.has(row.external_id)) {
            duplicates.push({ lineNumber: ln, externalId: row.external_id });
            continue;
        }

        valid.push({
            externalId: row.external_id,
            tradeDate: parsedDate!.toISOString(),
            portfolio: portfolio_lower as 'personal' | 'martingale',
            categoryName: row.category_name,
            market: market_upper as 'TW' | 'US',
            symbol: row.symbol.toUpperCase(),
            name: row.name,
            side: side_upper as 'BUY' | 'SELL',
            quantity,
            price,
            exchangeRate: exchangeRate ?? 1,
            fee: fee ?? 0,
            tax: tax ?? 0,
            note: row.note ?? '',
            lineNumber: ln,
        });
    }

    return { valid, failures, duplicates };
}

// ===========================================================================
// 3. applyImport
// ===========================================================================

/**
 * Apply validated rows to the portfolio state.
 *
 * - Processes rows in chronological order of trade_date (important for FIFO)
 * - SELL rows compute realizedPnL via FIFO lot matching
 * - BUY rows add lots and update avgCost
 * - dryRun=true returns newPortfolio=null but everything else is computed
 */
export function applyImport(
    portfolio: PortfolioState,
    validRows: ValidatedRow[],
    options: ImportOptions = {}
): ImportResult {
    const { dryRun = false } = options;

    // Sort chronologically so FIFO is computed correctly
    const sortedRows = [...validRows].sort(
        (a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()
    );

    // Deep-clone the mutable parts we'll modify
    let categories = JSON.parse(JSON.stringify(portfolio.categories));
    let martingale: typeof portfolio.martingale = Array.isArray(portfolio.martingale)
        ? JSON.parse(JSON.stringify(portfolio.martingale))
        : [];
    let transactions: TransactionRecord[] = [...portfolio.transactions];

    const failures: ImportFailure[] = [];
    let successCount = 0;

    for (const row of sortedRows) {
        try {
            const result = processSingleRow(row, categories, martingale, transactions, portfolio);
            if (result.error) {
                failures.push({
                    lineNumber: row.lineNumber,
                    externalId: row.externalId,
                    symbol: row.symbol,
                    tradeDate: row.tradeDate,
                    reason: result.error,
                });
                continue;
            }

            // Apply changes
            if (row.portfolio === 'personal') {
                categories = result.updatedCategories ?? categories;
            } else {
                martingale = result.updatedMartingale ?? martingale;
            }
            transactions = [result.newTx!, ...transactions];
            successCount++;
        } catch (err) {
            failures.push({
                lineNumber: row.lineNumber,
                externalId: row.externalId,
                symbol: row.symbol,
                tradeDate: row.tradeDate,
                reason: `系統錯誤：${err instanceof Error ? err.message : String(err)}`,
            });
        }
    }

    const newPortfolio: PortfolioState | null = dryRun
        ? null
        : {
            ...portfolio,
            categories,
            martingale,
            transactions,
            lastModified: Date.now(),
        };

    return {
        newPortfolio,
        successCount,
        failureCount: failures.length,
        skippedDuplicates: 0, // caller merges this from ValidationResult.duplicates.length
        failures,
        duplicatesDetail: [],
    };
}

// ---------------------------------------------------------------------------
// Internal: process a single validated row
// ---------------------------------------------------------------------------

interface ProcessRowResult {
    newTx?: TransactionRecord;
    updatedCategories?: ReturnType<typeof JSON.parse>;
    updatedMartingale?: ReturnType<typeof JSON.parse>;
    error?: string;
}

function processSingleRow(
    row: ValidatedRow,
    categories: PortfolioState['categories'],
    martingale: PortfolioState['martingale'],
    transactions: TransactionRecord[],
    originalPortfolio: PortfolioState
): ProcessRowResult {
    const isMartingale = row.portfolio === 'martingale';
    const targetList: PortfolioState['categories'] = isMartingale
        ? (Array.isArray(martingale) ? martingale : [])
        : categories;

    const catIdx = targetList.findIndex(c => c.name === row.categoryName);
    if (catIdx === -1) {
        return { error: `category_name "${row.categoryName}" 在 ${row.portfolio} 持倉中不存在` };
    }

    const cat = targetList[catIdx];
    const lotId = row.side === 'BUY' ? uuidv4() : undefined;
    const txId = row.externalId; // use external_id as our transaction id for dedup

    // Build the transaction record
    const totalAmountTWD = row.quantity * row.price * row.exchangeRate;
    const newTx: TransactionRecord = {
        id: txId,
        date: row.tradeDate,
        assetId: '', // filled below
        lotId,
        symbol: row.symbol,
        name: row.name,
        type: row.side,
        shares: row.quantity,
        price: row.price,
        exchangeRate: row.exchangeRate,
        amount: totalAmountTWD,
        fee: row.fee,
        tax: row.tax,
        categoryName: row.categoryName,
        realizedPnL: 0,
        portfolioRatio: 0,
        isMartingale,
    };

    // Compute total capital for portfolioRatio
    const capitalLogs = isMartingale
        ? (originalPortfolio.capitalLogs ?? []).filter(l => l.isMartingale === true)
        : (originalPortfolio.capitalLogs ?? []).filter(l => l.isMartingale !== true);
    const totalCapital = capitalLogs.reduce(
        (s, l) => (l.type === 'DEPOSIT' || l.type === 'PROFIT_REINVEST') ? s + l.amount : s - l.amount, 0
    );
    const projected = totalCapital > 0
        ? Math.floor(totalCapital * (cat.allocationPercent / 100))
        : 0;

    // --- Update assets in category ---
    let nextAssets = [...cat.assets];
    const assetIdx = nextAssets.findIndex(a => a.symbol === row.symbol);
    let assetId: string;

    if (row.side === 'BUY') {
        if (assetIdx > -1) {
            assetId = nextAssets[assetIdx].id;
        } else {
            assetId = uuidv4();
        }
        newTx.assetId = assetId;

        const newLot: AssetLot = {
            id: lotId!,
            date: row.tradeDate,
            shares: row.quantity,
            costPerShare: row.price,
            exchangeRate: row.exchangeRate,
        };

        if (assetIdx > -1) {
            const asset = nextAssets[assetIdx];
            const updatedLots = [...(asset.lots ?? []), newLot];
            const totalShares = asset.shares + row.quantity;
            const totalOriginalCost = updatedLots.reduce(
                (s, l) => s + l.shares * l.costPerShare, 0
            );
            nextAssets[assetIdx] = {
                ...asset,
                shares: totalShares,
                avgCost: totalOriginalCost / totalShares,
                lots: updatedLots,
                currentPrice: row.price,
            };
        } else {
            nextAssets.push({
                id: assetId,
                symbol: row.symbol,
                name: row.name,
                shares: row.quantity,
                avgCost: row.price,
                currentPrice: row.price,
                lots: [newLot],
            });
        }

        if (projected > 0) {
            newTx.portfolioRatio = (totalAmountTWD / projected) * 100;
        }

    } else {
        // SELL
        if (assetIdx === -1) {
            return { error: `找不到持倉 ${row.symbol}，無法賣出` };
        }
        const asset = nextAssets[assetIdx];
        assetId = asset.id;
        newTx.assetId = assetId;

        if (row.quantity > asset.shares) {
            return {
                error: `賣出股數 (${row.quantity}) 超過持有股數 (${asset.shares})，symbol: ${row.symbol}`,
            };
        }

        // FIFO lot consumption
        let remainingToSell = row.quantity;
        let totalCostOfSoldSharesTWD = 0;
        const sortedLots = [...(asset.lots ?? [])].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const processedLots: AssetLot[] = [];

        for (const lot of sortedLots) {
            if (remainingToSell <= 0) {
                processedLots.push(lot);
                continue;
            }
            if (lot.shares <= remainingToSell) {
                totalCostOfSoldSharesTWD += lot.shares * lot.costPerShare * lot.exchangeRate;
                remainingToSell -= lot.shares;
            } else {
                totalCostOfSoldSharesTWD += remainingToSell * lot.costPerShare * lot.exchangeRate;
                processedLots.push({ ...lot, shares: lot.shares - remainingToSell });
                remainingToSell = 0;
            }
        }

        const realizedPnL = totalAmountTWD - totalCostOfSoldSharesTWD - row.fee - row.tax;
        newTx.realizedPnL = realizedPnL;
        newTx.originalCostTWD = totalCostOfSoldSharesTWD;
        if (projected > 0) {
            newTx.portfolioRatio = (totalCostOfSoldSharesTWD / projected) * 100;
        }

        const totalSharesRemaining = asset.shares - row.quantity;
        if (totalSharesRemaining <= 0) {
            nextAssets = nextAssets.filter(a => a.symbol !== row.symbol);
        } else {
            const totalOriginalCostRemaining = processedLots.reduce(
                (s, l) => s + l.shares * l.costPerShare, 0
            );
            nextAssets[assetIdx] = {
                ...asset,
                shares: totalSharesRemaining,
                lots: processedLots,
                avgCost: totalOriginalCostRemaining / totalSharesRemaining,
                currentPrice: row.price,
            };
        }
    }

    // Build updated category list
    const updatedCatList = targetList.map((c, i) =>
        i === catIdx ? { ...c, assets: nextAssets } : c
    );

    return {
        newTx,
        updatedCategories: isMartingale ? undefined : updatedCatList,
        updatedMartingale: isMartingale ? updatedCatList : undefined,
    };
}
