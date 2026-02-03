# App Check 防護啟動後，其他用戶會發生什麼事？

您現在本機沒有 403，是因為您加了 Debug Token。
對於真實世界的用戶（沒有 Debug Token 的人），情況如下：

## 1. 正常人類用戶 (Good Users)
**體驗：完全無感 (Invisible)**。
*   當他們進入網站時，`firebase.ts` 會在背景默默執行 reCAPTCHA v3。
*   如果 reCAPTCHA 判定「這是真人」，Firebase 會發給他們一張臨時通行證。
*   他們讀取資料庫時會自動帶上這張通行證，**一切功能正常運作**。
*   他們**不會**看到「選出圖片中的紅綠燈」這種九宮格驗證碼（v3 是無痕的）。

## 2. 機器人 / 爬蟲腳本 (Bots)
**體驗：被拒絕 (403 Forbidden)**。
*   他們直接呼叫 API 或用 Selenium 跑腳本時，因為無法通過 reCAPTCHA 檢查。
*   他們拿不到通行證，Firestore 會直接回傳 `403 Missing or invalid permissions`。
*   **您的資料庫因此受到保護，不會被大量抓取。**

---

## ⚠️ 災難預警：最重要的設定 (Domain allowlist)

這是最容易發生的事故：**正式上線後，所有人都被擋在門外。**

因為 reCAPTCHA 也有「網域白名單」。
如果您將網站部署到新的網址（例如 `www.your-startup.com`），但忘記在 reCAPTCHA 設定中加入這個網址：
*   reCAPTCHA 會拒絕運作。
*   **所有人（包含真人）都拿不到通行證。**
*   **結果：全站癱瘓，所有人都看到 403 錯誤。**

### ✅ 如何避免？
請確保您已在 [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin) 中，將您所有的正式網域名稱（Domain）都加入白名單。
