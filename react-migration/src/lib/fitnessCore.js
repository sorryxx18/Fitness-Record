export const GAS_URL = 'https://script.google.com/macros/s/AKfycbyFk8sH4a8Zuwv6pgJHzAVHo5w9TF6BN9tXXZvayFQzkD45MD7BFS59HQ8Fw19wfog/exec';

const now = new Date();
export const DEFAULT_YEAR = String(now.getFullYear() - 1911);
export const DEFAULT_SEMESTER = now.getMonth() < 6 ? '上半年' : '下半年';
export const DEFAULT_PERIOD = DEFAULT_YEAR + '年' + DEFAULT_SEMESTER;

export function parsePeriod(period) {
  const m = String(period || '').match(/^(\d+)年(上半年|下半年)$/);
  return m ? { year: m[1], semester: m[2] } : { year: '', semester: '' };
}

export function normalizeRecordValue(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

export function recordIdentityKey(record) {
  return [record.year, record.semester, record.brigade, record.squad, record.unit, record.name, record.gender, record.age, record.standing_jump, record.ball_throw, record.shuttle_run, record.deadlift, record.chin_up_count, record.chin_up_sec, record.loaded_walk, record.run_1500].map(normalizeRecordValue).join('|');
}

export function dedupeRecordsByIdentity(list) {
  const map = new Map();
  for (const record of list || []) map.set(recordIdentityKey(record), record);
  return [...map.values()];
}

export async function loadFromGAS({ year, semester }, currentRecords = []) {
  const params = new URLSearchParams({ action: 'load' });
  if (year && year !== 'all') params.set('year', year);
  if (semester) params.set('semester', semester);
  const resp = await fetch(GAS_URL + '?' + params.toString());
  const data = await resp.json();
  if (!data?.success || !Array.isArray(data.records)) throw new Error(data?.message || 'GSheet 載入失敗');
  const incoming = dedupeRecordsByIdentity(data.records);
  const incomingPeriods = new Set(incoming.map(r => normalizeRecordValue(r.year) + '|' + normalizeRecordValue(r.semester)));
  const retained = currentRecords.filter(r => !incomingPeriods.has(normalizeRecordValue(r.year) + '|' + normalizeRecordValue(r.semester)));
  return { records: [...retained, ...incoming], incoming, skipped: data.records.length - incoming.length };
}

// TODO: 第二階段從舊版 index.html 搬完整 CONV_TABLE；目前先保留 API 與及格線。
export function calcRecord(record) {
  const total = Number(record.total || 0);
  const passLine = record.year && Number.parseInt(record.year, 10) <= 115 ? 50 : 60;
  return { total, passLine, pass: total >= passLine };
}
