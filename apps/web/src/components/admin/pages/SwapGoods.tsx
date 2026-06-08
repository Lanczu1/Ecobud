import { useState } from 'react';
import { ArrowLeftRight, Edit3, Trash2, Tag, Package, Search, CheckCircle, Clock, XCircle, Database } from 'lucide-react';


const swapItems = [
  { id: 1, title: 'Reusable Water Bottle', category: 'Kitchen', condition: 'Like New', wantedFor: 'Eco tote bag', postedBy: 'Sarah Chen', date: '2024-05-30', status: 'Available', image: '🍶' },
  { id: 2, title: 'Bamboo Cutlery Set', category: 'Kitchen', condition: 'New', wantedFor: 'Beeswax wraps', postedBy: 'Mike Johnson', date: '2024-05-28', status: 'Swapped', image: '🥢' },
  { id: 3, title: 'Solar Garden Lights', category: 'Garden', condition: 'Good', wantedFor: 'Compost bin', postedBy: 'Emma Wilson', date: '2024-06-01', status: 'Available', image: '🔆' },
  { id: 4, title: 'Organic Cotton Tote Bag', category: 'Accessories', condition: 'Like New', wantedFor: 'Anything eco', postedBy: 'Alex Thompson', date: '2024-05-25', status: 'Pending', image: '👜' },
  { id: 5, title: 'Herb Garden Starter Kit', category: 'Garden', condition: 'New', wantedFor: 'Seeds or cuttings', postedBy: 'Priya Sharma', date: '2024-06-02', status: 'Available', image: '🌿' },
  { id: 6, title: 'Stainless Steel Straws', category: 'Kitchen', condition: 'Good', wantedFor: 'Cloth napkins', postedBy: 'James Park', date: '2024-05-22', status: 'Available', image: '🥤' },
];

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  Available: { color: 'bg-green-50 text-green-700 border-green-100', icon: <CheckCircle className="w-3 h-3" /> },
  Pending: { color: 'bg-yellow-50 text-yellow-700 border-yellow-100', icon: <Clock className="w-3 h-3" /> },
  Swapped: { color: 'bg-gray-100 text-gray-500 border-gray-200', icon: <ArrowLeftRight className="w-3 h-3" /> },
  Flagged: { color: 'bg-red-50 text-red-600 border-red-100', icon: <XCircle className="w-3 h-3" /> },
};

const conditionColors: Record<string, string> = {
  New: 'text-green-600',
  'Like New': 'text-blue-600',
  Good: 'text-gray-600',
  Fair: 'text-orange-500',
};

export function SwapGoods() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  const filtered = swapItems.filter(s =>
    (filterStatus === 'All' || s.status === filterStatus) &&
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6 bg-gray-50/50 min-h-full">
      {/* Coming Soon Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <Database className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Database schema not yet available</p>
          <p className="text-xs text-amber-700 mt-0.5">The Swap Goods model has not been added to the database yet. Data shown below is for preview purposes only. Full CRUD will be enabled once the schema migration is complete.</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Swap Goods</h2>
          <p className="text-gray-500 text-sm mt-1">Monitor and moderate community eco-swap listings</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Listings', value: swapItems.length, color: 'text-gray-900' },
          { label: 'Available', value: swapItems.filter(s => s.status === 'Available').length, color: 'text-green-600' },
          { label: 'Pending Review', value: swapItems.filter(s => s.status === 'Pending').length, color: 'text-yellow-600' },
          { label: 'Completed Swaps', value: swapItems.filter(s => s.status === 'Swapped').length, color: 'text-blue-600' },
        ].map((s, idx) => {
          const delayClass = idx === 0 ? '' : idx === 1 ? 'delay-60' : idx === 2 ? 'delay-160' : 'delay-280';
          return (
            <div key={s.label} className={`bg-white rounded-2xl border border-gray-100 p-5 shadow-sm animate-reveal ${delayClass} hover:-translate-y-1 hover:shadow-md transition-all duration-300`}>
              <p className="text-sm text-gray-500 font-medium">{s.label}</p>
              <p className={`text-3xl font-serif font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3 items-center animate-reveal delay-160">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search swap listings..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all"
          />
        </div>
        {['All', 'Available', 'Pending', 'Swapped'].map(f => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={`px-4 py-2 text-sm rounded-xl border font-medium transition-all ${filterStatus === f ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-reveal delay-280">
        {filtered.map(item => (
          <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
            <div className="bg-gradient-to-br from-emerald-50 to-green-100 p-8 flex items-center justify-center text-5xl">
              {item.image}
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <span className={`flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${statusConfig[item.status]?.color}`}>
                  {statusConfig[item.status]?.icon}
                  {item.status}
                </span>
                <span className="text-xs text-gray-400">{item.date}</span>
              </div>

              <h3 className="font-serif font-bold text-gray-900 mb-1">{item.title}</h3>

              <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Tag className="w-3 h-3" />{item.category}
                </span>
                <span className="text-gray-200">•</span>
                <span className={`text-xs font-semibold ${conditionColors[item.condition]}`}>
                  {item.condition}
                </span>
              </div>

              <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                <Package className="w-3 h-3 text-gray-300" />
                <span className="text-gray-400">Wants:</span>
                <span className="font-medium text-gray-700">{item.wantedFor}</span>
              </div>
              <p className="text-xs text-gray-400 mb-4">Posted by {item.postedBy}</p>

              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 text-xs font-semibold rounded-xl hover:bg-green-100 transition-colors">
                  <Edit3 className="w-3 h-3" />Edit
                </button>
                <button className="flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-100 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <ArrowLeftRight className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No swap listings found</p>
        </div>
      )}
    </div>
  );
}
