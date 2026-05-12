export const pages = [
  { id: 'dashboard', label: '總覽', icon: 'ri-dashboard-line' },
  { id: 'training', label: '常訓紀錄', icon: 'ri-book-open-line' },
  { id: 'analysis', label: '統計分析', icon: 'ri-bar-chart-2-line' },
  { id: 'records', label: '成績查詢', icon: 'ri-file-list-3-line' },
];

export const PAGE_SIZE = 50;

function getPeriodOptions() {
  const now = new Date();
  const rocYear = now.getFullYear() - 1911;
  const max = rocYear + 1;
  const opts = [];
  for (let y = max; y >= 114; y--) {
    opts.push(`${y}年下半年`);
    opts.push(`${y}年上半年`);
  }
  return opts;
}
export const PERIOD_OPTIONS = getPeriodOptions();

export const SCORE_COLS = [
  { label: '立跳', key: 'standing_jump' },
  { label: '後拋', key: 'ball_throw' },
  { label: '折返', key: 'shuttle_run' },
  { label: '硬舉', key: 'deadlift' },
  { label: '懸吊', key: 'chin_up' },
  { label: '負重', key: 'loaded_walk' },
  { label: '跑步', key: 'run_1500' },
];

export const CHART_FONT = { family: 'Noto Sans TC', size: 12 };
