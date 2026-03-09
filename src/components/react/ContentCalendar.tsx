import { useState, useMemo } from 'react';

type ContentType = 'POST' | 'VIDEO' | 'CAROUSEL' | 'STORY';
type ContentStatus = 'todo' | 'doing' | 'done';
type PublishStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'partially_failed' | 'failed';
type Platform = 'instagram' | 'facebook';

interface ContentItem {
  id: string;
  type: ContentType;
  number?: number;
  customName?: string;
  status: ContentStatus;
  scheduledDate: string;
  scheduledDay: number;
  monthLabel: string;
  clientId: string;
  clientName: string;
  caption?: string;
  mediaUrls?: string[];
  platforms?: Platform[];
  publishStatus?: PublishStatus;
  publishError?: string;
  scheduledPostTime?: string;
}

interface ClientOption {
  id: string;
  name: string;
}

interface Props {
  items: ContentItem[];
  clients: ClientOption[];
}

const CONTENT_COLORS: Record<ContentType, string> = {
  POST: 'bg-indigo-500',
  VIDEO: 'bg-purple-500',
  CAROUSEL: 'bg-orange-500',
  STORY: 'bg-pink-500',
};

const CONTENT_LABELS: Record<ContentType, string> = {
  POST: 'Posts',
  VIDEO: 'Videos',
  CAROUSEL: 'Carousels',
  STORY: 'Stories',
};

const STATUS_COLORS: Record<ContentStatus, string> = {
  todo: 'bg-gray-100 text-gray-700',
  doing: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
};

const PUBLISH_STATUS_BADGE: Record<PublishStatus, { cls: string; label: string }> = {
  draft: { cls: 'bg-gray-100 text-gray-600', label: 'Draft' },
  scheduled: { cls: 'bg-yellow-100 text-yellow-700', label: 'Scheduled' },
  publishing: { cls: 'bg-blue-100 text-blue-700', label: 'Publishing...' },
  published: { cls: 'bg-green-100 text-green-700', label: 'Published' },
  partially_failed: { cls: 'bg-orange-100 text-orange-700', label: 'Partial Failure' },
  failed: { cls: 'bg-red-100 text-red-700', label: 'Failed' },
};

const SECTIONS: ContentType[] = ['POST', 'VIDEO', 'STORY', 'CAROUSEL'];
const STATUS_OPTIONS: ContentStatus[] = ['todo', 'doing', 'done'];

