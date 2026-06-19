import { CheckSquare } from 'lucide-react';

export function DailyQuests() {
  return (
    <div className="p-8 space-y-6 bg-gray-50/50 min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Daily Quests</h2>
          <p className="text-gray-500 text-sm mt-1">Manage daily quests for users</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
        <CheckSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400">Daily quests management coming soon.</p>
      </div>
    </div>
  );
}
