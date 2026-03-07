import { useState, type FormEvent } from 'react';

interface GenerateResponse {
  clientId: string;
  planId: string;
  monthsCreated: number;
  contentItemsCreated: number;
}

interface Package {
  name: string;
  posts: number;
  scenarios: number;
  stories: number;
  carousels: number;
}

const packages: Package[] = [
  { name: 'Edit Only', posts: 4, scenarios: 4, stories: 0, carousels: 0 },
  { name: 'Starter', posts: 2, scenarios: 4, stories: 0, carousels: 0 },
  { name: 'Growth', posts: 4, scenarios: 8, stories: 4, carousels: 0 },
  { name: 'Performance', posts: 8, scenarios: 12, stories: 8, carousels: 0 },
  { name: 'Custom', posts: 0, scenarios: 0, stories: 0, carousels: 0 },
];

export default function ClientForm() {
  const [selectedPackage, setSelectedPackage] = useState('');
  const [clientName, setClientName] = useState('');
  const [clickupId, setClickupId] = useState('');
  const [startMonth, setStartMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthsCount, setMonthsCount] = useState(3);
  const [postsPerMonth, setPostsPerMonth] = useState(0);
  const [scenariosPerMonth, setScenariosPerMonth] = useState(0);
  const [carouselsPerMonth, setCarouselsPerMonth] = useState(0);
  const [storiesPerMonth, setStoriesPerMonth] = useState(0);
  const [notes, setNotes] = useState('');

  function handlePackageChange(packageName: string) {
    setSelectedPackage(packageName);
    const pkg = packages.find((p) => p.name === packageName);
    if (pkg) {
      setPostsPerMonth(pkg.posts);
      setScenariosPerMonth(pkg.scenarios);
      setStoriesPerMonth(pkg.stories);
      setCarouselsPerMonth(pkg.carousels);
    }
  }

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<GenerateResponse | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          clickupId,
          startMonth,
          monthsCount,
          postsPerMonth,
          scenariosPerMonth,
          carouselsPerMonth,
          storiesPerMonth,
          notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate schedule');
      }

      const data: GenerateResponse = await res.json();
      setSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
      <div>
        <label className={labelClass}>Client Name</label>
        <input
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          className={inputClass}
          placeholder="e.g. Acme Corp"
          required
        />
      </div>

      <div>
        <label className={labelClass}>ClickUp ID</label>
        <input
          type="text"
          value={clickupId}
          onChange={(e) => setClickupId(e.target.value)}
          className={inputClass}
          placeholder="e.g. abc123xyz"
        />
      </div>

      <div>
        <label className={labelClass}>Package</label>
        <select
          value={selectedPackage}
          onChange={(e) => handlePackageChange(e.target.value)}
          className={inputClass}
        >
          <option value="">Select a package...</option>
          {packages.map((pkg) => (
            <option key={pkg.name} value={pkg.name}>
              {pkg.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Start Month</label>
          <input
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Months Count</label>
          <input
            type="number"
            value={monthsCount}
            onChange={(e) => setMonthsCount(Number(e.target.value))}
            className={inputClass}
            min={1}
            max={24}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Posts / month</label>
          <input
            type="number"
            value={postsPerMonth}
            onChange={(e) => setPostsPerMonth(Number(e.target.value))}
            className={inputClass}
            min={0}
          />
        </div>
        <div>
          <label className={labelClass}>Scenarios & Videos / month</label>
          <input
            type="number"
            value={scenariosPerMonth}
            onChange={(e) => setScenariosPerMonth(Number(e.target.value))}
            className={inputClass}
            min={0}
          />
        </div>
        <div>
          <label className={labelClass}>Carousels / month</label>
          <input
            type="number"
            value={carouselsPerMonth}
            onChange={(e) => setCarouselsPerMonth(Number(e.target.value))}
            className={inputClass}
            min={0}
          />
        </div>
        <div>
          <label className={labelClass}>Stories / month</label>
          <input
            type="number"
            value={storiesPerMonth}
            onChange={(e) => setStoriesPerMonth(Number(e.target.value))}
            className={inputClass}
            min={0}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this client..."
          rows={3}
          className={inputClass + ' resize-y'}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 text-white rounded-lg py-2.5 px-4 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Generating...' : 'Generate Schedule'}
      </button>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-700 space-y-1">
          <p className="font-medium">Schedule generated!</p>
          <p>{success.monthsCreated} months, {success.contentItemsCreated} content items</p>
          <a
            href={`/clients/${success.clientId}`}
            className="inline-block mt-2 text-indigo-600 hover:text-indigo-800 font-medium"
          >
            View Schedule &rarr;
          </a>
        </div>
      )}
    </form>
  );
}
