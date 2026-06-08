import { useState } from 'react';
import { Store, Edit3, Trash2, MapPin, Star, CheckCircle, Clock, Search, XCircle, Database } from 'lucide-react';

const vendors = [
  { id: 1, name: 'Green Beans Cafe', category: 'Food & Beverage', location: 'CBD, Sydney', status: 'Approved', rating: 4.8, products: 12, joined: '2024-01-10', logo: '☕' },
  { id: 2, name: 'EcoCycle Bikes', category: 'Transport', location: 'Newtown, Sydney', status: 'Approved', rating: 4.6, products: 8, joined: '2024-02-15', logo: '🚲' },
  { id: 3, name: 'Sprout Organics', category: 'Grocery', location: 'Surry Hills', status: 'Approved', rating: 4.9, products: 34, joined: '2023-11-01', logo: '🥬' },
  { id: 4, name: 'City Transit Plus', category: 'Transport', location: 'City Wide', status: 'Pending', rating: 0, products: 0, joined: '2024-05-22', logo: '🚌' },
  { id: 5, name: 'Nature\'s Basket', category: 'Grocery', location: 'Bondi', status: 'Pending', rating: 0, products: 0, joined: '2024-05-28', logo: '🧺' },
  { id: 6, name: 'Solar Power Co', category: 'Energy', location: 'Online', status: 'Rejected', rating: 0, products: 0, joined: '2024-04-10', logo: '☀️' },
];

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  Approved: { color: 'bg-green-50 text-green-700 border-green-100', icon: <CheckCircle className="w-3 h-3" /> },
  Pending: { color: 'bg-yellow-50 text-yellow-700 border-yellow-100', icon: <Clock className="w-3 h-3" /> },
  Rejected: { color: 'bg-red-50 text-red-600 border-red-100', icon: <XCircle className="w-3 h-3" /> },
};

export function Vendors() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  const filtered = vendors.filter(v =>
    (filterStatus === 'All' || v.status === filterStatus) &&
    v.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6 bg-gray-50/50 min-h-full">
      {/* Coming Soon Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <Database className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Database schema not yet available</p>
          <p className="text-xs text-amber-700 mt-0.5">The Vendor model has not been added to the database yet. Data shown below is for preview purposes only. Full CRUD will be enabled once the schema migration is complete.</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Vendors</h2>
          <p className="text-gray-500 text-sm mt-1">Manage eco-friendly vendor partners and applications</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Vendors', value: vendors.length, color: 'text-gray-900' },
          { label: 'Approved', value: vendors.filter(v => v.status === 'Approved').length, color: 'text-green-600' },
          { label: 'Pending Review', value: vendors.filter(v => v.status === 'Pending').length, color: 'text-yellow-600' },
          { label: 'Total Products', value: vendors.reduce((a, v) => a + v.products, 0), color: 'text-blue-600' },
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
            placeholder="Search vendors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all"
          />
        </div>
        {['All', 'Approved', 'Pending', 'Rejected'].map(f => (
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
        {filtered.map(vendor => (
          <div key={vendor.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 p-5 group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-2xl">
                  {vendor.logo}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-gray-900">{vendor.name}</h3>
                  <p className="text-xs text-gray-400">{vendor.category}</p>
                </div>
              </div>
              <span className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${statusConfig[vendor.status]?.color}`}>
                {statusConfig[vendor.status]?.icon}
                {vendor.status}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <MapPin className="w-3.5 h-3.5 text-gray-300" />{vendor.location}
              </div>
              {vendor.rating > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold text-gray-800">{vendor.rating}</span>
                  <span className="text-gray-400">• {vendor.products} products</span>
                </div>
              )}
              <p className="text-xs text-gray-400">Joined {vendor.joined}</p>
            </div>

            {vendor.status === 'Pending' ? (
              <div className="flex gap-2">
                <button className="flex-1 py-2 bg-green-600 text-white text-xs font-semibold rounded-xl hover:bg-green-700 active:scale-95 transition-all">Approve</button>
                <button className="flex-1 py-2 bg-red-50 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-100 transition-all">Reject</button>
              </div>
            ) : (
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-xs font-semibold rounded-xl hover:bg-blue-100 transition-colors">
                  <Edit3 className="w-3 h-3" />Edit
                </button>
                <button className="flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-100 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Store className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No vendors found</p>
        </div>
      )}
    </div>
  );
}
