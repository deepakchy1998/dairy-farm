import { useState } from 'react';
import { FiCalendar } from 'react-icons/fi';

const periods = [
  { k: 'all', l: 'All Time' },
  { k: 'daily', l: 'Today' },
  { k: 'weekly', l: 'This Week' },
  { k: 'monthly', l: 'This Month' },
  { k: 'quarterly', l: 'Quarter' },
  { k: 'half-yearly', l: '6 Months' },
  { k: 'yearly', l: 'This Year' },
  { k: 'custom', l: 'Custom' },
];

export function getDateRange(period) {
  const now = new Date();
  let start = '', end = now.toISOString().slice(0, 10);
  switch (period) {
    case 'all': return { startDate: '', endDate: '' };
    case 'daily': start = end; break;
    case 'weekly': { const s = new Date(); s.setDate(s.getDate() - 7); start = s.toISOString().slice(0, 10); break; }
    case 'monthly': start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10); break;
    case 'quarterly': { const s = new Date(); s.setMonth(s.getMonth() - 3); start = s.toISOString().slice(0, 10); break; }
    case 'half-yearly': { const s = new Date(); s.setMonth(s.getMonth() - 6); start = s.toISOString().slice(0, 10); break; }
    case 'yearly': start = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10); break;
    default: return null;
  }
  return { startDate: start, endDate: end };
}

export default function DateRangeFilter({ value, onChange, showCustom = true }) {
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const handlePeriodClick = (period) => {
    if (period === 'custom') {
      onChange({ period: 'custom', startDate: customStart, endDate: customEnd });
    } else {
      const range = getDateRange(period);
      onChange({ period, ...range });
    }
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onChange({ period: 'custom', startDate: customStart, endDate: customEnd });
    }
  };

  const displayPeriods = showCustom ? periods : periods.filter(p => p.k !== 'custom');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FiCalendar size={15} className="text-gray-400 dark:text-gray-500 hidden sm:block" />
      {displayPeriods.map(p => (
        <button
          key={p.k}
          onClick={() => handlePeriodClick(p.k)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
            value === p.k
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-200 dark:ring-emerald-800'
              : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
          }`}
        >
          {p.l}
        </button>
      ))}
      {showCustom && value === 'custom' && (
        <div className="flex items-center gap-2 ml-1">
          <input
            type="date"
            className="input w-auto text-xs !py-1.5 !px-2.5"
            value={customStart}
            onChange={e => setCustomStart(e.target.value)}
          />
          <span className="text-gray-400 dark:text-gray-500 text-xs">to</span>
          <input
            type="date"
            className="input w-auto text-xs !py-1.5 !px-2.5"
            value={customEnd}
            onChange={e => setCustomEnd(e.target.value)}
          />
          <button onClick={handleCustomApply} className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm">
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
