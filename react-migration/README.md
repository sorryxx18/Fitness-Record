# Fitness-Record React Migration

`sorryxx18/Fitness-Record` 目前採用 React/Vite 前端，透過 GitHub Actions build 後部署到 `gh-pages`，公開入口為 GitHub Pages。

## 目前架構

```txt
react-migration/
  package.json
  vite.config.js
  src/
    App.jsx                 # App shell、全域狀態、共用工具列與資料聚合
    constants/              # 導覽、分頁、期別、成績欄位等常數
    hooks/                  # localStorage 與 Chart.js hook
    services/               # GAS API client
    components/             # badges、filter、chart、modal、匯出元件
    pages/                  # dashboard / records / results / analysis / training 頁面
    lib/
      fitnessCore.js        # 成績換算、單位對照、GAS 載入核心
      legacyTables.js       # 舊版 UNIT_MAP / CONV_TABLE
```

## 資料來源

- Google Sheet / GAS 是線上資料來源。
- 前端保留 `localStorage` 作為目前互動快取與匯入暫存，不應被視為權威資料庫。
- 既有 GAS action 名稱維持不變，避免前端重構時牽動後端部署。

## 開發指令

```bash
npm install
npm run dev
npm run build
```

## 部署

- push 到 `main` 且變更 `react-migration/**` 或 workflow 時，GitHub Actions 會執行 build。
- build 成果由 `peaceiris/actions-gh-pages` 發佈到 `gh-pages`。
- Vite base 固定為 `/Fitness-Record/`。

## 重構原則

- App shell 只保留跨頁狀態、共用工具列、GAS 載入/儲存、Excel 匯入等全域流程。
- 頁面 UI 放在 `src/pages/`。
- 可重用元件放在 `src/components/`。
- API 呼叫集中在 `src/services/`，避免頁面直接散落 fetch 細節。
