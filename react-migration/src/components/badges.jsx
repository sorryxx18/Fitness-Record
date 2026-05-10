export function ScoreBadge({ value }) {
  const tone = value >= 10 ? 'high' : value >= 6 ? 'mid' : 'low';
  return <span className={`score ${tone}`}>{value}</span>;
}

export function PassBadge({ pass }) {
  return <span className={`pass ${pass ? 'yes' : 'no'}`}>{pass ? '及格' : '不及格'}</span>;
}
