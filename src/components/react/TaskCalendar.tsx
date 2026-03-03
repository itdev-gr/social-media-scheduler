import { useState, useMemo } from 'react';

type TaskStatus = 'todo' | 'doing' | 'done';
type ViewMode = 'month' | 'week';

interface TaskItem {
  id: string;
  title: string;
  status: TaskStatus;
  scheduledDate: string;
  clientId: string;
  clientName: string;
}

interface ClientOption {
  id: string;
  name: string;
}

interface Props {
  items: TaskItem[];
  clients?: ClientOption[];
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-gray-500',
  doing: 'bg-blue-500',
  done: 'bg-green-500',
};

const STATUS_BADGE: Record<TaskStatus, string> = {
  todo: 'bg-gray-100 text-gray-700',
  doing: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
};

const STATUS_OPTIONS: TaskStatus[] = ['todo', 'doing', 'done'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

export default function TaskCalendar({ items: initialItems, clients }: Props) {
  const [items, setItems] = useState<TaskItem[]>(initialItems);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [activeStatuses, setActiveStatuses] = useState<Set<TaskStatus>>(new Set(STATUS_OPTIONS));

  const { year, month } = currentDate;

  function prevMonth() {
    setCurrentDate((d) => {
      const m = d.month - 1;
      return m < 0 ? { year: d.year - 1, month: 11 } : { year: d.year, month: m };
    });
  }
  function nextMonth() {
    setCurrentDate((d) => {
      const m = d.month + 1;
      return m > 11 ? { year: d.year + 1, month: 0 } : { year: d.year, month: m };
    });
  }
  function prevWeek() {
    setWeekStart((d) => {
      const prev = new Date(d);
      prev.setDate(prev.getDate() - 7);
      return prev;
    });
  }
  function nextWeek() {
    setWeekStart((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + 7);
      return next;
    });
  }
  function goToToday() {
    const now = new Date();
    setCurrentDate({ year: now.getFullYear(), month: now.getMonth() });
    setWeekStart(getMonday(now));
  }

  function toggleStatus(s: TaskStatus) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  const itemsByDate = useMemo(() => {
    const filtered = items.filter((item) => activeStatuses.has(item.status));
    const map = new Map<string, TaskItem[]>();
    for (const item of filtered) {
      const existing = map.get(item.scheduledDate);
      if (existing) existing.push(item);
      else map.set(item.scheduledDate, [item]);
    }
    return map;
  }, [items, activeStatuses]);

  const today = new Date();
  const todayStr = formatDateStr(today);

  const monthCells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    const cells: { day: number | null; dateStr: string }[] = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        cells.push({ day: null, dateStr: '' });
      } else {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        cells.push({ day: dayNum, dateStr });
      }
    }
    return cells;
  }, [year, month]);

  const weekDays = useMemo(() => {
    const days: { date: Date; dateStr: string; dayName: string; dayNum: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push({
        date: d,
        dateStr: formatDateStr(d),
        dayName: DAYS[i],
        dayNum: d.getDate(),
      });
    }
    return days;
  }, [weekStart]);

  const monthLabel = new Date(year, month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const weekLabel = (() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startMonth} – ${endMonth}`;
  })();

  function renderTaskChip(item: TaskItem) {
    return (
      <div
        key={item.id}
        className={`w-full text-left text-[10px] font-medium text-white px-1.5 py-0.5 rounded truncate ${STATUS_COLORS[item.status]}`}
      >
        {item.title} · {item.clientName}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={viewMode === 'month' ? prevMonth : prevWeek}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
            {viewMode === 'month' ? monthLabel : weekLabel}
          </h3>
          <button
            onClick={viewMode === 'month' ? nextMonth : nextWeek}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Today
          </button>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'month'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'week'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Month View */}
      {viewMode === 'month' && (
        <>
          <div className="grid grid-cols-7 border-b border-gray-200">
            {DAYS.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((cell, i) => {
              const dayItems = cell.dateStr ? itemsByDate.get(cell.dateStr) || [] : [];
              const isToday = cell.dateStr === todayStr;
              return (
                <div
                  key={i}
                  className={`min-h-[100px] border-b border-r border-gray-100 p-1.5 ${cell.day === null ? 'bg-gray-50' : ''}`}
                >
                  {cell.day !== null && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>
                          {cell.day}
                        </div>
                      </div>
                      <div className="space-y-1">
                        {dayItems.map((item) => renderTaskChip(item))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <>
          <div className="grid grid-cols-7 border-b border-gray-200">
            {weekDays.map((wd) => {
              const isToday = wd.dateStr === todayStr;
              return (
                <div key={wd.dateStr} className="py-2 text-center">
                  <div className="text-xs font-medium text-gray-500">{wd.dayName}</div>
                  <div className={`text-sm font-semibold mt-0.5 w-7 h-7 flex items-center justify-center rounded-full mx-auto ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-900'}`}>
                    {wd.dayNum}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7">
            {weekDays.map((wd) => {
              const dayItems = itemsByDate.get(wd.dateStr) || [];
              return (
                <div key={wd.dateStr} className="min-h-[300px] border-r border-gray-100 p-2">
                  <div className="space-y-1.5">
                    {dayItems.map((item) => (
                      <div
                        key={item.id}
                        className={`w-full text-left px-2 py-1.5 rounded-lg ${STATUS_COLORS[item.status]}`}
                      >
                        <div className="text-[11px] font-semibold text-white">{item.title}</div>
                        <div className="text-[10px] text-white/80 truncate">{item.clientName}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Filters */}
      <div className="px-6 py-3 border-t border-gray-200 flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => toggleStatus(s)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
              activeStatuses.has(s)
                ? STATUS_BADGE[s] + ' ring-2 ring-offset-1 ring-gray-200'
                : 'bg-gray-100 text-gray-400 line-through'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeStatuses.has(s) ? STATUS_COLORS[s] : 'bg-gray-300'}`} />
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
