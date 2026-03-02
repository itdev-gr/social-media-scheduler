import { useState } from 'react';

type ContentStatus = 'todo' | 'doing' | 'done';
type ContentType = 'POST' | 'VIDEO' | 'CAROUSEL';

interface ContentItemData {
  id: string;
  type: ContentType;
  status: ContentStatus;
  scheduledDate: string;
  scheduledDay: number;
  clientName: string;
}

interface Props {
  item: ContentItemData;
  onStatusChange?: (id: string, status: ContentStatus) => void;
}

const STATUS_COLORS: Record<ContentStatus, string> = {
  todo: 'bg-gray-100 text-gray-700',
  doing: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
};

const CONTENT_COLORS: Record<ContentType, string> = {
  POST: 'bg-indigo-100 text-indigo-700',
  VIDEO: 'bg-purple-100 text-purple-700',
  CAROUSEL: 'bg-orange-100 text-orange-700',
};

const STATUS_OPTIONS: ContentStatus[] = ['todo', 'doing', 'done'];

export default function PipelineItem({ item, onStatusChange }: Props) {
  const [status, setStatus] = useState<ContentStatus>(item.status);
  const [updating, setUpdating] = useState(false);

  async function handleStatusChange(newStatus: ContentStatus) {
    const prev = status;
    setStatus(newStatus);
    setUpdating(true);

    try {
      const res = await fetch(`/api/tasks/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setStatus(prev);
      } else {
        onStatusChange?.(item.id, newStatus);
      }
    } catch {
      setStatus(prev);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-4">
      {/* Date */}
      <div className="text-xs text-gray-500 w-20 flex-shrink-0">
        {formatDate(item.scheduledDate)}
      </div>

      {/* Client */}
      <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded flex-shrink-0">
        {item.clientName}
      </span>

      {/* Content type badge */}
      <span
        className={`text-xs font-bold px-2.5 py-1 rounded flex-shrink-0 ${CONTENT_COLORS[item.type]}`}
      >
        {item.type}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Status dropdown */}
      <select
        value={status}
        onChange={(e) => handleStatusChange(e.target.value as ContentStatus)}
        disabled={updating}
        className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer ${STATUS_COLORS[status]} ${
          updating ? 'opacity-50' : ''
        }`}
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
