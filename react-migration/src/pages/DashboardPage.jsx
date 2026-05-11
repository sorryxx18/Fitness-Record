import { useMemo, useState } from 'react';
import { LineChart } from '../components/Charts.jsx';
import { BRIGADES, calcRecord, parsePeriod } from '../lib/fitnessCore.js';

export function DashboardPage({ brigade, setBrigade, trendData, trainingRecords, records }) {
  const [yearFilter, setYearFilter] = useState('all');

  // ── 所有年度（for filter） ────────────────────────────────
  const allYears = useMemo(() =>
    [...new Set(trendData.map(t => t.period.match(/^(\d+)年/)?.[1]).filter(Boolean))].sort().reverse()
  , [trendData]);

  // ── 依年度篩選後的趨勢（時序由舊到新供圖表用，反序供卡片用） ──
  const filteredTrend = useMemo(() =>
    yearFilter === 'all' ? trendData : trendData.filter(t => t.period.startsWith(yearFilter + '年'))
  , [trendData, yearFilter]);

  const periodCards = useMemo(() => [...filteredTrend].reverse(), [filteredTrend]);

  // ── 最新期別的大隊狀態 ────────────────────────────────────
  const latestPeriod = trendData[trendData.length - 1];
  const brigadeStats = useMemo(() => {
    if (!latestPeriod || !records?.length) return [];
    const { year, semester } = parsePeriod(latestPeriod.period);
    const pool = records.filter(r =>
      String(r.year) === year &&
      (r.semester || '上半年') === semester &&
      (brigade === 'all' || r.brigade === brigade)
    );
    return BRIGADES.map(b => {
      const arr = pool.filter(r => r.brigade === b);
      const scored = arr.map(calcRecord);
      const pass = scored.filter(s => s.pass).length;
      return {
        brigade: b, count: arr.length,
        passRate: arr.length ? +(pass / arr.length * 100).toFixed(1) : 0,
      };
    });
  }, [records, latestPeriod, brigade]);

  // ── 常訓填報進度 ──────────────────────────────────────────
  const TOTAL_TRAINING_UNITS = 16;
  const reportedUnits = useMemo(() => {
    if (!trainingRecords?.length) return 0;
    return new Set(trainingRecords.map(r => r.unit)).size;
  }, [trainingRecords]);

  // ── 趨勢圖資料 ────────────────────────────────────────────
  const lineDatasets = [
    {
      label: '及格率(%)',
      data: filteredTrend.map(d => d.passRate),
      borderColor: '#dc2626',
      backgroundColor: 'rgba(220,38,38,0.08)',
      tension: 0.3, fill: true, pointRadius: 4,
    },
    {
      label: '平均分',
      data: filteredTrend.map(d => d.avgScore),
      borderColor: '#2563eb',
      backgroundColor: 'transparent',
      tension: 0.3, borderDash: [5, 4], pointRadius: 4,
    },
  ];

  function unitStyle(b) {
    if (!b.count) return { bg: '#f8fafc', border: '#e2e8f0', badgeBg: '#e2e8f0', badgeText: '#94a3b8', bar: '#cbd5e1', label: '無資料' };
    if (b.passRate >= 70) return { bg: '#f0fdf4', border: '#bbf7d0', badgeBg: '#dcfce7', badgeText: '#166534', bar: '#059669', label: `${b.passRate}%` };
    if (b.passRate >= 50) return { bg: '#fffbeb', border: '#fde68a', badgeBg: '#fef9c3', badgeText: '#854d0e', bar: '#d97706', label: `${b.passRate}%` };
    return { bg: '#fef2f2', border: '#fecaca', badgeBg: '#fee2e2', badgeText: '#991b1b', bar: '#dc2626', label: `${b.passRate}%` };
  }

  return (
    <section>
      {/* 篩選列 */}
      <div className="filters" style={{ marginBottom: 16 }}>
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
          <option value="all">全部年度</option>
          {allYears.map(y => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select value={brigade} onChange={e => setBrigade(e.target.value)}>
          <option value="all">全部大隊</option>
          {BRIGADES.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {/* ① 期別摘要卡片 */}
      {periodCards.length === 0
        ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', background: '#fff', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
            尚無資料，請先點「更新資料」
          </div>
        : <div className="period-cards" style={{ marginBottom: 20 }}>
            {periodCards.map(d => {
              const origIdx = filteredTrend.findIndex(t => t.period === d.period);
              const prev = origIdx > 0 ? filteredTrend[origIdx - 1] : null;
              const rdiff = prev ? (d.passRate - prev.passRate).toFixed(1) : null;
              const rateColor = !d.count ? '#94a3b8' : d.passRate >= 70 ? '#059669' : d.passRate >= 50 ? '#d97706' : '#dc2626';
              return (
                <div key={d.period} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#334155', marginBottom: 8 }}>{d.period}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: rateColor, lineHeight: 1 }}>
                      {d.count ? d.passRate + '%' : '—'}
                    </span>
                    {rdiff !== null && (
                      <span style={{ fontSize: 12, color: parseFloat(rdiff) > 0 ? '#059669' : parseFloat(rdiff) < 0 ? '#dc2626' : '#94a3b8' }}>
                        {parseFloat(rdiff) > 0 ? '↑' : parseFloat(rdiff) < 0 ? '↓' : '→'}{Math.abs(rdiff)}%
                      </span>
                    )}
                  </div>
                  <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, marginBottom: 8 }}>
                    <div style={{ height: '100%', background: rateColor, borderRadius: 2, width: `${Math.min(d.passRate, 100)}%`, transition: 'width 0.4s' }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{d.count} 人・平均 {d.avgScore} 分</div>
                </div>
              );
            })}
          </div>
      }

      {/* ② 跨期趨勢圖 */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12, fontSize: 14, fontWeight: 700 }}>跨期趨勢</h3>
        <div style={{ height: 240 }}>
          {filteredTrend.length >= 2
            ? <LineChart labels={filteredTrend.map(d => d.period)} datasets={lineDatasets} />
            : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
                資料不足，需至少兩期紀錄
              </div>
          }
        </div>
      </div>

      {/* ③ 各大隊狀態（最新期別） */}
      {brigadeStats.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 14, fontSize: 14, fontWeight: 700 }}>
            各大隊狀態
            {latestPeriod && <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>（{latestPeriod.period}）</span>}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {brigadeStats.map(b => {
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
      )}

      {/* ④ 常訓填報進度 */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <i className={reportedUnits >= TOTAL_TRAINING_UNITS ? 'ri-shield-check-line' : 'ri-time-line'}
          style={{ fontSize: 22, color: reportedUnits >= TOTAL_TRAINING_UNITS ? '#059669' : '#d97706', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            常訓填報：
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