export default function ContentCalendar({ items: initialItems, clients }: Props) {
  const [items, setItems] = useState<ContentItem[]>(initialItems);
  const [expanded, setExpanded] = useState<Set<ContentType>>(new Set(SECTIONS));
  const [filterClient, setFilterClient] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // Edit modal state
  const [selected, setSelected] = useState<ContentItem | null>(null);
  const [editStatus, setEditStatus] = useState<ContentStatus>('todo');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editName, setEditName] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editPlatforms, setEditPlatforms] = useState<Set<Platform>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Derive unique months from items
  const months = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.monthLabel));
    return Array.from(set).sort();
  }, [items]);

  // Filtered items
  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filterClient && i.clientId !== filterClient) return false;
      if (filterMonth && i.monthLabel !== filterMonth) return false;
      return true;
    });
  }, [items, filterClient, filterMonth]);

  // Group by type
  const grouped = useMemo(() => {
    const map: Record<ContentType, ContentItem[]> = { POST: [], VIDEO: [], STORY: [], CAROUSEL: [] };
    filtered.forEach((i) => {
      if (map[i.type]) map[i.type].push(i);
    });
    return map;
  }, [filtered]);

  function toggleSection(type: ContentType) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function openModal(item: ContentItem) {
    setSelected(item);
    setEditStatus(item.status);
    setEditDate(item.scheduledDate);
    setEditTime(item.scheduledPostTime || '');
    setEditName(item.customName || '');
    setEditCaption(item.caption || '');
    setEditPlatforms(new Set(item.platforms || []));
    setSaveError('');
  }

  function closeModal() {
    setSelected(null);
    setSaveError('');
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setSaveError('');

    try {
      const updates: Record<string, unknown> = {};
      if (editStatus !== selected.status) updates.status = editStatus;
      if (editDate !== selected.scheduledDate) updates.scheduledDate = editDate;
      if (editTime !== (selected.scheduledPostTime || '')) updates.scheduledPostTime = editTime;
      if (editName !== (selected.customName || '')) updates.customName = editName;
      if (editCaption !== (selected.caption || '')) updates.caption = editCaption;

      const platformsArr = Array.from(editPlatforms);
      const origPlatforms = selected.platforms || [];
      if (JSON.stringify(platformsArr.sort()) !== JSON.stringify([...origPlatforms].sort())) {
        updates.platforms = platformsArr;
      }

      if (Object.keys(updates).length === 0) {
        closeModal();
        return;
      }

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

      const newDay = new Date(editDate + 'T00:00:00').getDate();
      const newMonthLabel = editDate.substring(0, 7);
      setItems((all) =>
        all.map((i) =>
          i.id === selected.id
            ? {
                ...i,
                status: editStatus,
                scheduledDate: editDate,
                scheduledDay: newDay,
                monthLabel: newMonthLabel,
                customName: editName || undefined,
                caption: editCaption || undefined,
                platforms: platformsArr.length > 0 ? platformsArr : undefined,
                scheduledPostTime: editTime || undefined,
              }
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

  function togglePlatform(p: Platform) {
    setEditPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function formatMonthLabel(ml: string): string {
    const [y, m] = ml.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function itemDisplayName(item: ContentItem): string {
    if (item.customName) return item.customName;
    return `${item.type} ${item.number || ''}`.trim();
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">All Months</option>
          {months.map((m) => (
            <option key={m} value={m}>{formatMonthLabel(m)}</option>
          ))}
        </select>
      </div>

      {/* Accordion Sections */}
      <div className="space-y-4">
        {SECTIONS.map((type) => {
          const typeItems = grouped[type];
          const isOpen = expanded.has(type);

          return (
            <div key={type} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Accordion Header */}
              <button
                onClick={() => toggleSection(type)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${CONTENT_COLORS[type]}`} />
                  <span className="font-semibold text-gray-900">{CONTENT_LABELS[type]}</span>
                  <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
                    {typeItems.length}
                  </span>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Accordion Body */}
              {isOpen && (
                <div className="border-t border-gray-100">
                  {typeItems.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-gray-400">No items</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {typeItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => openModal(item)}
                          className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors flex items-center gap-4"
                        >
                          {/* Name */}
                          <span className="font-medium text-sm text-gray-900 w-36 truncate flex-shrink-0">
                            {itemDisplayName(item)}
                          </span>

                          {/* Date */}
                          <span className="text-xs text-gray-500 w-32 flex-shrink-0">
                            {formatDate(item.scheduledDate)}
                          </span>

                          {/* Client */}
                          <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                            {item.clientName}
                          </span>

                          {/* Status */}
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[item.status]}`}>
                            {item.status}
                          </span>

                          {/* Caption preview */}
                          <span className="text-xs text-gray-400 truncate flex-1 min-w-0">
                            {item.caption ? (item.caption.length > 80 ? item.caption.slice(0, 80) + '...' : item.caption) : '—'}
                          </span>

                          {/* Platforms */}
                          <div className="flex gap-1 flex-shrink-0">
                            {item.platforms?.map((p) => (
                              <span key={p} className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                                {p === 'instagram' ? 'IG' : 'FB'}
                              </span>
                            ))}
                          </div>

                          {/* Publish status */}
                          {item.publishStatus && item.publishStatus !== 'draft' && (
                            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${PUBLISH_STATUS_BADGE[item.publishStatus].cls}`}>
                              {PUBLISH_STATUS_BADGE[item.publishStatus].label}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Edit Content Item</h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Type badge (read-only) */}
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${CONTENT_COLORS[selected.type]}`} />
                <span className="text-sm font-medium text-gray-700">{selected.type}</span>
                <span className="text-xs text-gray-400">#{selected.number}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full ml-auto">{selected.clientName}</span>
              </div>

              {/* Custom Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={`${selected.type} ${selected.number || ''}`}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as ContentStatus)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Scheduled Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Platforms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Platforms</label>
                <div className="flex gap-3">
                  {(['instagram', 'facebook'] as Platform[]).map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editPlatforms.has(p)}
                        onChange={() => togglePlatform(p)}
                        className="rounded border-gray-300"
                      />
                      {p === 'instagram' ? 'Instagram' : 'Facebook'}
                    </label>
                  ))}
                </div>
              </div>

              {/* Caption */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Caption</label>
                <textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  rows={5}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y"
                  placeholder="Write caption..."
                />
              </div>

              {/* Error */}
              {saveError && (
                <p className="text-sm text-red-600">{saveError}</p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
