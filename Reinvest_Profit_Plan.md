# 利潤再投入 (Reinvest Profit) 升級與實作計畫

## 核心目標 (Core Objective)
使用者希望在執行「利潤再投入」將從某倉位賺到的獲利轉移到另一個倉位時，能夠：
1. **保留真實戰績**：該倉位顯示的「已實現損益」不應該減少，必須真實呈現歷史上總共賺了多少錢。
2. **準確控管可轉移剩餘資金**：已經提取/轉移走的利潤不能重複提取。也就是說，「可轉出餘額」必須確實減少。

---

## 為什麼無法直接扣除？(Current Challenge)
目前系統的 `realizedPnL` (已實現損益) 是由歷史交易 (`SELL` 賣出、`DIVIDEND` 股息) 即時加總算出來的。
如果我們為了防止重複提領而塞入一筆「負的已實現損益交易」，會導致介面上的歷史戰績變醜、變少，違背了「保留真實戰績」的第一原則。
如果不紀錄已提領多少，使用者就可以無限制地針對同一筆利潤不斷點擊「再投入」，導致總本金憑空無限膨脹。

---

## 解決方案架構 (Solution Architecture)

### 1. 概念拆分：歷史帳面 vs 可用餘額
我們將引入一個新概念：**`已提取利潤 (withdrawnProfit)`**。
* **歷史總損益 (realizedPnL)** = 全部賣出與股息的真實獲利加總 (UI 顯示的戰績，只增不減)。
* **可用利潤餘額 (availableProfit)** = `歷史總損益` - `已提取利潤` (決定還能轉多少錢出去)。

### 2. 資料結構擴充 (Data Structure Changes)
我們需要追蹤資金變動紀錄 (CapitalLogEntry) 的金流方向，讓系統知道這筆利潤是從「哪個倉位」扣走的。
修改 `types.ts` 中的 `CapitalLogEntry`：
```typescript
export interface CapitalLogEntry {
  id: string;
  date: string | number;
  type: CapitalType | 'PROFIT_REINVEST'; // 新增專屬型態區分
  amount: number;
  note?: string;
  isMartingale?: boolean;
  previousAllocations?: { id: string, percent: number }[];
  
  // 新增以下欄位以精確控管利潤流向
  sourceCategoryId?: string; 
  targetCategoryId?: string;
}
```

### 3. 動態計算邏輯 (Calculation Logic in App.tsx)
在 `useMemo` 計算各倉位狀態時 (`calculatedData`)，為每個倉位新增結算：
1. **計算該倉位的已提取利潤**：
   掃描 `capitalLogs`，找出所有 `sourceCategoryId` 等於該倉位 ID，且型態為 `PROFIT_REINVEST` 的紀錄，將金額加總。
2. **計算該倉位的可用利潤**：
   `availableProfit = cat.realizedPnL - cat.withdrawnProfit`
3. **安全鎖 (Safety Lock)**：
   若發生虧損導致 `availableProfit < 0`，最大可轉移的利潤強制為 `0`。

### 4. 介面與操作防呆 (UI & UX Updates)
1. **資金轉移 Modal (TransferModal.tsx)**：
   * 當選擇「利潤再投入 (Profit)」時，輸入框的最大上限 (Max) 不再是粗略的限制，而是精準綁定 `availableProfit`。
   * 介面上會貼心顯示算式：`總已實現 100,000 - 已提取 60,000 = 可用利潤餘額 40,000`。
2. **主表格 (PersonalSummary.tsx / MartingaleSummary.tsx)**：
   * 原本的「已實現損益」維持原樣顯示紅字/綠字戰績。
   * 「資金轉移」的按鈕亮起條件改為：` remainingCash > 0 || availableProfit > 0`。

---

## 執行步驟 (Execution Steps)

- [ ] **Step 1**: 更新 `types.ts`，加入 `sourceCategoryId` 與 `targetCategoryId`。
- [ ] **Step 2**: 擴充 `CalculatedCategory` 介面，加入 `availableProfit` 和 `withdrawnProfit` 欄位供前端使用。
- [ ] **Step 3**: 在 `App.tsx` 的統合計算區塊，寫入掃描 `capitalLogs` 扣除提領額的邏輯。
- [ ] **Step 4**: 更新 `App.tsx` 中的 `handleTransferCategoryCash` 函數。執行利潤再投入時，強制帶入來源與目標倉位 ID，並將 type 設定為專用的 `PROFIT_REINVEST` 或在 `DEPOSIT` 中標記 ID。
- [ ] **Step 5**: 修改前端組件（例如 `TransferModal`），將最大輸入值綁定至新算出的 `availableProfit`，並呈現清晰的「可提餘額提示」。

---

## 對使用者的最終影響 (User Impact)
* **戰情室展示**：您依然可以看到某個強勢倉位（如 G 倉）為您賺了 50 萬的華麗數字。
* **風險控管**：當您把其中 30 萬拿去加碼別的倉位後，系統會自動幫您鎖住剩下的 20 萬，確保您不會重複點擊或超額轉移。若是把轉移紀錄撤回，金額又會自動歸還，極度靈活且安全。
