import { useRef } from 'react';
import { CHART_FONT } from '../constants/appConstants.js';
import { useChart } from '../hooks/useChart.js';

export function RadarChart({ data }) {
  const ref = useRef(null);
  useChart(ref, 'radar', {
    labels: data.labels,
    datasets: [{ label: '平均得分', data: data.values, backgroundColor: 'rgba(220,38,38,0.15)', borderColor: '#dc2626', borderWidth: 2, pointBackgroundColor: '#dc2626' }],
  }, {
    responsive: true, maintainAspectRatio: false,
    scales: { r: { min: 0, max: 20, ticks: { font: CHART_FONT }, pointLabels: { font: { ...CHART_FONT, size: 11 } } } },
    plugins: { legend: { display: false } },
  });
  return <canvas ref={ref} />;
}

export function LineChart({ labels, datasets }) {
  const ref = useRef(null);
  useChart(ref, 'line', { labels, datasets }, {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { font: CHART_FONT, boxWidth: 12 } } },
    scales: { x: { ticks: { font: CHART_FONT } }, y: { beginAtZero: true, ticks: { font: CHART_FONT } } },
  });
  return <canvas ref={ref} />;
}

export function BarChart({ labels, datasets, yCallback, showLegend, yMax }) {
  const ref = useRef(null);
  useChart(ref, 'bar', { labels, datasets }, {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: !!showLegend, labels: { font: CHART_FONT, boxWidth: 12 } } },
    scales: {
      x: { ticks: { font: CHART_FONT } },
      y: { min: 0, max: yMax ?? 100, ticks: { font: CHART_FONT, callback: yCallback || (v => v) } },
    },
  });
  return <canvas ref={ref} />;
}
