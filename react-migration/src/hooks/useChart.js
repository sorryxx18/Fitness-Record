import { useEffect } from 'react';
import Chart from 'chart.js/auto';

export function useChart(ref, type, data, options) {
  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, { type, data, options });
    return () => chart.destroy();
  }, [JSON.stringify(data)]);
}
