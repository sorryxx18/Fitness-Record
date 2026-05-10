import { FilterBar } from '../components/FilterBar.jsx';
import { BarChart, RadarChart } from '../components/Charts.jsx';

export function DashboardPage({ period, setPeriod, brigade, setBrigade, squad, setSquad, resetPages, stats, radarData, brigadeCompare }) {
  return (
    <section>
      <FilterBar period={period} setPeriod={setPeriod} brigade={brigade} setBrigade={setBrigade}
        squad={squad} setSquad={setSquad} onReset={resetPages} />
      <div className="cards" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        {[["總人數", stats.total, "人員紀錄"], ["及格人數", stats.pass, "114-115年≥50 / 116年起≥60"], ["及格率", stats.rate + '%', "及格/總人數"], ["平均分數", stats.avg, "所有人員平均"]].map(([l, v, sub]) => (
          <div key={l}><span>{l}</span><b>{v}</b><span style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</span></div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <h3 style={{ marginBottom: 12, fontSize: 14, fontWeight: 700 }}>各項目平均得分</h3>
          <div style={{ height: 280 }}><RadarChart data={radarData} /></div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <h3 style={{ marginBottom: 12, fontSize: 14, fontWeight: 700 }}>大隊及格率 ({period})</h3>
          <div style={{ height: 280 }}>
            <BarChart
              labels={brigadeCompare.map(d => d.brigade)}
              datasets={[{ label: '及格率(%)', data: brigadeCompare.map(d => d.passRate), backgroundColor: ['#dc2626','#b91c1c','#ef4444','#f87171'], borderRadius: 4 }]}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
