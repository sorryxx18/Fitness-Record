import { PAGE_SIZE } from '../constants/appConstants.js';

export function Pagination({ page, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return <div className="pagination" style={{ fontSize: 13, color: 'var(--muted)' }}>共 {total} 筆</div>;
  return (
    <div className="pagination">
      <span>共 {total} 筆，第 {page}/{pages} 頁</span>
      <button disabled={page <= 1} onClick={() => onPage(p => Math.max(1, p - 1))}>上一頁</button>
      <button disabled={page >= pages} onClick={() => onPage(p => Math.min(pages, p + 1))}>下一頁</button>
    </div>
  );
}
