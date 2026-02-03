# 如何確認 App Check 防護已啟動？

您可以透過以下三種方式確認 App Check 是否正在運作：

## 1. 前端驗證 (開發者工具)
打開瀏覽器 (F12) > Console，重新整理網頁。

- [x] **確認初始化訊息**：您應看到 `Firebase App Check initialized.` 的 Log。
- [x] **檢查網路請求 (Network Tab)**：
  1. 切換到 **Network** 分頁。
  2. 在 Filter 輸入 `appcheck`。
  3. 您應該會看到一個發往 `firebaseappcheck.googleapis.com` 的請求 (exchangeRecaptchaV3Token)。
  4. 隨後，當您讀取資料庫 (Firestore) 時，查看該請求的 **Headers**。
  5. 在 Request Headers 中應該會多出一個 `x-firebase-appcheck` 的欄位，這就是防護憑證。

## 2. 後端驗證 (Firebase Console)
這是最準確的數據來源，但會有 15~30 分鐘的延遲。

1. 前往 [Firebase Console > App Check > APIs](https://console.firebase.google.com/project/libao-finance-manager/appcheck/products)。
2. 查看 **Cloud Firestore** 的圖表。
3. 您會看到流量被分為：
   - 🟢 **Verified traffic** (受信任的流量)
   - 🔴 **Unverified traffic** (未受信任/來自腳本的流量)

## 3. 關鍵：開關是否開啟 (Enforcement)
**這點最重要！**
僅僅安裝 SDK 並不代表「阻擋」了攻擊。您必須在 Firebase Console 中「開啟執法」。

1. 前往 Firebase Console > App Check > APIs。
2. 找到 **Cloud Firestore**。
3. 點擊右側選單，確認它是否處於 **Enforced** (強制執行) 狀態。
   - 如果是 **Unenforced** (未強制)：即時有了 Token，Firestore 也不會阻擋沒 Token 的人。這是為了讓您先測試相容性。
   - 若確認前端運作正常 (圖表中 Verified 佔絕大多數)，請點擊 **Enforce** 按鈕，這時防護才真正生效 (開始擋人)。
