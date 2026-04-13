import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Flag, 
  Clock, 
  ExternalLink,
  ShieldAlert,
  Search,
  Zap,
  Activity
} from 'lucide-react';
import { adminService } from '../services/adminService';

export const AdminSubmissions: React.FC = () => {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const fetchSubmissions = async () => {
    try {
      const data = await adminService.getSubmissions();
      setSubmissions(data);
      if (data.length > 0 && !selectedSubmission) {
        setSelectedSubmission(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleReview = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await adminService.reviewSubmission(id, status, reviewNotes);
      setReviewNotes('');
      fetchSubmissions();
      // If the currently selected one was reviewed, select the next one
      if (selectedSubmission?.id === id) {
         const nextIndex = submissions.findIndex(s => s.id === id) + 1;
         setSelectedSubmission(submissions[nextIndex] || null);
      }
    } catch (err) {
      alert('Failed to review submission');
    }
  };

  if (loading) return <div className="p-8 text-center animate-pulse text-slate-500 font-bold uppercase tracking-widest">Loading evidence...</div>;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
             <ShieldAlert size={32} className="text-forest" />
             Content Moderation
          </h1>
          <p className="text-slate-500 font-medium mt-1">Review user challenge proofs and award Eco Points.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Search eco-heroes..." className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 ring-forest/20 shadow-sm" />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Review Card */}
        <div className="lg:col-span-8 space-y-6">
          {selectedSubmission ? (
            <div className="glass-card overflow-hidden">
               <div className="bg-[#126027] p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedSubmission.user.name}`} className="w-10 h-10 rounded-full border-2 border-white/20" alt="" />
                     <div>
                        <p className="text-white font-black text-sm">{selectedSubmission.challenge.title}</p>
                        <p className="text-white/60 text-[10px] uppercase font-black tracking-widest">{selectedSubmission.user.name} • SUBMITTED {new Date(selectedSubmission.createdAt).toLocaleDateString()}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black text-white uppercase tracking-wider">{selectedSubmission.status}</span>
                     <button className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors"><Flag size={16} /></button>
                  </div>
               </div>

               <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                     <div className="aspect-square bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 shadow-inner group relative">
                        {selectedSubmission.proofUrl ? (
                           <img src={selectedSubmission.proofUrl} className="w-full h-full object-cover" alt="User Proof" />
                        ) : (
                           <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                              <ExternalLink size={48} />
                              <p className="mt-4 font-bold text-xs">No visual evidence provided</p>
                           </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <button className="px-4 py-2 bg-white rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl">Enlarge Proof</button>
                        </div>
                     </div>
                     <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic text-slate-600 text-sm">
                        "{selectedSubmission.description || 'No description provided by the user.'}"
                     </div>
                  </div>

                  <div className="flex flex-col space-y-6">
                     <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Evidence Assessment</p>
                        <h2 className="text-2xl font-black text-slate-800">Review Required</h2>
                     </div>

                     <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                        <div className="flex items-center gap-3 mb-2">
                           <Zap className="text-emerald-600" size={20} />
                           <span className="text-xs font-black text-emerald-800 uppercase tracking-widest">Impact Reward</span>
                        </div>
                        <p className="text-3xl font-black text-emerald-900">+{selectedSubmission.challenge.pointsReward} XP</p>
                        <p className="text-emerald-700/60 text-[10px] font-bold mt-1 uppercase">Awarded upon approval</p>
                     </div>

                     <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Decision Feedback</p>
                        <textarea 
                           className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-medium placeholder:text-slate-300 focus:ring-2 ring-forest/20"
                           placeholder="Type moderation notes or reasoning for rejection..."
                           rows={4}
                           value={reviewNotes}
                           onChange={(e) => setReviewNotes(e.target.value)}
                        />
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <button 
                           onClick={() => handleReview(selectedSubmission.id, 'approved')}
                           className="py-4 bg-[#126027] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-forest/20 hover:scale-[1.02] flex items-center justify-center gap-2 transition-all"
                        >
                           <CheckCircle size={16} /> Approve Evidence
                        </button>
                        <button 
                           onClick={() => handleReview(selectedSubmission.id, 'rejected')}
                           className="py-4 bg-white border-2 border-red-500 text-red-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-50 flex items-center justify-center gap-2 transition-all"
                        >
                           <XCircle size={16} /> Reject Proof
                        </button>
                     </div>
                     <button className="w-full py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Flag as Inappropriate</button>
                  </div>
               </div>
            </div>
          ) : (
            <div className="glass-card p-20 flex flex-col items-center justify-center text-center opacity-50">
               <Clock size={64} className="text-slate-300" />
               <h2 className="text-2xl font-black text-slate-400 mt-6 uppercase tracking-widest">All Caught Up!</h2>
               <p className="text-slate-400 text-sm mt-2">There are no pending challenge submissions to review.</p>
            </div>
          )}
        </div>

        {/* Sidebar List */}
        <div className="lg:col-span-4 space-y-6">
           <div className="glass-card overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                 <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Incoming Queue</h2>
                 <span className="px-2 py-1 bg-forest text-white text-[10px] font-black rounded-lg">{submissions.filter(s => s.status === 'pending').length}</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto custom-scrollbar">
                 {submissions.map((sub) => (
                    <button 
                       key={sub.id} 
                       onClick={() => setSelectedSubmission(sub)}
                       className={`w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-all text-left group ${selectedSubmission?.id === sub.id ? 'bg-emerald-50' : ''}`}
                    >
                       <div className="relative">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${sub.user.name}`} className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200" alt="" />
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                             sub.status === 'approved' ? 'bg-emerald-500' : sub.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'
                          }`}>
                             {sub.status === 'pending' ? <Clock className="text-white" size={8} /> : sub.status === 'approved' ? <CheckCircle className="text-white" size={8} /> : <XCircle className="text-white" size={8} />}
                          </div>
                       </div>
                       <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                             <p className={`text-sm font-black truncate transition-colors ${selectedSubmission?.id === sub.id ? 'text-forest' : 'text-slate-700'}`}>{sub.user.name}</p>
                             <span className="text-[9px] font-black text-slate-300">{new Date(sub.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase truncate">{sub.challenge.title}</p>
                       </div>
                    </button>
                 ))}
                 {submissions.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No submissions yet</div>
                 )}
              </div>
           </div>

           <div className="glass-card p-6 bg-gradient-to-br from-[#126027] to-[#0A3D19] text-white">
              <Activity className="text-white/20 mb-4" size={32} />
              <h3 className="text-lg font-black tracking-tight mb-2">Review Guidelines</h3>
              <ul className="space-y-3">
                 <li className="flex gap-2 text-[10px] font-black text-white/80 uppercase tracking-widest">
                    <CheckCircle className="text-emerald-400 shrink-0" size={14} /> Photo must have a clear subject
                 </li>
                 <li className="flex gap-2 text-[10px] font-black text-white/80 uppercase tracking-widest">
                    <CheckCircle className="text-emerald-400 shrink-0" size={14} /> Description should match the deed
                 </li>
                 <li className="flex gap-2 text-[10px] font-black text-white/80 uppercase tracking-widest">
                    <CheckCircle className="text-emerald-400 shrink-0" size={14} /> Metadata must be within 24h
                 </li>
              </ul>
              <button className="w-full mt-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/20 transition-all">
                 Moderation Policy
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
