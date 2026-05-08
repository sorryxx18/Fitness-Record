# Fitness-Record React Migration

這是 `sorryxx18/Fitness-Record` 的 React/Vite 平移重構起點。

## 目前狀態

- 保留舊版 `index.html` 當穩定版，不直接覆蓋。
- 建立 Vite + React 架構。
- 第一階段先讓新架構可獨立啟動，後續再逐步搬完整功能。

## 已建立的架構方向

```txt
react-migration/
  package.json
  index.html
  vite.config.js
  src/
    main.jsx
    App.jsx
    styles.css
    lib/
      fitnessCore.js
```

## 下一步搬遷順序

1. 從舊版 `index.html` 搬完整 `UNIT_MAP`。
2. 從舊版 `index.html` 搬完整 `CONV_TABLE`。
3. 對齊 `calcRecord()` 結果，確認同一筆資料新舊版總分一致。
4. 搬成績查詢頁的新增、編輯、刪除。
5. 搬 Excel 匯入匯出與 GSheet 儲存。
6. 搬換算結果、統計分析與 Chart.js 圖表。
7. `npm run build` 通過後，再決定是否切 GitHub Pages 入口。

## 重要原則

- 第一階段只做平移重構，不重新設計資料語意。
- 不改 GAS 後端 action 名稱。
- 舊版 `index.html` 先保留當穩定版。
- GitHub Pages base 固定為 `/Fitness-Record/`。
