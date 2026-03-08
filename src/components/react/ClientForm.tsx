import { useState, useEffect, type FormEvent } from 'react';

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

interface SocialAccount {
  id: number;
  platform: 'instagram' | 'facebook';
  name: string;
  username?: string;
}

export default function ClientForm() {
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [selectedPackage, setSelectedPackage] = useState('');
  const [clientName, setClientName] = useState('');
  const [clickupId, setClickupId] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [monthsCount, setMonthsCount] = useState(3);
  const [postsPerMonth, setPostsPerMonth] = useState(0);
  const [scenariosPerMonth, setScenariosPerMonth] = useState(0);
  const [carouselsPerMonth, setCarouselsPerMonth] = useState(0);
  const [storiesPerMonth, setStoriesPerMonth] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetch('/api/post-bridge/social-accounts')
      .then((res) => res.json())
      .then((data) => {
        if (data.accounts) setSocialAccounts(data.accounts);
      })
      .catch((err) => console.error('Failed to fetch social accounts:', err));
  }, []);

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
          packageName: selectedPackage || undefined,
          startDate,
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
        {socialAccounts.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-indigo-600 cursor-pointer hover:text-indigo-700 select-none">
              {socialAccounts.length} connected account{socialAccounts.length !== 1 ? 's' : ''}
            </summary>
            <div className="mt-1.5 border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
              {socialAccounts.filter((a) => a.platform === 'instagram').length > 0 && (
                <div>
                  <div className="px-3 py-1.5 bg-gradient-to-r from-purple-50 to-pink-50">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600">Instagram</span>
                  </div>
                  {socialAccounts.filter((a) => a.platform === 'instagram').map((acc) => (
                    <div key={acc.id} className="px-3 py-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex-shrink-0" />
                      <span className="text-xs text-gray-800 font-medium">{acc.name}</span>
                      {acc.username && <span className="text-[10px] text-gray-400">@{acc.username}</span>}
                    </div>
                  ))}
                </div>
              )}
              {socialAccounts.filter((a) => a.platform === 'facebook').length > 0 && (
                <div>
                  <div className="px-3 py-1.5 bg-blue-50">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">Facebook</span>
                  </div>
                  {socialAccounts.filter((a) => a.platform === 'facebook').map((acc) => (
                    <div key={acc.id} className="px-3 py-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      <span className="text-xs text-gray-800 font-medium">{acc.name}</span>
                      {acc.username && <span className="text-[10px] text-gray-400">@{acc.username}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        )}
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
          <label className={labelClass}>Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
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
