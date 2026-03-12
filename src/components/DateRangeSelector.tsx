import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { format, startOfMonth, subDays } from 'date-fns';

export interface DateRange {
  startDate: string;
  endDate: string;
  preset: 'today' | 'last7days' | 'thisMonth' | 'custom';
}

interface DateRangeSelectorProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

const presets = [
  { key: 'today' as const, label: 'Today' },
  { key: 'last7days' as const, label: 'Last 7 Days' },
  { key: 'thisMonth' as const, label: 'This Month' },
  { key: 'custom' as const, label: 'Custom' },
];

const today = () => format(new Date(), 'yyyy-MM-dd');

const getPresetRange = (preset: 'today' | 'last7days' | 'thisMonth'): { startDate: string; endDate: string } => {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { startDate: format(now, 'yyyy-MM-dd'), endDate: format(now, 'yyyy-MM-dd') };
    case 'last7days':
      return { startDate: format(subDays(now, 6), 'yyyy-MM-dd'), endDate: format(now, 'yyyy-MM-dd') };
    case 'thisMonth':
      return { startDate: format(startOfMonth(now), 'yyyy-MM-dd'), endDate: format(now, 'yyyy-MM-dd') };
  }
};

export const getDefaultDateRange = (): DateRange => ({
  ...getPresetRange('thisMonth'),
  preset: 'thisMonth',
});

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({ dateRange, onDateRangeChange }) => {
  const [customStart, setCustomStart] = useState(dateRange.startDate);
  const [customEnd, setCustomEnd] = useState(dateRange.endDate);
  const [error, setError] = useState('');

  const handlePresetClick = (preset: 'today' | 'last7days' | 'thisMonth' | 'custom') => {
    if (preset === 'custom') {
      setCustomStart(dateRange.startDate);
      setCustomEnd(dateRange.endDate);
      setError('');
      onDateRangeChange({ ...dateRange, preset: 'custom' });
      return;
    }
    const range = getPresetRange(preset);
    onDateRangeChange({ ...range, preset });
  };

  const handleApplyCustom = () => {
    if (!customStart || !customEnd) {
      setError('Both dates are required');
      return;
    }
    if (customStart > customEnd) {
      setError('Start date must be before end date');
      return;
    }
    if (customEnd > today()) {
      setError('End date cannot be in the future');
      return;
    }
    const oneYearAgo = format(subDays(new Date(), 365), 'yyyy-MM-dd');
    if (customStart < oneYearAgo) {
      setError('Date range cannot exceed 1 year');
      return;
    }
    setError('');
    onDateRangeChange({ startDate: customStart, endDate: customEnd, preset: 'custom' });
  };

  const formatDisplayRange = () => {
    const start = new Date(dateRange.startDate + 'T00:00:00');
    const end = new Date(dateRange.endDate + 'T00:00:00');
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const optsWithYear: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    if (dateRange.startDate === dateRange.endDate) {
      return format(start, 'MMM d, yyyy');
    }
    if (start.getFullYear() === end.getFullYear()) {
      return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', optsWithYear)}`;
    }
    return `${start.toLocaleDateString('en-US', optsWithYear)} – ${end.toLocaleDateString('en-US', optsWithYear)}`;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Calendar className="w-4 h-4" />
          <span className="font-medium">{formatDisplayRange()}</span>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {presets.map((p) => (
            <button
              key={p.key}
              onClick={() => handlePresetClick(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                dateRange.preset === p.key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {dateRange.preset === 'custom' && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={customStart}
            max={today()}
            onChange={(e) => { setCustomStart(e.target.value); setError(''); }}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={customEnd}
            max={today()}
            onChange={(e) => { setCustomEnd(e.target.value); setError(''); }}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <button
            onClick={handleApplyCustom}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Apply
          </button>
          {error && <span className="text-red-500 text-xs">{error}</span>}
        </div>
      )}
    </div>
  );
};

export default DateRangeSelector;
