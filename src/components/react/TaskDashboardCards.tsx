interface StatCard {
  label: string;
  value: number;
  color: string;
}

interface Props {
  totalTasks: number;
  todoTasks: number;
  doingTasks: number;
  doneTasks: number;
}

export default function TaskDashboardCards({
  totalTasks,
  todoTasks,
  doingTasks,
  doneTasks,
}: Props) {
  const cards: StatCard[] = [
    { label: 'Total Tasks', value: totalTasks, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { label: 'To Do', value: todoTasks, color: 'bg-gray-50 text-gray-700 border-gray-200' },
    { label: 'In Progress', value: doingTasks, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'Done', value: doneTasks, color: 'bg-green-50 text-green-700 border-green-200' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border p-6 ${card.color}`}
        >
          <p className="text-sm font-medium opacity-75">{card.label}</p>
          <p className="text-3xl font-bold mt-1">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
