interface Props {
  months: string[];
  selected: string;
  onChange: (month: string) => void;
}

export default function MonthSelector({ months, selected, onChange }: Props) {
  if (months.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {months.map((month) => (
        <button
          key={month}
          onClick={() => onChange(month)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selected === month
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          {formatMonth(month)}
        </button>
      ))}
    </div>
  );
}

function formatMonth(label: string): string {
  const [year, month] = label.split('-');
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
