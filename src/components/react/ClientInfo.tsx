import { useState, useRef } from 'react';

interface Props {
  clientId: string;
  clientName: string;
  clickupId: string;
  createdAt: string;
  startMonth: string;
  monthsCount: number;
  postsPerMonth: number;
  scenariosPerMonth: number;
  carouselsPerMonth: number;
  storiesPerMonth: number;
  totalItems: number;
  todoCount: number;
  doingCount: number;
  doneCount: number;
  initialNotes: string;
  initialActive: boolean;
}

export default function ClientInfo({
  clientId,
  clientName,
  clickupId: initialClickupId,
  createdAt,
  startMonth,
  monthsCount,
  postsPerMonth: initialPosts,
  scenariosPerMonth: initialScenarios,
  carouselsPerMonth: initialCarousels,
  storiesPerMonth: initialStories,
  totalItems,
  todoCount,
  doingCount,
  doneCount,
  initialNotes,
  initialActive,
}: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [active, setActive] = useState(initialActive);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Editable fields
  const [name, setName] = useState(clientName);
  const [clickupId, setClickupId] = useState(initialClickupId);
  const [posts, setPosts] = useState(initialPosts);
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [carousels, setCarousels] = useState(initialCarousels);
  const [stories, setStories] = useState(initialStories);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editClickupId, setEditClickupId] = useState('');
  const [editPosts, setEditPosts] = useState(0);
  const [editScenarios, setEditScenarios] = useState(0);
  const [editCarousels, setEditCarousels] = useState(0);
  const [editStories, setEditStories] = useState(0);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

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

  function openEditModal() {
    setEditName(name);
    setEditClickupId(clickupId);
    setEditPosts(posts);
    setEditScenarios(scenarios);
    setEditCarousels(carousels);
    setEditStories(stories);
    setEditError('');
    setShowEditModal(true);
  }

  async function handleSaveEdit() {
    if (!editName.trim()) {
      setEditError('Client name is required');
      return;
    }
    setEditSaving(true);
    setEditError('');
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          clickupId: editClickupId,
          postsPerMonth: editPosts,
          scenariosPerMonth: editScenarios,
          carouselsPerMonth: editCarousels,
          storiesPerMonth: editStories,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error || 'Failed to save');
        return;
      }
      // Update local state
      setName(editName.trim());
      setClickupId(editClickupId);
      setPosts(editPosts);
      setScenarios(editScenarios);
      setCarousels(editCarousels);
      setStories(editStories);
      setShowEditModal(false);
    } catch {
      setEditError('Network error');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete "${name}"? This will permanently remove the client and all their scheduled content.`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete' }),
      });
      if (res.ok) {
        window.location.href = '/clients';
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete client');
      }
    } catch {
      alert('Network error while deleting client');
    } finally {
      setDeleting(false);
    }
  }

  async function toggleActive() {
    const newActive = !active;
    setActive(newActive);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive }),
      });
      if (!res.ok) setActive(!newActive);
    } catch {
      setActive(!newActive);
    }
  }

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

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none';
  const labelClass = 'block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5';

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="px-6 py-5">
          {/* Top row: name + meta */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900">{name}</h2>
                <button
                  onClick={toggleActive}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-red-100 text-red-700 border border-red-300'
                  }`}
                >
                  {active ? 'Active' : 'Inactive'}
                </button>
                <button
                  onClick={openEditModal}
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Created {createdDate}</p>
              {clickupId && (
                <p className="text-xs text-gray-500 mt-0.5">
                  ClickUp ID: <span className="font-mono text-gray-700">{clickupId}</span>
                </p>
              )}
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
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
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
              <div className="text-sm font-semibold text-indigo-700 mt-0.5">{posts}</div>
            </div>
            <div className="bg-teal-50 rounded-lg px-3 py-2">
              <div className="text-[10px] font-medium text-teal-400 uppercase tracking-wider">Scenarios / mo</div>
              <div className="text-sm font-semibold text-teal-700 mt-0.5">{scenarios}</div>
            </div>
            <div className="bg-orange-50 rounded-lg px-3 py-2">
              <div className="text-[10px] font-medium text-orange-400 uppercase tracking-wider">Carousels / mo</div>
              <div className="text-sm font-semibold text-orange-700 mt-0.5">{carousels}</div>
            </div>
            <div className="bg-pink-50 rounded-lg px-3 py-2">
              <div className="text-[10px] font-medium text-pink-400 uppercase tracking-wider">Stories / mo</div>
              <div className="text-sm font-semibold text-pink-700 mt-0.5">{stories}</div>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Total / mo</div>
              <div className="text-sm font-semibold text-gray-900 mt-0.5">{posts + (scenarios * 2) + carousels + stories}</div>
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

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowEditModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Edit Client</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={labelClass}>Client Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>ClickUp ID</label>
                <input
                  type="text"
                  value={editClickupId}
                  onChange={(e) => setEditClickupId(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. abc123xyz"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Posts / mo</label>
                  <input
                    type="number"
                    value={editPosts}
                    onChange={(e) => setEditPosts(Number(e.target.value))}
                    className={inputClass}
                    min={0}
                  />
                </div>
                <div>
                  <label className={labelClass}>Scenarios / mo</label>
                  <input
                    type="number"
                    value={editScenarios}
                    onChange={(e) => setEditScenarios(Number(e.target.value))}
                    className={inputClass}
                    min={0}
                  />
                </div>
                <div>
                  <label className={labelClass}>Carousels / mo</label>
                  <input
                    type="number"
                    value={editCarousels}
                    onChange={(e) => setEditCarousels(Number(e.target.value))}
                    className={inputClass}
                    min={0}
                  />
                </div>
                <div>
                  <label className={labelClass}>Stories / mo</label>
                  <input
                    type="number"
                    value={editStories}
                    onChange={(e) => setEditStories(Number(e.target.value))}
                    className={inputClass}
                    min={0}
                  />
                </div>
              </div>

              {editError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {editError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
