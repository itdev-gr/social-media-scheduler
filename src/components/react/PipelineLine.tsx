import { useState, useEffect } from 'react';
import MonthSelector from './MonthSelector';
import PipelineItem from './PipelineItem';

type ContentStatus = 'todo' | 'doing' | 'done';
type ContentType = 'POST' | 'VIDEO' | 'CAROUSEL' | 'STORY';

interface ContentItemData {
  id: string;
  type: ContentType;
  status: ContentStatus;
  scheduledDate: string;
  scheduledDay: number;
  clientName: string;
  clientId: string;
  monthLabel: string;
}

interface Props {
  months: string[];
  initialItems: ContentItemData[];
  clientId?: string;
}

export default function PipelineLine({ months, initialItems, clientId }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(months[0] || '');
  const [items, setItems] = useState<ContentItemData[]>(initialItems);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedMonth === months[0]) {
      setItems(initialItems);
      return;
    }

    async function fetchItems() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ month: selectedMonth });
        if (clientId) params.set('clientId', clientId);
        const res = await fetch(`/api/pipelines?${params}`);
        if (res.ok) {
          setItems(await res.json());
        }
      } catch {
        // keep existing
      } finally {
        setLoading(false);
      }
    }

    fetchItems();
  }, [selectedMonth, clientId]);

  const activeItems = items.filter((i) => i.status !== 'done' && i.type !== 'SCENARIO');
  const grouped = groupByDate(activeItems);

  function handleStatusChange(id: string, newStatus: ContentStatus) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i)));
  }

  return (
    <div className="space-y-6">
      <MonthSelector
        months={months}
        selected={selectedMonth}
        onChange={setSelectedMonth}
      />

      {loading && (
        <div className="text-sm text-gray-500 py-4">Loading...</div>
      )}

      {!loading && activeItems.length === 0 && (
        <div className="text-sm text-gray-500 py-4">No pending content for this month.</div>
      )}

      {!loading &&
        grouped.map(({ date, items: dateItems }) => (
          <div key={date}>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">
              {formatDateHeader(date)}
            </h3>
            <div className="space-y-2">
              {dateItems.map((item) => (
                <PipelineItem key={item.id} item={item} onStatusChange={handleStatusChange} />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

function groupByDate(items: ContentItemData[]): { date: string; items: ContentItemData[] }[] {
  const map = new Map<string, ContentItemData[]>();
  for (const item of items) {
    const existing = map.get(item.scheduledDate);
    if (existing) {
      existing.push(item);
    } else {
      map.set(item.scheduledDate, [item]);
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items }));
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
