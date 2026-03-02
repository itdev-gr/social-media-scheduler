import { useState } from 'react';

type ContentType = 'POST' | 'VIDEO' | 'CAROUSEL';
type ContentStatus = 'todo' | 'doing' | 'done';

interface CalendarItem {
  id: string;
  type: ContentType;
  status: ContentStatus;
  scheduledDate: string;
  scheduledDay: number;
  monthLabel: string;
  clientId: string;
  clientName: string;
}

interface Props {
  items: CalendarItem[];
}

const CONTENT_COLORS: Record<ContentType, string> = {
  POST: 'bg-indigo-500',
  VIDEO: 'bg-purple-500',
  CAROUSEL: 'bg-orange-500',
};

const STATUS_RING: Record<ContentStatus, string> = {
  todo: 'ring-gray-300',
  doing: 'ring-blue-400',
  done: 'ring-green-400',
};

const STATUS_COLORS: Record<ContentStatus, string> = {
  todo: 'bg-gray-100 text-gray-700',
  doing: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
};

const TYPE_OPTIONS: ContentType[] = ['POST', 'VIDEO', 'CAROUSEL'];
const STATUS_OPTIONS: ContentStatus[] = ['todo', 'doing', 'done'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Calendar({ items: initialItems }: Props) {
  const [items, setItems] = useState<CalendarItem[]>(initialItems);
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selected, setSelected] = useState<CalendarItem | null>(null);

  // Filter state — all active by default
  const [activeTypes, setActiveTypes] = useState<Set<ContentType>>(new Set(TYPE_OPTIONS));
  const [activeStatuses, setActiveStatuses] = useState<Set<ContentStatus>>(new Set(STATUS_OPTIONS));

  // Edit form state
  const [editType, setEditType] = useState<ContentType>('POST');
  const [editStatus, setEditStatus] = useState<ContentStatus>('todo');
  const [editDate, setEditDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const { year, month } = currentDate;

  function openModal(item: CalendarItem) {
    setSelected(item);
    setEditType(item.type);
    setEditStatus(item.status);
    setEditDate(item.scheduledDate);
    setSaveError('');
  }

  function closeModal() {
    setSelected(null);
    setSaveError('');
  }

  function prev() {
    setCurrentDate((d) => {
      const m = d.month - 1;
      return m < 0 ? { year: d.year - 1, month: 11 } : { year: d.year, month: m };
    });
  }

  function next() {
    setCurrentDate((d) => {
      const m = d.month + 1;
      return m > 11 ? { year: d.year + 1, month: 0 } : { year: d.year, month: m };
    });
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setSaveError('');

    const updates: Record<string, string> = {};
    if (editType !== selected.type) updates.type = editType;
    if (editStatus !== selected.status) updates.status = editStatus;
    if (editDate !== selected.scheduledDate) updates.scheduledDate = editDate;

    if (Object.keys(updates).length === 0) {
      closeModal();
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error || 'Failed to save');
        setSaving(false);
        return;
      }

      // Update local state
      const newDay = new Date(editDate + 'T00:00:00').getDate();
      const newMonthLabel = editDate.substring(0, 7);
      setItems((all) =>
        all.map((i) =>
          i.id === selected.id
            ? { ...i, type: editType, status: editStatus, scheduledDate: editDate, scheduledDay: newDay, monthLabel: newMonthLabel }
            : i
        )
      );
      closeModal();
    } catch {
      setSaveError('Network error');
    } finally {
      setSaving(false);
    }
  }

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  // Apply filters
  const filteredItems = items.filter(
    (item) => activeTypes.has(item.type) && activeStatuses.has(item.status)
  );

  const itemsByDate = new Map<string, CalendarItem[]>();
  for (const item of filteredItems) {
    const existing = itemsByDate.get(item.scheduledDate);
    if (existing) existing.push(item);
    else itemsByDate.set(item.scheduledDate, [item]);
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const monthLabel = new Date(year, month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

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

  function toggleType(t: ContentType) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function toggleStatus(s: ContentStatus) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none';
  const labelClass = 'block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5';

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <button onClick={prev} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-lg font-semibold text-gray-900">{monthLabel}</h3>
          <button onClick={next} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {DAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const dayItems = cell.dateStr ? itemsByDate.get(cell.dateStr) || [] : [];
            const isToday = cell.dateStr === todayStr;

            return (
              <div
                key={i}
                className={`min-h-[100px] border-b border-r border-gray-100 p-1.5 ${cell.day === null ? 'bg-gray-50' : ''}`}
              >
                {cell.day !== null && (
                  <>
                    <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>
                      {cell.day}
                    </div>
                    <div className="space-y-1">
                      {dayItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => openModal(item)}
                          className={`w-full text-left text-[10px] font-medium text-white px-1.5 py-0.5 rounded truncate ring-2 cursor-pointer hover:opacity-80 transition-opacity ${CONTENT_COLORS[item.type]} ${STATUS_RING[item.status]}`}
                        >
                          {item.type} · {item.clientName}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-t border-gray-200 flex gap-2 flex-wrap">
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                activeTypes.has(t)
                  ? `text-white ${CONTENT_COLORS[t]}`
                  : 'bg-gray-100 text-gray-400 line-through'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${activeTypes.has(t) ? 'bg-white/60' : 'bg-gray-300'}`} />
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
          <span className="text-xs text-gray-300 flex items-center">|</span>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                activeStatuses.has(s)
                  ? STATUS_COLORS[s] + ' ring-2 ring-offset-1 ring-gray-200'
                  : 'bg-gray-100 text-gray-400 line-through'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ring-2 ${activeStatuses.has(s) ? STATUS_RING[s] : 'ring-gray-200'} ${activeStatuses.has(s) ? 'bg-gray-400' : 'bg-gray-300'}`} />
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeModal}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Edit Content Item</h3>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={labelClass}>Client</label>
                <p className="text-sm font-semibold text-gray-900">{selected.clientName}</p>
              </div>

              <div>
                <label className={labelClass}>Content Type</label>
                <div className="flex gap-2">
                  {TYPE_OPTIONS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditType(t)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        editType === t
                          ? `text-white ${CONTENT_COLORS[t]}`
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>Scheduled Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Status</label>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditStatus(s)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        editStatus === s
                          ? STATUS_COLORS[s] + ' ring-2 ring-offset-1 ring-gray-300'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {saveError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {saveError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
