import { useState, useMemo, useEffect, useRef } from 'react';

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
  mediaIds?: string[];
  platforms?: Platform[];
  publishStatus?: PublishStatus;
  publishError?: string;
  scheduledPostTime?: string;
}

interface ClientOption {
  id: string;
  name: string;
}

interface SocialAccount {
  id: number;
  platform: Platform;
  name: string;
  username?: string;
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

const CONTENT_HEADER_COLORS: Record<ContentType, string> = {
  POST: 'bg-indigo-600',
  VIDEO: 'bg-purple-600',
  CAROUSEL: 'bg-orange-600',
  STORY: 'bg-pink-600',
};

const SECTIONS: ContentType[] = ['POST', 'VIDEO', 'STORY', 'CAROUSEL'];
const TYPE_OPTIONS: ContentType[] = ['POST', 'VIDEO', 'CAROUSEL', 'STORY'];
const STATUS_OPTIONS: ContentStatus[] = ['todo', 'doing', 'done'];

export default function ContentCalendar({ items: initialItems, clients }: Props) {
  const [items, setItems] = useState<ContentItem[]>(initialItems);
  const [expanded, setExpanded] = useState<Set<ContentType>>(new Set(SECTIONS));
  const [filterClient, setFilterClient] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // Edit modal state
  const [selected, setSelected] = useState<ContentItem | null>(null);
  const [editType, setEditType] = useState<ContentType>('POST');
  const [editStatus, setEditStatus] = useState<ContentStatus>('todo');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editName, setEditName] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editPlatforms, setEditPlatforms] = useState<Set<Platform>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Media upload state
  const [editMediaFiles, setEditMediaFiles] = useState<File[]>([]);
  const [editMediaPreviews, setEditMediaPreviews] = useState<string[]>([]);
  const [editUploadedMediaIds, setEditUploadedMediaIds] = useState<string[]>([]);
  const [editUploadedMediaUrls, setEditUploadedMediaUrls] = useState<string[]>([]);
  const [editUploadProgress, setEditUploadProgress] = useState<number | null>(null);

  // Publish state
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);

  // Status polling ref
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch social accounts on mount
  useEffect(() => {
    fetch('/api/post-bridge/social-accounts')
      .then((res) => res.json())
      .then((data) => {
        if (data.accounts) setSocialAccounts(data.accounts);
      })
      .catch((err) => console.error('Failed to fetch social accounts:', err));
  }, []);

  // Status polling for edit modal
  useEffect(() => {
    if (selected && (selected.publishStatus === 'publishing' || selected.publishStatus === 'scheduled')) {
      statusPollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/post-bridge/status/${selected.id}`);
          const data = await res.json();
          if (data.publishStatus && data.publishStatus !== selected.publishStatus) {
            setSelected((prev) => prev ? { ...prev, publishStatus: data.publishStatus, publishError: data.publishError } : null);
            setItems((all) =>
              all.map((i) => i.id === selected.id ? { ...i, publishStatus: data.publishStatus, publishError: data.publishError } : i)
            );
            if (data.publishStatus === 'published' || data.publishStatus === 'failed' || data.publishStatus === 'partially_failed') {
              if (statusPollRef.current) clearInterval(statusPollRef.current);
            }
          }
        } catch {
          // ignore polling errors
        }
      }, 5000);
    }
    return () => {
      if (statusPollRef.current) clearInterval(statusPollRef.current);
    };
  }, [selected?.id, selected?.publishStatus]);

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
    setEditType(item.type);
    setEditStatus(item.status);
    setEditDate(item.scheduledDate);
    setEditTime(item.scheduledPostTime || '');
    setEditName(item.customName || '');
    setEditCaption(item.caption || '');
    setEditPlatforms(new Set(item.platforms || []));
    setEditMediaFiles([]);
    setEditMediaPreviews(item.mediaUrls || []);
    setEditUploadedMediaIds(item.mediaIds || []);
    setEditUploadedMediaUrls(item.mediaUrls || []);
    setEditUploadProgress(null);
    setSaveError('');
    setPublishError('');
  }

  function closeModal() {
    setSelected(null);
    setSaveError('');
    setPublishError('');
  }

  async function uploadFiles(files: File[]): Promise<{ mediaIds: string[]; mediaUrls: string[] }> {
    const mediaIds: string[] = [];
    const mediaUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      const uploadRes = await fetch('/api/post-bridge/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mimeType: file.type,
          sizeBytes: file.size,
          name: file.name,
        }),
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || 'Failed to get upload URL');
      }

      const { mediaId, uploadUrl } = await uploadRes.json();

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error(`Failed to upload ${file.name}`);
      }

      mediaIds.push(mediaId);
      mediaUrls.push(URL.createObjectURL(file));
    }

    return { mediaIds, mediaUrls };
  }

  function handleFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    const previews = newFiles.map((f) => URL.createObjectURL(f));
    setEditMediaFiles((prev) => [...prev, ...newFiles]);
    setEditMediaPreviews((prev) => [...prev, ...previews]);
  }

  function removeMedia(index: number) {
    setEditMediaPreviews((prev) => prev.filter((_, i) => i !== index));
    if (index < editUploadedMediaIds.length) {
      setEditUploadedMediaIds((prev) => prev.filter((_, i) => i !== index));
      setEditUploadedMediaUrls((prev) => prev.filter((_, i) => i !== index));
    } else {
      const fileIndex = index - editUploadedMediaIds.length;
      setEditMediaFiles((prev) => prev.filter((_, i) => i !== fileIndex));
    }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setSaveError('');

    try {
      // Upload any new media files first
      let newMediaIds = [...editUploadedMediaIds];
      let newMediaUrls = [...editUploadedMediaUrls];

      if (editMediaFiles.length > 0) {
        setEditUploadProgress(0);
        const result = await uploadFiles(editMediaFiles);
        newMediaIds = [...newMediaIds, ...result.mediaIds];
        newMediaUrls = [...newMediaUrls, ...result.mediaUrls];
        setEditUploadProgress(null);
      }

      const updates: Record<string, unknown> = {};
      if (editType !== selected.type) updates.type = editType;
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

      if (JSON.stringify(newMediaIds) !== JSON.stringify(selected.mediaIds || [])) {
        updates.mediaIds = newMediaIds;
        updates.mediaUrls = newMediaUrls;
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
                type: editType,
                status: editStatus,
                scheduledDate: editDate,
                scheduledDay: newDay,
                monthLabel: newMonthLabel,
                customName: editName || undefined,
                caption: editCaption || undefined,
                platforms: platformsArr.length > 0 ? platformsArr : undefined,
                mediaIds: newMediaIds.length > 0 ? newMediaIds : undefined,
                mediaUrls: newMediaUrls.length > 0 ? newMediaUrls : undefined,
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

  async function handlePublish(immediate: boolean) {
    if (!selected) return;
    setPublishing(true);
    setPublishError('');
    try {
      await handleSave();

      const res = await fetch('/api/post-bridge/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentItemId: selected.id, immediate, timezoneOffset: new Date().getTimezoneOffset() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setPublishError(data.error || 'Failed to publish');
        return;
      }

      const data = await res.json();
      const newStatus = data.publishStatus as PublishStatus;

      setSelected((prev) => prev ? { ...prev, publishStatus: newStatus } : null);
      setItems((all) =>
        all.map((i) => i.id === selected.id ? { ...i, publishStatus: newStatus } : i)
      );
    } catch {
      setPublishError('Network error');
    } finally {
      setPublishing(false);
    }
  }

  async function handleRetry() {
    if (!selected) return;
    setPublishing(true);
    setPublishError('');
    try {
      const res = await fetch('/api/post-bridge/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentItemId: selected.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        setPublishError(data.error || 'Retry failed');
        return;
      }

      setSelected((prev) => prev ? { ...prev, publishStatus: 'publishing', publishError: undefined } : null);
      setItems((all) =>
        all.map((i) => i.id === selected.id ? { ...i, publishStatus: 'publishing', publishError: undefined } : i)
      );
    } catch {
      setPublishError('Network error');
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm('Are you sure you want to delete this content item?')) return;
    setDeleting(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/tasks/${selected.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error || 'Failed to delete');
        return;
      }
      setItems((all) => all.filter((i) => i.id !== selected.id));
      closeModal();
    } catch {
      setSaveError('Network error');
    } finally {
      setDeleting(false);
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

  function getDayName(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
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

  function isItemReady(item: ContentItem): boolean {
    return !!(item.caption && item.platforms && item.platforms.length > 0 && item.mediaUrls && item.mediaUrls.length > 0);
  }

  const canPublishEdit = selected && editCaption && editPlatforms.size > 0;
  const canScheduleEdit = canPublishEdit && editDate && editTime;

  const hasIG = socialAccounts.some((a) => a.platform === 'instagram');
  const hasFB = socialAccounts.some((a) => a.platform === 'facebook');

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
                <div className="border-t border-gray-100 p-4">
                  {typeItems.length === 0 ? (
                    <p className="px-1 py-2 text-sm text-gray-400">No items</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {typeItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => openModal(item)}
                          className="rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col"
                        >
                          {/* Day header */}
                          <div className={`${CONTENT_HEADER_COLORS[item.type]} px-3 py-2 text-center`}>
                            <span className="text-white text-xs font-bold tracking-wider">
                              {getDayName(item.scheduledDate)} {item.scheduledDate.slice(8, 10)}/{item.scheduledDate.slice(5, 7)}
                            </span>
                          </div>

                          {/* Media preview */}
                          <div className="relative aspect-square bg-gray-100">
                            {item.mediaUrls && item.mediaUrls.length > 0 ? (
                              <img
                                src={item.mediaUrls[0]}
                                alt={itemDisplayName(item)}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                            {/* Client name overlay */}
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-4">
                              <span className="text-white text-xs font-semibold drop-shadow-sm">
                                {item.customName || item.clientName}
                              </span>
                            </div>
                          </div>

                          {/* Info rows */}
                          <div className="divide-y divide-gray-100">
                            {/* Approval Status */}
                            <div className="flex items-center justify-between px-2.5 py-1.5 bg-yellow-50">
                              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Approval Status</span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_COLORS[item.status]}`}>
                                {item.status.toUpperCase()}
                              </span>
                            </div>

                            {/* Content Type */}
                            <div className="flex items-center justify-between px-2.5 py-1.5 bg-green-50">
                              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Content Type</span>
                              <span className={`text-[10px] font-semibold text-white px-1.5 py-0.5 rounded ${CONTENT_COLORS[item.type]}`}>
                                {item.type}
                              </span>
                            </div>

                            {/* Platform */}
                            <div className="flex items-center justify-between px-2.5 py-1.5 bg-red-50">
                              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Platform</span>
                              <div className="flex gap-1">
                                {item.platforms && item.platforms.length > 0 ? (
                                  item.platforms.map((p) => (
                                    <span key={p} className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                                      {p === 'instagram' ? 'IG' : 'FB'}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-gray-400">—</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeModal}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Edit Content Item</h3>
                {selected.publishStatus && selected.publishStatus !== 'draft' && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${PUBLISH_STATUS_BADGE[selected.publishStatus].cls}`}>
                    {PUBLISH_STATUS_BADGE[selected.publishStatus].label}
                  </span>
                )}
              </div>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              {/* Client info */}
              <div className="flex items-center gap-2">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{selected.clientName}</span>
                <span className="text-xs text-gray-400">#{selected.number}</span>
              </div>

              {/* Content Type */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Content Type</label>
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

              {/* Custom Name */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Task Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={`${selected.type} ${selected.number || ''}`}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Caption */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Caption / Description</label>
                <textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  placeholder="Write your post caption here..."
                />
              </div>

              {/* Media Upload */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Media</label>
                {editMediaPreviews.length > 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {editMediaPreviews.map((url, i) => (
                      <div key={i} className="relative w-16 h-16">
                        <img src={url} alt="" className="w-full h-full object-cover rounded-lg" />
                        <button
                          type="button"
                          onClick={() => removeMedia(i)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,video/mp4"
                  multiple
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="block w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
                />
                {editUploadProgress !== null && (
                  <div className="mt-1 text-xs text-indigo-600">Uploading media...</div>
                )}
              </div>

              {/* Platforms */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Platforms</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => togglePlatform('instagram')}
                    disabled={!hasIG}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      editPlatforms.has('instagram')
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        : hasIG
                          ? 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                          : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    Instagram
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePlatform('facebook')}
                    disabled={!hasFB}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      editPlatforms.has('facebook')
                        ? 'bg-blue-600 text-white'
                        : hasFB
                          ? 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                          : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    Facebook
                  </button>
                </div>
                {socialAccounts.length === 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">No social accounts connected</p>
                )}
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Date</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Post Time</label>
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
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

              {/* Publish error display */}
              {(selected.publishError || publishError) && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {publishError || selected.publishError}
                </div>
              )}

              {saveError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {saveError}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <div className="flex gap-2">
                {/* Delete button */}
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-2 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
                {/* Post Now button */}
                {canPublishEdit && selected.publishStatus !== 'published' && selected.publishStatus !== 'publishing' && (
                  <button
                    onClick={() => handlePublish(true)}
                    disabled={publishing}
                    className="px-3 py-2 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {publishing ? 'Publishing...' : 'Post Now'}
                  </button>
                )}
                {/* Schedule Post button */}
                {canScheduleEdit && selected.publishStatus !== 'published' && selected.publishStatus !== 'scheduled' && selected.publishStatus !== 'publishing' && (
                  <button
                    onClick={() => handlePublish(false)}
                    disabled={publishing}
                    className="px-3 py-2 text-xs font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors"
                  >
                    Schedule Post
                  </button>
                )}
                {/* Retry button */}
                {(selected.publishStatus === 'failed' || selected.publishStatus === 'partially_failed') && (
                  <button
                    onClick={handleRetry}
                    disabled={publishing}
                    className="px-3 py-2 text-xs font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
                  >
                    {publishing ? 'Retrying...' : 'Retry'}
                  </button>
                )}
              </div>
              <div className="flex gap-3">
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
        </div>
      )}
    </div>
  );
}
