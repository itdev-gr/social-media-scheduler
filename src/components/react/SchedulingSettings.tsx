import { useState, useEffect } from 'react';
import type { SchedulingSettings } from '../../lib/types';

export default function SchedulingSettingsForm() {
  const [settings, setSettings] = useState<SchedulingSettings>({
    postDelayDays: 0,
    videoDelayDays: 0,
    carouselDelayDays: 0,
    storyDelayDays: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data: SchedulingSettings) => setSettings(data))
      .catch(() => setMessage({ type: 'error', text: 'Failed to load settings' }))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      const data: SchedulingSettings = await res.json();
      setSettings(data);
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Something went wrong' });
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  if (loading) {
    return <p className="text-sm text-gray-500">Loading settings...</p>;
  }

  const fields: { key: keyof SchedulingSettings; label: string }[] = [
    { key: 'postDelayDays', label: 'Post start delay (days)' },
    { key: 'videoDelayDays', label: 'Video start delay (days)' },
    { key: 'carouselDelayDays', label: 'Carousel start delay (days)' },
    { key: 'storyDelayDays', label: 'Story start delay (days)' },
  ];

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Scheduling Delays</h2>
        <p className="text-sm text-gray-500 mt-1">
          Set how many days after project creation each content type should start being scheduled.
          A value of 0 means scheduling starts on the same day.
        </p>
      </div>

      <div className="space-y-4">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className={labelClass}>{label}</label>
            <input
              type="number"
              value={settings[key]}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, [key]: Math.max(0, Number(e.target.value)) }))
              }
              className={inputClass}
              min={0}
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-indigo-600 text-white rounded-lg py-2.5 px-6 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>

      {message && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
