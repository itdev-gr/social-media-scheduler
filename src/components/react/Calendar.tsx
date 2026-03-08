import { useState, useMemo, useEffect, useRef } from 'react';

type ContentType = 'POST' | 'VIDEO' | 'CAROUSEL' | 'STORY';
type ContentStatus = 'todo' | 'doing' | 'done';
type PublishStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'partially_failed' | 'failed';
type Platform = 'instagram' | 'facebook';
type ViewMode = 'month' | 'week';

interface CalendarItem {
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
  items: CalendarItem[];
  clientId?: string;
  clientName?: string;
  clients?: ClientOption[];
}

const CONTENT_COLORS: Record<ContentType, string> = {
  POST: 'bg-indigo-500',
  VIDEO: 'bg-purple-500',
  CAROUSEL: 'bg-orange-500',
  STORY: 'bg-pink-500',
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

const PUBLISH_STATUS_BADGE: Record<PublishStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' },
  scheduled: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Scheduled' },
  publishing: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Publishing...' },
  published: { bg: 'bg-green-100', text: 'text-green-700', label: 'Published' },
  partially_failed: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Partial Failure' },
  failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
};

const TYPE_OPTIONS: ContentType[] = ['POST', 'VIDEO', 'CAROUSEL', 'STORY'];
const STATUS_OPTIONS: ContentStatus[] = ['todo', 'doing', 'done'];
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

