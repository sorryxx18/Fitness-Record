import { useMemo } from 'react';
import { FilterBar } from '../components/FilterBar.jsx';
import { RadarChart, LineChart } from '../components/Charts.jsx';
import { parsePeriod } from '../lib/fitnessCore.js';

export function DashboardPage({
  period, setPeriod, brigade, setBrigade, squad, setSquad, resetPages,
  stats, radarData, brigadeCompare, trendData, trainingRecords,
}) {
  const { year } = parsePeriod(period);

  // ── 與上期比較 ────────────────────────────────────────────
  const currentIdx = trendData.findIndex(t => t.period === period);
  const prevTrend = currentIdx > 0 ? trendData[currentIdx - 1] : null;
  const rateDiff = prevTrend != null ? (parseFloat(stats.rate) - prevTrend.passRate).toFixed(1) : null;
  const avgDiff = prevTrend != null ? (parseFloat(stats.avg) - prevTrend.avgScore).toFixed(1) : null;

  // ── 需關注大隊（有資料但及格率 < 50%） ───────────────────
  const alertCount = brigadeCompare.filter(b => b.count > 0 && b.passRate < 50).length;

  // ── 整體狀態色 ────────────────────────────────────────────
  const level = !stats.total ? 'none' : parseFloat(stats.rate) >= 70 ? 'good' : parseFloat(stats.rate) >= 50 ? 'warn' : 'danger';
  const sc = {
    none:   { bg: '#f8fafc', border: '#e2e8f0', text: '#64748b', dot: '#94a3b8' },
    good:   { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', dot: '#059669' },
    warn:   { bg: '#fffbeb', border: '#fde68a', text: '#92400e', dot: '#d97706' },
    danger: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', dot: '#dc2626' },
  }[level];

  // ── 結論文字 ──────────────────────────────────────────────
  let conclusion = stats.total ? `本期及格率 ${stats.rate}%` : '本期尚無資料，請先更新資料';
  if (rateDiff !== null && stats.total) {
    const n = parseFloat(rateDiff);
    conclusion += `，較上期 ${n > 0 ? '↑' : n < 0 ? '↓' : '→'}${Math.abs(n)}%`;
  }
  if (alertCount > 0) conclusion += `，${alertCount} 個大隊及格率偏低`;

  // ── 常訓填報進度 ──────────────────────────────────────────
  const TOTAL_TRAINING_UNITS = 16;
  const reportedUnits = useMemo(() => {
    if (!trainingRecords?.length) return 0;
    return new Set(
      trainingRecords
        .filter(r => !year || (r.period && r.period.startsWith(year + '年')))
        .map(r => r.unit)
    ).size;
  }, [trainingRecords, year]);

  // ── 趨勢圖資料 ────────────────────────────────────────────
  const lineDatasets = [
    {
      label: '及格率(%)',
      data: trendData.map(d => d.passRate),
      borderColor: '#dc2626',
      backgroundColor: 'rgba(220,38,38,0.1)',
      tension: 0.3,
      fill: true,
      pointRadius: 3,
    },
    {
      label: '平均分',
      data: trendData.map(d => d.avgScore),
      borderColor: '#2563eb',
      backgroundColor: 'transparent',
      tension: 0.3,
      borderDash: [5, 4],
      pointRadius: 3,
    },
  ];

  // ── 趨勢箭頭 helper ───────────────────────────────────────
  function trendTag(diff) {
    if (diff === null) return null;
    const n = parseFloat(diff);
    return { label: `${n > 0 ? '↑' : n < 0 ? '↓' : '→'}${Math.abs(n)}`, color: n > 0 ? '#059669' : n < 0 ? '#dc2626' : '#94a3b8' };
  }

  const rateTrend = trendTag(rateDiff);
  const avgTrend = trendTag(avgDiff);

  // ── 單位卡樣式 helper ─────────────────────────────────────
  function unitStyle(b) {
    if (!b.count) return { bg: '#f8fafc', border: '#e2e8f0', badgeBg: '#e2e8f0', badgeText: '#94a3b8', bar: '#cbd5e1', label: '無資料' };
    if (b.passRate >= 70) return { bg: '#f0fdf4', border: '#bbf7d0', badgeBg: '#dcfce7', badgeText: '#166534', bar: '#059669', label: `${b.passRate}%` };
    if (b.passRate >= 50) return { bg: '#fffbeb', border: '#fde68a', badgeBg: '#fef9c3', badgeText: '#854d0e', bar: '#d97706', label: `${b.passRate}%` };
    return { bg: '#fef2f2', border: '#fecaca', badgeBg: '#fee2e2', badgeText: '#991b1b', bar: '#dc2626', label: `${b.passRate}%` };
  }

  return (
    <section>
      <FilterBar period={period} setPeriod={setPeriod} brigade={brigade} setBrigade={setBrigade}
        squad={squad} setSquad={setSquad} onReset={resetPages} />

      {/* ① 結論橫幅 */}
      <div style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 8, padding: '11px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 14, color: sc.text, fontWeight: 600 }}>{conclusion}</span>
      </div>

      {/* ② 數字卡 */}
      <div className="cards" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        <div>
          <span>總人數</span>
          <b>{stats.total}</b>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>本期人員紀錄</span>
        </div>
        <div>
          <span>及格率</span>
          <b style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            {stats.rate}%
            {rateTrend && <span style={{ fontSize: 13, fontWeight: 500, color: rateTrend.color }}>{rateTrend.label}</span>}
          </b>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{prevTrend ? `上期 ${prevTrend.passRate}%` : '首次記錄'}</span>
        </div>
        <div>
          <span>平均分</span>
          <b style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            {stats.avg}
            {avgTrend && <span style={{ fontSize: 13, fontWeight: 500, color: avgTrend.color }}>{avgTrend.label}</span>}
          </b>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{prevTrend ? `上期 ${prevTrend.avgScore}` : '首次記錄'}</span>
        </div>
        <div>
          <span>需關注大隊</span>
          <b style={{ color: alertCount > 0 ? '#dc2626' : '#059669' }}>{alertCount}</b>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>及格率低於 50%</span>
        </div>
      </div>

      {/* ③ 各大隊速覽 */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 14, fontSize: 14, fontWeight: 700 }}>各大隊狀態</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {brigadeCompare.map(b => {
            const s = unitStyle(b);
            return (
              <div key={b.brigade} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>{b.brigade}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{b.count} 人</span>
                  <span style={{ fontSize: 13, fontWeight: 700, background: s.badgeBg, color: s.badgeText, borderRadius: 4, padding: '2px 7px' }}>{s.label}</span>
                </div>
                <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2 }}>
                  <div style={{ height: '100%', background: s.bar, borderRadius: 2, width: `${Math.min(b.passRate, 100)}%`, transition: 'width 0.5s' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ④ 圖表 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <h3 style={{ marginBottom: 12, fontSize: 14, fontWeight: 700 }}>各項目平均得分</h3>
          <div style={{ height: 260 }}><RadarChart data={radarData} /></div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <h3 style={{ marginBottom: 12, fontSize: 14, fontWeight: 700 }}>跨期趨勢</h3>
          <div style={{ height: 260 }}>
            {trendData.length >= 2
              ? <LineChart labels={trendData.map(d => d.period)} datasets={lineDatasets} />
              : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>資料不足，需至少兩期紀錄</div>
            }
          </div>
        </div>
      </div>

      {/* ⑤ 常訓填報進度 */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <i className={reportedUnits >= TOTAL_TRAINING_UNITS ? 'ri-shield-check-line' : 'ri-time-line'}
          style={{ fontSize: 22, color: reportedUnits >= TOTAL_TRAINING_UNITS ? '#059669' : '#d97706', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            {year ? year + '年' : ''}常訓填報：
            <span style={{ color: reportedUnits >= TOTAL_TRAINING_UNITS ? '#059669' : '#d97706' }}>
              {reportedUnits} / {TOTAL_TRAINING_UNITS} 單位已填報
            </span>
          </div>
          <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3 }}>
            <div style={{
              height: '100%',
              background: reportedUnits >= TOTAL_TRAINING_UNITS ? '#059669' : '#d97706',
              borderRadius: 3,
              width: `${Math.round((reportedUnits / TOTAL_TRAINING_UNITS) * 100)}%`,
              transition: 'width 0.5s',
            }} />
          </div>
        </div>
        {!trainingRecords?.length && (
          <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>請至常訓紀錄頁更新資料</span>
        )}
      </div>
    </section>
  );
}
