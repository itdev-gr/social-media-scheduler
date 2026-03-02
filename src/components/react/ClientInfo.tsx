import { useState, useRef } from 'react';

interface Props {
  clientId: string;
  clientName: string;
  createdAt: string;
  startMonth: string;
  monthsCount: number;
  postsPerMonth: number;
  videosPerMonth: number;
  carouselsPerMonth: number;
  totalItems: number;
  todoCount: number;
  doingCount: number;
  doneCount: number;
  initialNotes: string;
}

export default function ClientInfo({
  clientId,
  clientName,
  createdAt,
  startMonth,
  monthsCount,
  postsPerMonth,
  videosPerMonth,
  carouselsPerMonth,
  totalItems,
  todoCount,
  doingCount,
  doneCount,
  initialNotes,
}: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const createdDate = new Date(createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const [startYear, startMo] = startMonth.split('-');
  const startLabel = new Date(+startYear, +startMo - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  async function saveNotes() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        setSaved(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  const stats = [
    { label: 'Total', value: totalItems, color: 'bg-gray-100 text-gray-700' },
    { label: 'To Do', value: todoCount, color: 'bg-gray-100 text-gray-600' },
    { label: 'Doing', value: doingCount, color: 'bg-blue-50 text-blue-700' },
    { label: 'Done', value: doneCount, color: 'bg-green-50 text-green-700' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
      <div className="px-6 py-5">
        {/* Top row: name + meta */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{clientName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Created {createdDate}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {stats.map((s) => (
              <div key={s.label} className={`px-3 py-1.5 rounded-lg text-center ${s.color}`}>
                <div className="text-lg font-bold leading-tight">{s.value}</div>
                <div className="text-[10px] font-medium uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Plan details */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Start</div>
            <div className="text-sm font-semibold text-gray-900 mt-0.5">{startLabel}</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Duration</div>
            <div className="text-sm font-semibold text-gray-900 mt-0.5">{monthsCount} month{monthsCount !== 1 ? 's' : ''}</div>
          </div>
          <div className="bg-indigo-50 rounded-lg px-3 py-2">
            <div className="text-[10px] font-medium text-indigo-400 uppercase tracking-wider">Posts / mo</div>
            <div className="text-sm font-semibold text-indigo-700 mt-0.5">{postsPerMonth}</div>
          </div>
          <div className="bg-purple-50 rounded-lg px-3 py-2">
            <div className="text-[10px] font-medium text-purple-400 uppercase tracking-wider">Videos / mo</div>
            <div className="text-sm font-semibold text-purple-700 mt-0.5">{videosPerMonth}</div>
          </div>
          <div className="bg-orange-50 rounded-lg px-3 py-2">
            <div className="text-[10px] font-medium text-orange-400 uppercase tracking-wider">Carousels / mo</div>
            <div className="text-sm font-semibold text-orange-700 mt-0.5">{carouselsPerMonth}</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Total / mo</div>
            <div className="text-sm font-semibold text-gray-900 mt-0.5">{postsPerMonth + videosPerMonth + carouselsPerMonth}</div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Notes</label>
            <div className="flex items-center gap-2">
              {saved && <span className="text-xs text-green-600">Saved</span>}
              <button
                onClick={saveNotes}
                disabled={saving}
                className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this client..."
            rows={3}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-y"
          />
        </div>
      </div>
    </div>
  );
}