export default function Calendar({ items: initialItems, clientId, clientName, clients }: Props) {
  const canCreate = !!(clientId || (clients && clients.length > 0));
  const [items, setItems] = useState<CalendarItem[]>(() =>
    initialItems.filter((item) => item.type !== 'SCENARIO')
  );
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [selected, setSelected] = useState<CalendarItem | null>(null);

  // Filter state
  const [activeTypes, setActiveTypes] = useState<Set<ContentType>>(new Set(TYPE_OPTIONS));
  const [activeStatuses, setActiveStatuses] = useState<Set<ContentStatus>>(new Set(STATUS_OPTIONS));

  // Edit form state
  const [editType, setEditType] = useState<ContentType>('POST');
  const [editStatus, setEditStatus] = useState<ContentStatus>('todo');
  const [editDate, setEditDate] = useState('');
  const [editName, setEditName] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editPlatforms, setEditPlatforms] = useState<Set<Platform>>(new Set());
  const [editPostTime, setEditPostTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  // Create task state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createClientId, setCreateClientId] = useState(clientId || '');
  const [createType, setCreateType] = useState<ContentType>('POST');
  const [createDate, setCreateDate] = useState('');
  const [createName, setCreateName] = useState('');
  const [createStatus, setCreateStatus] = useState<ContentStatus>('todo');
  const [createCaption, setCreateCaption] = useState('');
  const [createPlatforms, setCreatePlatforms] = useState<Set<Platform>>(new Set());
  const [createPostTime, setCreatePostTime] = useState('');
  const [createMediaFiles, setCreateMediaFiles] = useState<File[]>([]);
  const [createMediaPreviews, setCreateMediaPreviews] = useState<string[]>([]);
  const [uploadedMediaIds, setUploadedMediaIds] = useState<string[]>([]);
  const [uploadedMediaUrls, setUploadedMediaUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit modal media state
  const [editMediaFiles, setEditMediaFiles] = useState<File[]>([]);
  const [editMediaPreviews, setEditMediaPreviews] = useState<string[]>([]);
  const [editUploadedMediaIds, setEditUploadedMediaIds] = useState<string[]>([]);
  const [editUploadedMediaUrls, setEditUploadedMediaUrls] = useState<string[]>([]);
  const [editUploadProgress, setEditUploadProgress] = useState<number | null>(null);

  // Social accounts
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

  const { year, month } = currentDate;

  function openModal(item: CalendarItem) {
    setSelected(item);
    setEditType(item.type);
    setEditStatus(item.status);
    setEditDate(item.scheduledDate);
    setEditName(item.customName || '');
    setEditCaption(item.caption || '');
    setEditPlatforms(new Set(item.platforms || []));
    setEditPostTime(item.scheduledPostTime || '');
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

  function openCreateModal(prefilledDate?: string) {
    setCreateClientId(clientId || (clients && clients.length > 0 ? clients[0].id : ''));
    setCreateType('POST');
    setCreateName('');
    setCreateStatus('todo');
    setCreateDate(prefilledDate || formatDateStr(new Date()));
    setCreateCaption('');
    setCreatePlatforms(new Set());
    setCreatePostTime('');
    setCreateMediaFiles([]);
    setCreateMediaPreviews([]);
    setUploadedMediaIds([]);
    setUploadedMediaUrls([]);
    setUploadProgress(null);
    setCreateError('');
    setShowCreateModal(true);
  }

  // Month navigation
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

  // Week navigation
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

  async function uploadFiles(files: File[]): Promise<{ mediaIds: string[]; mediaUrls: string[] }> {
    const mediaIds: string[] = [];
    const mediaUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Get signed upload URL from our API
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

      // Upload file directly to signed URL
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

  function handleFileSelect(files: FileList | null, isEdit: boolean) {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    const previews = newFiles.map((f) => URL.createObjectURL(f));

    if (isEdit) {
      setEditMediaFiles((prev) => [...prev, ...newFiles]);
      setEditMediaPreviews((prev) => [...prev, ...previews]);
    } else {
      setCreateMediaFiles((prev) => [...prev, ...newFiles]);
      setCreateMediaPreviews((prev) => [...prev, ...previews]);
    }
  }

  function removeMedia(index: number, isEdit: boolean) {
    if (isEdit) {
      setEditMediaPreviews((prev) => prev.filter((_, i) => i !== index));
      if (index < editUploadedMediaIds.length) {
        // Removing an already-uploaded media
        setEditUploadedMediaIds((prev) => prev.filter((_, i) => i !== index));
        setEditUploadedMediaUrls((prev) => prev.filter((_, i) => i !== index));
      } else {
        // Removing a newly-added file
        const fileIndex = index - editUploadedMediaIds.length;
        setEditMediaFiles((prev) => prev.filter((_, i) => i !== fileIndex));
      }
    } else {
      setCreateMediaPreviews((prev) => prev.filter((_, i) => i !== index));
      setCreateMediaFiles((prev) => prev.filter((_, i) => i !== index));
      if (index < uploadedMediaIds.length) {
        setUploadedMediaIds((prev) => prev.filter((_, i) => i !== index));
        setUploadedMediaUrls((prev) => prev.filter((_, i) => i !== index));
      }
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
      if (editName !== (selected.customName || '')) updates.customName = editName;
      if (editCaption !== (selected.caption || '')) updates.caption = editCaption;
      if (editPostTime !== (selected.scheduledPostTime || '')) updates.scheduledPostTime = editPostTime;

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
                scheduledPostTime: editPostTime || undefined,
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

  async function handleCreate() {
    if (!createClientId) return;
    setCreating(true);
    setCreateError('');
    try {
      // Upload media files first
      let mediaIds: string[] = [...uploadedMediaIds];
      let mediaUrls: string[] = [...uploadedMediaUrls];

      if (createMediaFiles.length > 0) {
        setUploadProgress(0);
        const result = await uploadFiles(createMediaFiles);
        mediaIds = [...mediaIds, ...result.mediaIds];
        mediaUrls = [...mediaUrls, ...result.mediaUrls];
        setUploadProgress(null);
      }

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: createClientId,
          type: createType,
          scheduledDate: createDate,
          status: createStatus,
          ...(createName.trim() ? { customName: createName.trim() } : {}),
          ...(createCaption ? { caption: createCaption } : {}),
          ...(mediaIds.length > 0 ? { mediaIds, mediaUrls } : {}),
          ...(createPlatforms.size > 0 ? { platforms: Array.from(createPlatforms) } : {}),
          ...(createPostTime ? { scheduledPostTime: createPostTime } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCreateError(data.error || 'Failed to create task');
        return;
      }
      const data = await res.json();
      let resolvedName = clientName || '';
      if (!resolvedName && clients) {
        const found = clients.find((c) => c.id === createClientId);
        if (found) resolvedName = found.name;
      }
      setItems((prev) => [
        ...prev,
        {
          id: data.id,
          type: data.type,
          number: data.number,
          customName: data.customName || undefined,
          status: data.status,
          scheduledDate: data.scheduledDate,
          scheduledDay: data.scheduledDay,
          monthLabel: data.monthLabel,
          clientId: data.clientId,
          clientName: resolvedName,
          caption: data.caption || undefined,
          mediaIds: data.mediaIds || undefined,
          mediaUrls: data.mediaUrls || undefined,
          platforms: data.platforms || undefined,
          scheduledPostTime: data.scheduledPostTime || undefined,
        },
      ]);
      setShowCreateModal(false);
    } catch {
      setCreateError('Network error');
    } finally {
      setCreating(false);
    }
  }

  async function handlePublish(immediate: boolean) {
    if (!selected) return;
    setPublishing(true);
    setPublishError('');
    try {
      // Save any pending changes first
      await handleSave();

      const res = await fetch('/api/post-bridge/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentItemId: selected.id, immediate }),
      });

      if (!res.ok) {
        const data = await res.json();
        setPublishError(data.error || 'Failed to publish');
        return;
      }

      const data = await res.json();
      const newStatus = data.publishStatus as PublishStatus;

      setSelected((prev) => prev ? { ...prev, publishStatus: newStatus, postBridgePostId: data.postBridgePostId } : null);
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

      const data = await res.json();
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

  // Filtered items indexed by date
  const itemsByDate = useMemo(() => {
    const filtered = items.filter(
      (item) => activeTypes.has(item.type) && activeStatuses.has(item.status)
    );
    const map = new Map<string, CalendarItem[]>();
    for (const item of filtered) {
      const existing = map.get(item.scheduledDate);
      if (existing) existing.push(item);
      else map.set(item.scheduledDate, [item]);
    }
    return map;
  }, [items, activeTypes, activeStatuses]);

  const today = new Date();
  const todayStr = formatDateStr(today);

  // Month view data
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

  // Week view data
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

  function togglePlatform(p: Platform, isEdit: boolean) {
    if (isEdit) {
      setEditPlatforms((prev) => {
        const next = new Set(prev);
        if (next.has(p)) next.delete(p);
        else next.add(p);
        return next;
      });
    } else {
      setCreatePlatforms((prev) => {
        const next = new Set(prev);
        if (next.has(p)) next.delete(p);
        else next.add(p);
        return next;
      });
    }
  }

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none';
  const labelClass = 'block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5';

  function getItemLabel(item: CalendarItem): string {
    if (item.customName) return item.customName;
    return `${item.type}${item.number ? ` ${item.number}` : ''}`;
  }

  function renderPublishIndicator(item: CalendarItem) {
    const status = item.publishStatus;
    if (!status || status === 'draft') return null;

    if (status === 'scheduled') {
      return (
        <span className="inline-block w-2.5 h-2.5 flex-shrink-0" title="Scheduled">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-full h-full">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </span>
      );
    }
    if (status === 'published') {
      return <span className="w-2 h-2 rounded-full bg-green-300 flex-shrink-0" title="Published" />;
    }
    if (status === 'failed' || status === 'partially_failed') {
      return <span className="w-2 h-2 rounded-full bg-red-300 flex-shrink-0" title={status === 'failed' ? 'Failed' : 'Partial Failure'} />;
    }
    if (status === 'publishing') {
      return <span className="w-2 h-2 rounded-full bg-blue-300 animate-pulse flex-shrink-0" title="Publishing" />;
    }
    return null;
  }

  function renderItemChip(item: CalendarItem) {
    return (
      <button
        key={item.id}
        onClick={() => openModal(item)}
        className={`w-full text-left text-[10px] font-medium text-white px-1.5 py-0.5 rounded truncate ring-2 cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1 ${CONTENT_COLORS[item.type]} ${STATUS_RING[item.status]}`}
      >
        {renderPublishIndicator(item)}
        <span className="truncate">{getItemLabel(item)} · {item.clientName}</span>
      </button>
    );
  }

  function renderMediaUpload(isEdit: boolean) {
    const previews = isEdit ? editMediaPreviews : createMediaPreviews;
    const progress = isEdit ? editUploadProgress : uploadProgress;

    return (
      <div>
        <label className={labelClass}>Media</label>
        {previews.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {previews.map((url, i) => (
              <div key={i} className="relative w-16 h-16">
                <img src={url} alt="" className="w-full h-full object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => removeMedia(i, isEdit)}
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
          onChange={(e) => handleFileSelect(e.target.files, isEdit)}
          className="block w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
        />
        {progress !== null && (
          <div className="mt-1 text-xs text-indigo-600">Uploading media...</div>
        )}
      </div>
    );
  }

  function renderPlatformToggles(isEdit: boolean) {
    const platforms = isEdit ? editPlatforms : createPlatforms;
    const hasIG = socialAccounts.some((a) => a.platform === 'instagram');
    const hasFB = socialAccounts.some((a) => a.platform === 'facebook');

    return (
      <div>
        <label className={labelClass}>Platforms</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => togglePlatform('instagram', isEdit)}
            disabled={!hasIG}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
              platforms.has('instagram')
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
            onClick={() => togglePlatform('facebook', isEdit)}
            disabled={!hasFB}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
              platforms.has('facebook')
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
    );
  }

  const canPublishEdit = selected && editCaption && editPlatforms.size > 0;
  const canScheduleEdit = canPublishEdit && editDate && editPostTime;

  return (
    <>
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
            {canCreate && (
              <button
                onClick={() => openCreateModal()}
                className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                + Create Task
              </button>
            )}
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
                    className={`min-h-[100px] border-b border-r border-gray-100 p-1.5 ${cell.day === null ? 'bg-gray-50' : 'group'}`}
                  >
                    {cell.day !== null && (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>
                            {cell.day}
                          </div>
                          {canCreate && (
                            <button
                              onClick={() => openCreateModal(cell.dateStr)}
                              className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-all text-xs"
                            >
                              +
                            </button>
                          )}
                        </div>
                        <div className="space-y-1">
                          {dayItems.map((item) => renderItemChip(item))}
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
                  <div key={wd.dateStr} className="min-h-[300px] border-r border-gray-100 p-2 group">
                    {canCreate && (
                      <button
                        onClick={() => openCreateModal(wd.dateStr)}
                        className="w-full mb-1.5 py-1 text-xs text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                      >
                        + Add
                      </button>
                    )}
                    <div className="space-y-1.5">
                      {dayItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => openModal(item)}
                          className={`w-full text-left px-2 py-1.5 rounded-lg ring-2 cursor-pointer hover:opacity-80 transition-opacity ${CONTENT_COLORS[item.type]} ${STATUS_RING[item.status]}`}
                        >
                          <div className="flex items-center gap-1">
                            {renderPublishIndicator(item)}
                            <div className="text-[11px] font-semibold text-white truncate">{getItemLabel(item)}</div>
                          </div>
                          <div className="text-[10px] text-white/80 truncate">{item.clientName}</div>
                        </button>
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
            className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Edit Content Item</h3>
                {selected.publishStatus && selected.publishStatus !== 'draft' && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${PUBLISH_STATUS_BADGE[selected.publishStatus].bg} ${PUBLISH_STATUS_BADGE[selected.publishStatus].text}`}>
                    {PUBLISH_STATUS_BADGE[selected.publishStatus].label}
                  </span>
                )}
              </div>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              <div>
                <label className={labelClass}>Client</label>
                <p className="text-sm font-semibold text-gray-900">{selected.clientName}</p>
              </div>

              <div>
                <label className={labelClass}>Task Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={inputClass}
                  placeholder="Leave empty for default (e.g. POST 1)"
                />
              </div>

              <div>
                <label className={labelClass}>Caption / Description</label>
                <textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  className={inputClass}
                  rows={4}
                  placeholder="Write your post caption here..."
                />
              </div>

              {renderMediaUpload(true)}
              {renderPlatformToggles(true)}

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

              <div className="grid grid-cols-2 gap-3">
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
                  <label className={labelClass}>Post Time</label>
                  <input
                    type="time"
                    value={editPostTime}
                    onChange={(e) => setEditPostTime(e.target.value)}
                    className={inputClass}
                  />
                </div>
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

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <div className="flex gap-2">
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

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowCreateModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Create Task</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              {clients && clients.length > 0 && !clientId && (
                <div>
                  <label className={labelClass}>Client</label>
                  <select
                    value={createClientId}
                    onChange={(e) => setCreateClientId(e.target.value)}
                    className={inputClass}
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className={labelClass}>Task Name</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Meeting with client (optional)"
                />
              </div>

              <div>
                <label className={labelClass}>Caption / Description</label>
                <textarea
                  value={createCaption}
                  onChange={(e) => setCreateCaption(e.target.value)}
                  className={inputClass}
                  rows={4}
                  placeholder="Write your post caption here..."
                />
              </div>

              {renderMediaUpload(false)}
              {renderPlatformToggles(false)}

              <div>
                <label className={labelClass}>Content Type</label>
                <div className="flex gap-2">
                  {TYPE_OPTIONS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCreateType(t)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        createType === t
                          ? `text-white ${CONTENT_COLORS[t]}`
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Scheduled Date</label>
                  <input
                    type="date"
                    value={createDate}
                    onChange={(e) => setCreateDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Post Time</label>
                  <input
                    type="time"
                    value={createPostTime}
                    onChange={(e) => setCreatePostTime(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Status</label>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCreateStatus(s)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        createStatus === s
                          ? STATUS_COLORS[s] + ' ring-2 ring-offset-1 ring-gray-300'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {createError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {createError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
