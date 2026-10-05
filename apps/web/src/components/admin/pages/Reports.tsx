import { useState, useRef, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Trophy, 
  BookOpen, 
  Coins, 
  ArrowUpRight, 
  Download, 
  AlertCircle, 
  Loader2, 
  FileText, 
  FileSpreadsheet, 
  ChevronDown 
} from 'lucide-react';
import { useAdminStats } from '../useAdminStats';
import { API_HOST } from '../../../utils/adminApi';
import { useToast } from '../../../context/ToastContext';

function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} style={style} />;
}

export function Reports() {
  const { stats, loading, error } = useAdminStats('Failed to load report data.');
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setExportMenuOpen(false);
      }
    }
    if (exportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [exportMenuOpen]);

  const handleDownload = async (format: 'pdf' | 'excel') => {
    if (exporting || loading) return;
    setExporting(format);
    setExportError(null);
    try {
      const token = localStorage.getItem('ecobud_admin_token') || '';
      const response = await fetch(`${API_HOST}/api/reports/analytics/${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `Failed to export ${format.toUpperCase()} report.`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^";]+)"?/);
      const today = new Date().toISOString().slice(0, 10);
      const filename = match ? match[1] : `ECOBUD-Platform-Analytics-${today}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast.success(`${format === 'pdf' ? 'PDF report' : 'Excel spreadsheet'} downloaded successfully!`);
      setExportMenuOpen(false);
    } catch (err: any) {
      const msg = err.message || `Failed to export ${format.toUpperCase()} report.`;
      setExportError(msg);
      toast.error(msg);
    } finally {
      setExporting(null);
    }
  };

  const kpis = stats ? [
    { label: 'Total Users', value: stats.overview.totalUsers.toLocaleString(), change: `+${stats.overview.signupsToday} today`, up: true, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Lessons', value: stats.overview.totalLessons.toLocaleString(), change: `${stats.overview.lessonCompletions} completions`, up: true, icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Active Challenges', value: stats.overview.totalChallenges.toLocaleString(), change: 'in database', up: true, icon: Trophy, color: 'text-purple-500', bg: 'bg-purple-50' },
    { label: 'Eco Coins Redeemed', value: stats.overview.totalCoinsRedeemed?.toLocaleString() ?? '—', change: 'claimed rewards · all time', up: true, icon: Coins, color: 'text-orange-500', bg: 'bg-orange-50' },
  ] : [];

  const maxActive = stats ? Math.max(...stats.activityTrend.map(d => d.active), 1) : 1;
  const maxSignups = stats ? Math.max(...stats.activityTrend.map(d => d.signups), 1) : 1;

  return (
    <div className="p-8 space-y-6 bg-gray-50/50 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Reports & Analytics</h2>
          <p className="text-gray-500 text-sm mt-1">Platform-wide performance metrics and insights</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Real-time Live Data
          </div>

          {/* Export Report Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              id="export-report-button"
              disabled={loading || !!exporting}
              onClick={() => setExportMenuOpen(prev => !prev)}
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 hover:shadow-lg active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm cursor-pointer"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Exporting {exporting.toUpperCase()}...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Export Report</span>
                  <ChevronDown className={`w-3.5 h-3.5 opacity-80 transition-transform duration-200 ${exportMenuOpen ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>

            {exportMenuOpen && (
              <div 
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="export-report-button"
                className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-50 animate-reveal"
              >
                <div className="px-3 py-2 border-b border-gray-100 mb-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Export Report Format</p>
                  <p className="text-xs text-gray-500 mt-0.5">Platform performance &amp; analytics snapshot</p>
                </div>

                <div className="space-y-1">
                  {/* PDF Option */}
                  <button
                    type="button"
                    role="menuitem"
                    id="export-pdf-option"
                    disabled={!!exporting}
                    onClick={() => void handleDownload('pdf')}
                    className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-red-50/70 text-left transition-colors group cursor-pointer disabled:opacity-50"
                  >
                    <div className="w-9 h-9 rounded-lg bg-red-100/70 text-red-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      {exporting === 'pdf' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900 group-hover:text-red-700">PDF Document</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">.pdf</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        Formatted executive report with KPI cards, 7-day trend table &amp; narrative summary
                      </p>
                    </div>
                  </button>

                  {/* Excel Option */}
                  <button
                    type="button"
                    role="menuitem"
                    id="export-excel-option"
                    disabled={!!exporting}
                    onClick={() => void handleDownload('excel')}
                    className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-emerald-50/70 text-left transition-colors group cursor-pointer disabled:opacity-50"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-100/70 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      {exporting === 'excel' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900 group-hover:text-emerald-700">Excel Spreadsheet</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">.xlsx</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        Multi-sheet workbook with KPI metrics, 7-day activity data &amp; system metadata
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {exportError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700 font-medium">{exportError}</p>
          </div>
          <button 
            type="button"
            onClick={() => setExportError(null)} 
            className="text-xs font-semibold text-red-700 hover:text-red-900 px-2.5 py-1 rounded-lg hover:bg-red-100 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                <div className="flex justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                  <Skeleton className="w-11 h-11 rounded-xl" />
                </div>
                <Skeleton className="h-4 w-32" />
              </div>
            ))
          : kpis.map((k, idx) => {
              const delayClass = idx === 0 ? '' : idx === 1 ? 'delay-60' : idx === 2 ? 'delay-160' : 'delay-280';
              return (
                <div key={k.label} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group animate-reveal ${delayClass}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-gray-500 text-xs font-medium mb-1">{k.label}</p>
                      <h3 className="text-3xl font-serif font-bold text-gray-900">{k.value}</h3>
                    </div>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${k.bg} group-hover:scale-110 transition-transform duration-300`}>
                      <k.icon className={`w-5 h-5 ${k.color}`} />
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-semibold text-green-500">
                    <TrendingUp className="w-4 h-4" />
                    {k.change}
                  </span>
                </div>
              );
            })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-reveal delay-160">
        {/* Active Users Chart (7-day trend) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-serif font-bold text-gray-900">Daily Active Users</h3>
              <p className="text-xs text-gray-400 mt-0.5">Last 7 days</p>
            </div>
            <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />Live data
            </span>
          </div>
          {loading ? (
            <div className="flex items-end gap-3 h-40 pt-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${30 + Math.random() * 70}%` }} />
              ))}
            </div>
          ) : stats ? (
            <div className="flex items-end gap-2 h-40">
              {stats.activityTrend.map(d => {
                const h = Math.round((d.active / maxActive) * 100);
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 group/bar">
                    <span className="text-xs font-bold text-gray-600 opacity-0 group-hover/bar:opacity-100 transition-opacity">{d.active}</span>
                    <div className="w-full relative flex items-end" style={{ height: '120px' }}>
                      <div
                        className="w-full rounded-t-lg bg-linear-to-t from-green-500 to-emerald-300 hover:from-green-600 hover:to-emerald-400 transition-all duration-300 cursor-pointer"
                        style={{ height: `${Math.max(h, 4)}%` }}
                        title={`${d.dateLabel}: ${d.active} active`}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{d.day}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* New Signups Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-serif font-bold text-gray-900">New Signups</h3>
              <p className="text-xs text-gray-400 mt-0.5">Last 7 days</p>
            </div>
            <span className="flex items-center gap-1 text-xs text-blue-600 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />Live data
            </span>
          </div>
          {loading ? (
            <div className="flex items-end gap-3 h-40 pt-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${20 + Math.random() * 80}%` }} />
              ))}
            </div>
          ) : stats ? (
            <div className="flex items-end gap-2 h-40">
              {stats.activityTrend.map(d => {
                const h = Math.round((d.signups / maxSignups) * 100);
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 group/bar">
                    <span className="text-xs font-bold text-gray-600 opacity-0 group-hover/bar:opacity-100 transition-opacity">{d.signups}</span>
                    <div className="w-full relative flex items-end" style={{ height: '120px' }}>
                      <div
                        className="w-full rounded-t-lg bg-linear-to-t from-blue-500 to-sky-300 hover:from-blue-600 hover:to-sky-400 transition-all duration-300 cursor-pointer"
                        style={{ height: `${Math.max(h, 4)}%` }}
                        title={`${d.dateLabel}: ${d.signups} signups`}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{d.day}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* 7-Day Summary Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-reveal delay-280">
        <div className="p-6 border-b border-gray-50">
          <h3 className="text-lg font-serif font-bold text-gray-900">7-Day Activity Summary</h3>
          <p className="text-xs text-gray-400 mt-0.5">Real-time data from your database</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/70">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Date</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Active Users</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">New Signups</th>
              </tr>
            </thead>
            <tbody className="">
              {loading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-3.5"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-12" /></td>
                  </tr>
                ))
              ) : stats ? (
                [...stats.activityTrend].reverse().map(d => (
                  <tr key={d.date} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3.5 text-sm font-semibold text-gray-900">{d.dateLabel}</td>
                    <td className="px-4 py-3.5 text-sm text-green-600 font-bold">{d.active}</td>
                    <td className="px-4 py-3.5 text-sm text-blue-600 font-bold">+{d.signups}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading data...</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Platform Overview */}
      {!loading && stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-reveal delay-160">
          {[
            { label: 'Online Now', value: stats.overview.onlineNow, desc: 'users currently active', color: 'text-green-600', dot: 'bg-green-500' },
            { label: 'Active Today', value: stats.overview.activeToday, desc: 'users seen today', color: 'text-blue-600', dot: 'bg-blue-500' },
            { label: 'Lesson Completions', value: stats.overview.lessonCompletions, desc: 'total across all users', color: 'text-purple-600', dot: 'bg-purple-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${s.dot} animate-pulse`} />
                <p className="text-sm font-semibold text-gray-700">{s.label}</p>
              </div>
              <p className={`text-3xl font-serif font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
