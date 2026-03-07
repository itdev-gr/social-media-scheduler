import { useState, useEffect } from 'react';
import type { SchedulingSettings, PackageDelays, PackageName } from '../../lib/types';
import { PACKAGE_NAMES } from '../../lib/types';

const DEFAULT_DELAYS: PackageDelays = {
  postDelayDays: 0,
  videoDelayDays: 0,
  carouselDelayDays: 0,
  storyDelayDays: 0,
};

function buildDefaults(): SchedulingSettings {
  const settings = {} as SchedulingSettings;
  for (const name of PACKAGE_NAMES) {
    settings[name] = { ...DEFAULT_DELAYS };
  }
  return settings;
}

const delayFields: { key: keyof PackageDelays; label: string }[] = [
  { key: 'postDelayDays', label: 'Post delay (days)' },
  { key: 'videoDelayDays', label: 'Video delay (days)' },
  { key: 'carouselDelayDays', label: 'Carousel delay (days)' },
  { key: 'storyDelayDays', label: 'Story delay (days)' },
];

export default function SchedulingSettingsForm() {
  const [settings, setSettings] = useState<SchedulingSettings>(buildDefaults);
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

  function updateField(pkg: PackageName, key: keyof PackageDelays, value: number) {
    setSettings((prev) => ({
      ...prev,
      [pkg]: { ...prev[pkg], [key]: Math.max(0, value) },
    }));
  }

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

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Scheduling Delays per Package</h2>
        <p className="text-sm text-gray-500 mt-1">
          Set how many days after client start date each content type should begin scheduling, per package.
          A value of 0 means scheduling starts on the start date.
        </p>
      </div>

      {PACKAGE_NAMES.map((pkg) => (
        <div key={pkg} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">{pkg}</h3>
          <div className="grid grid-cols-2 gap-4">
            {delayFields.map(({ key, label }) => (
              <div key={key}>
                <label className={labelClass}>{label}</label>
                <input
                  type="number"
                  value={settings[pkg][key]}
                  onChange={(e) => updateField(pkg, key, Number(e.target.value))}
                  className={inputClass}
                  min={0}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

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
