import React, { useState } from 'react';
import { useAdminLessons } from '../hooks/useAdminLessons';
import { adminService } from '../services/adminService';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Edit, 
  Globe, 
  Lock, 
  RefreshCcw, 
  Search,
  AlertTriangle,
  Check
} from 'lucide-react';

export const AdminLearnManagement: React.FC = () => {
  const { lessons, loading, error, deleteLesson, togglePublish, createLesson, updateLesson } = useAdminLessons();
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [resetUserId, setResetUserId] = useState('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    category: 'General',
    isPublished: false
  });

  const filteredLessons = lessons.filter(l => 
    l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await updateLesson(isEditing, formData);
        setIsEditing(null);
      } else {
        await createLesson(formData);
      }
      setFormData({ title: '', description: '', content: '', category: 'General', isPublished: false });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEdit = (lesson: any) => {
    setIsEditing(lesson.id);
    setFormData({
      title: lesson.title,
      description: lesson.description,
      content: lesson.content,
      category: lesson.category,
      isPublished: lesson.isPublished
    });
  };

  const handleResetKnowledge = async () => {
    if (!resetUserId) return;
    try {
      const res = await adminService.resetUserKnowledge(resetUserId);
      setResetMessage(res.message);
      setResetUserId('');
      setTimeout(() => setResetMessage(null), 3000);
    } catch (err: any) {
      alert("Failed to reset knowledge points.");
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Loading Learn Modules...</div>;
  if (error) return <div className="p-8 text-center text-red-500 font-bold">Error: {error}</div>;

  return (
    <div className="p-8 space-y-12 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <BookOpen className="text-forest" size={36} />
            Learn Management
          </h1>
          <p className="text-slate-500 font-medium mt-1">Create, edit, and organize educational sustainability content.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search modules..."
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
                {isEditing ? 'Edit Module' : 'Create New Module'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                 <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Module Title</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 ring-forest/20 transition-all"
                      placeholder="e.g. Master the Art of Composting"
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Category</label>
                    <select 
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 ring-forest/20 transition-all"
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                    >
                       <option>General</option>
                       <option>Waste Management</option>
                       <option>Energy Efficiency</option>
                       <option>Biodiversity</option>
                       <option>Sustainable Eating</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Description</label>
                    <textarea 
                      required
                      rows={3}
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 ring-forest/20 transition-all resize-none"
                      placeholder="Brief overview of the module..."
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Content (Markdown/HTML)</label>
                    <textarea 
                      required
                      rows={6}
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 ring-forest/20 transition-all font-mono"
                      placeholder="# Heading\n\nContent goes here..."
                      value={formData.content}
                      onChange={e => setFormData({...formData, content: e.target.value})}
                    />
                 </div>
                 <div className="flex items-center gap-3 py-2">
                    <input 
                      type="checkbox" 
                      id="isPublished"
                      className="w-5 h-5 text-forest border-slate-300 rounded focus:ring-forest"
                      checked={formData.isPublished}
                      onChange={e => setFormData({...formData, isPublished: e.target.checked})}
                    />
                    <label htmlFor="isPublished" className="text-sm font-black text-slate-700">Publish Immediately</label>
                 </div>
                 
                 <div className="flex gap-3 pt-4">
                    <button type="submit" className="flex-1 btn-eco-primary py-4 shadow-lg shadow-forest/20">
                       {isEditing ? 'Save Changes' : 'Create Module'}
                    </button>
                    {isEditing && (
                      <button 
                        type="button" 
                        onClick={() => { setIsEditing(null); setFormData({title:'', description:'', content:'', category:'General', isPublished: false}); }}
                        className="px-6 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl hover:bg-slate-200 transition-all"
                      >
                         Cancel
                      </button>
                    )}
                 </div>
              </form>
           </div>

           {/* User Control Card */}
           <div className="glass-card mt-10 p-8 border-l-4 border-amber-400">
              <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                 <RefreshCcw className="text-amber-500" size={20} />
                 User Learning Controls
              </h3>
              <p className="text-xs font-medium text-slate-500 mb-6 leading-relaxed">
                 Reset knowledge points for users who have disputed their status or encountered technical errors.
              </p>
              <div className="space-y-4">
                 <input 
                   type="text" 
                   className="w-full px-5 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold"
                   placeholder="Enter User ID..."
                   value={resetUserId}
                   onChange={e => setResetUserId(e.target.value)}
                 />
                 <button 
                   onClick={handleResetKnowledge}
                   disabled={!resetUserId}
                   className="w-full py-3 bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-900 disabled:opacity-50 transition-all"
                 >
                    Reset Knowledge Points
                 </button>
                 {resetMessage && (
                   <div className="flex items-center gap-2 text-emerald-600 animate-in slide-in-from-top-2 duration-300">
                      <Check size={16} />
                      <span className="text-xs font-bold">{resetMessage}</span>
                   </div>
                 )}
              </div>
           </div>
        </div>

        {/* Modules Table Section */}
        <div className="xl:col-span-2 space-y-6">
           <div className="glass-card overflow-hidden">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                       <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Module Info</th>
                       <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                       <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                       <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {filteredLessons.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-8 py-20 text-center">
                           <div className="flex flex-col items-center gap-2 opacity-30">
                              <AlertTriangle size={48} />
                              <p className="font-black">No learning modules found matching your search.</p>
                           </div>
                        </td>
                      </tr>
                    ) : (
                      filteredLessons.map(lesson => (
                        <tr key={lesson.id} className="group hover:bg-emerald-50/20 transition-colors">
                           <td className="px-8 py-6">
                              <div className="flex flex-col">
                                 <span className="text-sm font-black text-slate-800 group-hover:text-forest transition-colors">{lesson.title}</span>
                                 <span className="text-[10px] text-slate-400 font-bold mt-1">Created {new Date(lesson.createdAt).toLocaleDateString()}</span>
                              </div>
                           </td>
                           <td className="px-8 py-6">
                              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                 {lesson.category}
                              </span>
                           </td>
                           <td className="px-8 py-6">
                              <div className="flex justify-center">
                                 <button 
                                   onClick={() => togglePublish(lesson.id, lesson.isPublished)}
                                   className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                                     lesson.isPublished 
                                       ? 'bg-emerald-100 text-forest hover:bg-emerald-200' 
                                       : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                                   }`}
                                 >
                                    {lesson.isPublished ? <Globe size={12} /> : <Lock size={12} />}
                                    {lesson.isPublished ? 'Published' : 'Draft'}
                                 </button>
                              </div>
                           </td>
                           <td className="px-8 py-6 text-right">
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button 
                                   onClick={() => handleEdit(lesson)}
                                   className="p-2.5 bg-emerald-50 text-forest rounded-xl hover:bg-forest hover:text-white transition-all shadow-sm"
                                 >
                                    <Edit size={16} />
                                 </button>
                                 <button 
                                   onClick={() => { if(confirm('Are you sure?')) deleteLesson(lesson.id) }}
                                   className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                 >
                                    <Trash2 size={16} />
                                 </button>
                              </div>
                           </td>
                        </tr>
                      ))
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
    </div>
  );
};
