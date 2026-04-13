import React, { useState, useEffect } from 'react';
import { adminService } from '../services/adminService';
import { 
  Trophy, 
  Plus, 
  Trash2, 
  Edit, 
  Calendar, 
  Target, 
  Award,
  Search,
  CheckCircle2,
} from 'lucide-react';

export const AdminChallengeManagement: React.FC = () => {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    difficulty: 'Easy',
    durationDays: 7,
    pointsReward: 50,
    category: 'General',
    active: true,
    badgeLabel: ''
  });

  const fetchChallenges = async () => {
    setLoading(true);
    try {
      const data = await adminService.getChallenges();
      setChallenges(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await adminService.updateChallenge(isEditing, formData);
        setIsEditing(null);
      } else {
        await adminService.createChallenge(formData);
      }
      setFormData({
        title: '',
        description: '',
        difficulty: 'Easy',
        durationDays: 7,
        pointsReward: 50,
        category: 'General',
        active: true,
        badgeLabel: ''
      });
      fetchChallenges();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEdit = (challenge: any) => {
    setIsEditing(challenge.id);
    setFormData({
      title: challenge.title,
      description: challenge.description,
      difficulty: challenge.difficulty,
      durationDays: challenge.durationDays,
      pointsReward: challenge.pointsReward,
      category: challenge.category || 'General',
      active: challenge.active,
      badgeLabel: challenge.badgeLabel || ''
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this challenge? Users will lose their progress.')) return;
    try {
      await adminService.deleteChallenge(id);
      fetchChallenges();
    } catch (err) {
      alert('Failed to delete challenge');
    }
  };

  const filteredChallenges = challenges.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Loading Challenges...</div>;

  return (
    <div className="p-8 space-y-12 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Trophy className="text-amber-500" size={36} />
            Challenge Posting
          </h1>
          <p className="text-slate-500 font-medium mt-1">Design and push new sustainability goals to your users app.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search challenges..."
                className="pl-12 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 ring-forest/20 w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* Form Section */}
        <div className="xl:col-span-1">
           <div className="glass-card p-8 sticky top-8">
              <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                {isEditing ? <Edit size={20} /> : <Plus size={20} />}
                {isEditing ? 'Edit Challenge' : 'Post New Challenge'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                 <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Challenge Title</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 ring-forest/20 transition-all"
                      placeholder="e.g. 7-Day Zero Waste Hero"
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Difficulty</label>
                        <select 
                          className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold"
                          value={formData.difficulty}
                          onChange={e => setFormData({...formData, difficulty: e.target.value})}
                        >
                           <option>Easy</option>
                           <option>Medium</option>
                           <option>Hard</option>
                           <option>Expert</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Category</label>
                        <select 
                          className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold"
                          value={formData.category}
                          onChange={e => setFormData({...formData, category: e.target.value})}
                        >
                           <option>General</option>
                           <option>Waste</option>
                           <option>Energy</option>
                           <option>Water</option>
                           <option>Food</option>
                        </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Duration (Days)</label>
                        <input 
                          type="number" 
                          className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold"
                          value={formData.durationDays}
                          onChange={e => setFormData({...formData, durationDays: parseInt(e.target.value)})}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Points Reward</label>
                        <input 
                          type="number" 
                          className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold"
                          value={formData.pointsReward}
                          onChange={e => setFormData({...formData, pointsReward: parseInt(e.target.value)})}
                        />
                    </div>
                 </div>

                 <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Badge Label (Optional)</label>
                    <input 
                      type="text" 
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold"
                      placeholder="e.g. Master Composter"
                      value={formData.badgeLabel}
                      onChange={e => setFormData({...formData, badgeLabel: e.target.value})}
                    />
                 </div>

                 <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Description</label>
                    <textarea 
                      required
                      rows={4}
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold resize-none"
                      placeholder="What should the user do?"
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                 </div>

                 <div className="flex items-center gap-3 py-2">
                    <input 
                      type="checkbox" 
                      id="active"
                      className="w-5 h-5 text-forest border-slate-300 rounded focus:ring-forest"
                      checked={formData.active}
                      onChange={e => setFormData({...formData, active: e.target.checked})}
                    />
                    <label htmlFor="active" className="text-sm font-black text-slate-700">Make Live Instantly</label>
                 </div>
                 
                 <div className="flex gap-3 pt-4">
                    <button type="submit" className="flex-1 py-4 bg-amber-500 text-white font-black rounded-2xl shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all">
                       {isEditing ? 'Save Changes' : 'Post Challenge'}
                    </button>
                    {isEditing && (
                      <button 
                        type="button" 
                        onClick={() => { setIsEditing(null); setFormData({title:'', description:'', difficulty:'Easy', durationDays:7, pointsReward:50, category:'General', active:true, badgeLabel:''}); }}
                        className="px-6 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl"
                      >
                         Cancel
                      </button>
                    )}
                 </div>
              </form>
           </div>
        </div>

        {/* List Section */}
        <div className="xl:col-span-2 space-y-6">
           {filteredChallenges.map((challenge) => (
             <div key={challenge.id} className="glass-card p-6 group hover:translate-x-2 transition-all duration-300">
                <div className="flex flex-col md:flex-row gap-6">
                   <div className="w-24 h-24 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-amber-50 group-hover:text-amber-500 transition-colors">
                      <Target size={40} />
                   </div>
                   <div className="flex-1">
                      <div className="flex items-start justify-between">
                         <div>
                            <div className="flex items-center gap-2 mb-1">
                               <span className="px-2 py-0.5 bg-emerald-100 text-forest text-[9px] font-black uppercase tracking-widest rounded">
                                  {challenge.category}
                               </span>
                               <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded ${
                                  challenge.difficulty === 'Expert' ? 'bg-red-100 text-red-600' :
                                  challenge.difficulty === 'Hard' ? 'bg-orange-100 text-orange-600' :
                                  'bg-blue-100 text-blue-600'
                               }`}>
                                  {challenge.difficulty}
                               </span>
                            </div>
                            <h3 className="text-xl font-black text-slate-800">{challenge.title}</h3>
                         </div>
                         <div className="flex gap-2">
                            <button onClick={() => handleEdit(challenge)} className="p-2 bg-slate-50 text-slate-400 hover:bg-forest hover:text-white rounded-xl transition-all">
                               <Edit size={16} />
                            </button>
                            <button onClick={() => handleDelete(challenge)} className="p-2 bg-slate-50 text-slate-400 hover:bg-red-500 hover:text-white rounded-xl transition-all">
                               <Trash2 size={16} />
                            </button>
                         </div>
                      </div>
                      <p className="text-sm font-medium text-slate-500 mt-2 line-clamp-2">{challenge.description}</p>
                      
                      <div className="flex flex-wrap items-center gap-6 mt-6 pt-6 border-t border-slate-50">
                         <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-slate-400" />
                            <span className="text-xs font-black text-slate-700">{challenge.durationDays} Days</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <Award size={14} className="text-slate-400" />
                            <span className="text-xs font-black text-slate-700">{challenge.pointsReward} Points</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <CheckCircle2 size={14} className={challenge.active ? 'text-forest' : 'text-slate-300'} />
                            <span className={`text-xs font-black uppercase tracking-widest ${challenge.active ? 'text-forest' : 'text-slate-400'}`}>
                               {challenge.active ? 'Active' : 'Draft'}
                            </span>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
           ))}

           {filteredChallenges.length === 0 && (
              <div className="py-20 text-center glass-card opacity-30">
                 <Trophy size={64} className="mx-auto mb-4" />
                 <p className="font-black text-xl">No challenges posted yet.</p>
              </div>
           )}
        </div>
      </div>
    </div>
  );
};
