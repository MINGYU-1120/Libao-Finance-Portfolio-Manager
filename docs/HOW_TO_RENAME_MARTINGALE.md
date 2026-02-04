# 如何修改馬丁倉位名稱

您目前的馬丁倉位名稱 (例如：`馬丁策略 (Martingale)`) 儲存在兩個地方，修改方式如下：

## 1. 修改選單/按鈕顯示 (Change Button Label)
如果您只是想改變左側選單或上方導航列的文字：
1. 開啟 `App.tsx`
2. 搜尋關鍵字 `馬丁持倉`
3. 您會找到兩個按鈕設定 (Mobile Sidebar 與 Desktop Navbar)，直接修改 `<span>` 內的文字即可。

## 2. 修改資料庫內的倉位標題 (Change Data Name)
由於倉位名稱已經儲存在您的 Firebase 資料庫中，僅修改程式碼的預設值 **不會** 更新您已經看到的畫面。您必須手動更新資料庫。

### 步驟 A：修改程式碼預設值 (給新用戶或重置後使用)
1. 開啟 `App.tsx`
2. 搜尋 `initialPortfolioState`
3. 找到 `martingale` 陣列設定：
   ```typescript
   martingale: [{
     id: "teacher-cat-1",
     name: "新的名稱這裡改", // <--- 修改這裡
     // ...
   }]
   ```

### 步驟 B：更新現有資料 (重要！)
因為您是管理員且資料已存在，您需要：
- **選項 1 (推薦)**：進入 Firebase Console，找到 `user_directory` (或 `users`) -> 您的用戶 ID -> `portfolio` -> `martingale` -> `0` -> `name`，直接修改數值。
- **選項 2 (重置)**：如果您還沒有重要資料，可以在 Admin Panel 或開發模式下觸發「重置投資組合」，這樣系統就會讀取代碼中的新名稱。
