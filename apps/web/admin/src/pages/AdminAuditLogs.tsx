import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  History, 
  Search, 
  Download,
  CheckCircle,
  XCircle,
  Zap,
  Info
} from 'lucide-react';
import { adminService } from '../services/adminService';

export const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await adminService.getAuditLogs();
        setLogs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const getActionStyles = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('APPROVED')) return { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle };
    if (act.includes('REJECTED')) return { bg: 'bg-red-50', text: 'text-red-700', icon: XCircle };
    if (act.includes('AWARDED')) return { bg: 'bg-amber-50', text: 'text-amber-700', icon: Zap };
    return { bg: 'bg-slate-50', text: 'text-slate-700', icon: Info };
  };

  if (loading) return <div className="p-8 text-center animate-pulse text-slate-500 font-bold uppercase tracking-widest">Scanning logs...</div>;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
             <ShieldCheck size={32} className="text-forest" />
             Immutability Audit Logs
          </h1>
          <p className="text-slate-500 font-medium mt-1">Tracing all administrative actions and system events.</p>
        </div>
        <div className="flex items-center gap-3">
           <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:bg-slate-50 shadow-sm transition-all">
              <Download size={14} /> Export CSV
           </button>
           <button className="flex items-center gap-2 px-4 py-2 bg-forest text-white rounded-xl text-xs font-black shadow-lg shadow-forest/20 hover:scale-[1.02] transition-all">
              <History size={14} /> View History
           </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
         <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between gap-4">
            <div className="relative flex-1 max-w-md">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
               <input type="text" placeholder="Search logs by user or action..." className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 ring-forest/20 shadow-sm" />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter:</span>
               <button className="px-3 py-1 bg-forest text-white text-[10px] font-black rounded-lg uppercase tracking-widest">All Events</button>
               <button className="px-3 py-1 bg-white border border-slate-200 text-slate-500 text-[10px] font-black rounded-lg uppercase tracking-widest hover:border-forest/30 transition-all">Security</button>
               <button className="px-3 py-1 bg-white border border-slate-200 text-slate-500 text-[10px] font-black rounded-lg uppercase tracking-widest hover:border-forest/30 transition-all">Moderation</button>
               <button className="px-3 py-1 bg-white border border-slate-200 text-slate-500 text-[10px] font-black rounded-lg uppercase tracking-widest hover:border-forest/30 transition-all">Users</button>
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-slate-50 text-[#64748B] text-[10px] font-black uppercase tracking-[0.2em]">
                     <th className="px-8 py-4">Status & Action</th>
                     <th className="px-4 py-4">Target User</th>
                     <th className="px-4 py-4">Timestamp</th>
                     <th className="px-4 py-4">Internal Details</th>
                     <th className="px-8 py-4 text-right">Integrity</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => {
                     const style = getActionStyles(log.action);
                     return (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                           <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                 <div className={`p-2 rounded-lg ${style.bg} ${style.text}`}>
                                    <style.icon size={16} />
                                 </div>
                                 <span className="text-sm font-black text-slate-800 tracking-tight">{log.action}</span>
                              </div>
                           </td>
                           <td className="px-4 py-5">
                              <div className="flex items-center gap-2">
                                 <div className="w-6 h-6 rounded-full bg-slate-200" />
                                 <span className="text-xs font-bold text-slate-600 truncate max-w-[120px]">{log.user?.name || 'System Auto'}</span>
                              </div>
                           </td>
                           <td className="px-4 py-5">
                              <div className="flex flex-col">
                                 <span className="text-xs font-black text-slate-800">{new Date(log.timestamp).toLocaleDateString()}</span>
                                 <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                 </span>
                              </div>
                           </td>
                           <td className="px-4 py-5">
                              <code className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-mono font-bold max-w-[200px] truncate block">
                                 {log.details}
                              </code>
                           </td>
                           <td className="px-8 py-5 text-right">
                              <span className="text-[9px] font-black px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md uppercase tracking-widest border border-emerald-100">SECURE_HASH</span>
                           </td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
            {logs.length === 0 && (
               <div className="p-20 text-center flex flex-col items-center">
                  <ShieldCheck size={48} className="text-slate-200 mb-4" />
                  <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No audit logs detected</p>
               </div>
            )}
         </div>

         <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center px-8">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Showing {logs.length} entries of history</p>
            <div className="flex gap-2">
               <button className="px-3 py-1 bg-white border border-slate-200 rounded text-[10px] font-black">1</button>
               <button className="px-3 py-1 bg-white border border-slate-200 rounded text-[10px] font-black opacity-50">2</button>
               <button className="px-3 py-1 bg-white border border-slate-200 rounded text-[10px] font-black opacity-50">Next</button>
            </div>
         </div>
      </div>
    </div>
  );
};
