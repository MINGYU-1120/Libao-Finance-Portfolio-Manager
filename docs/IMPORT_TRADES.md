# 歷史交易批次匯入使用指南

## 使用方式

1. 以 admin 帳號登入，前往 **後台管理 (Admin)** 分頁
2. 點擊右上角「**匯入歷史交易**」按鈕
3. 上傳 CSV 檔案（或直接貼上 CSV 內容）
4. 按「解析並預覽」，確認即將匯入的筆數與失敗原因
5. 確認後按「確認匯入 N 筆」，資料會自動同步至雲端

---

## CSV 格式

### 欄位清單

| 欄位 | 必填 | 格式 / 允許值 |
|---|---|---|
| `external_id` | ✓ | 唯一字串，建議 `YYYYMMDD-SYMBOL-SIDE-N` |
| `trade_date` | ✓ | `YYYY-MM-DD` |
| `portfolio` | ✓ | `personal` 或 `martingale` |
| `category_name` | ✓ | 需與系統現有分類名稱完全相符 |
| `market` | ✓ | `TW` 或 `US` |
| `symbol` | ✓ | 大寫股票代號 |
| `name` | ✓ | 股票名稱 |
| `side` | ✓ | `BUY` 或 `SELL` |
| `quantity` | ✓ | 正數 |
| `price` | ✓ | 原始幣別單價（US 為 USD，TW 為 TWD）|
| `exchange_rate` | 選填 | 匯率，US 市場必填，TW 預設 1 |
| `fee` | 選填 | 手續費 TWD，預設 0 |
| `tax` | 選填 | 交易稅 TWD，預設 0 |
| `note` | 選填 | 備注 |

### 範例 CSV

```csv
external_id,trade_date,portfolio,category_name,market,symbol,name,side,quantity,price,exchange_rate,fee,tax,note
20220103-2330-BUY-1,2022-01-03,martingale,台股長波段,TW,2330,台積電,BUY,2000,620,1,1767,0,初始建倉
20220601-2330-SELL-1,2022-06-01,martingale,台股長波段,TW,2330,台積電,SELL,1000,530,1,755,1590,部分停利
20220301-AAPL-BUY-1,2022-03-01,martingale,美股成長,US,AAPL,Apple Inc.,BUY,50,170,31.5,0,0,
20230601-2330-BUY-1,2023-06-01,personal,個人長線,TW,2330,台積電,BUY,500,550,1,784,0,個人持倉
```

### external_id 建議命名規則

```
{YYYYMMDD}-{SYMBOL}-{SIDE}-{序號}

範例：
  20220103-2330-BUY-1    (2022/01/03 買入 2330，第 1 筆)
  20220601-AAPL-BUY-1   (2022/06/01 買入 AAPL，第 1 筆)
  20220601-2330-SELL-1  (2022/06/01 賣出 2330，第 1 筆)
```

> **重要**：同一個 `external_id` 只會匯入一次，重複執行不會重複入庫。

---

## 匯入行為說明

| 情況 | 處理方式 |
|---|---|
| 驗證失敗（欄位錯誤、格式錯誤）| 顯示行號 / external_id / 原因，跳過該筆繼續 |
| category_name 不存在 | 顯示現有分類名稱，跳過該筆繼續 |
| external_id 已存在 | 標記為「重複略過」，不重複入庫 |
| BUY | 新增 Lot，更新 avgCost（與手動下單完全相同） |
| SELL | FIFO 消耗 Lot，計算 realizedPnL |

---

## 常見錯誤與排查

| 錯誤訊息 | 原因 | 解法 |
|---|---|---|
| `category_name "XXX" 在馬丁持倉中不存在` | 分類名稱拼字不符 | 先在系統新增該分類，或修正 CSV |
| `trade_date 格式錯誤` | 日期非 YYYY-MM-DD | 改為正確格式，例如 `2022-01-03` |
| `symbol 為空` | symbol 欄位缺值 | 填入股票代號 |
| `賣出股數超過持有股數` | SELL 時該股持倉不足 | 確保 BUY 筆早於 SELL，或調整數量 |
| `CSV 缺少必要欄位` | Header 行缺欄位 | 對照上方欄位清單補齊 |

---

## 技術細節

- 匯入使用與手動下單**完全相同的 FIFO lot 計算邏輯**
- 匯入後透過既有 `saveAndSetPortfolio` 同步至 Firestore
- Admin 的馬丁持倉會在 3 秒後 debounce 自動推送至 `public_portfolios/martingale`（供 member 同步）

---

## 執行測試

```bash
# 僅執行匯入服務單元測試
npx vitest run test/importTradesService.test.ts

# 執行所有測試
npx vitest run
```
