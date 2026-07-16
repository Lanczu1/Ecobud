import { useState, useEffect, useMemo } from 'react';
import { BookOpen, Plus, Edit3, Trash2, Clock, Eye, Search, AlertCircle, X, Loader2, Star } from 'lucide-react';
import { adminGet, adminPostForm, adminPutForm, adminDelete, adminPatch, API_HOST } from '../../../utils/adminApi';

interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  difficulty?: string;
  durationMinutes: number;
  rating: number;
  pointsReward: number;
  isPublished: boolean;
  featured: boolean;
  videoUrl?: string | null;
  imageUrl?: string | null;
  transcript?: string | null;
  quizPassingScore?: number;
  quizQuestions?: any[];
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string | null;
  createdBy: { id: string; name: string; email: string } | null;
}

const statusColors: Record<string, string> = {
  Published: 'bg-green-50 text-green-700 border-green-100',
  Draft: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  'Auto Publish': 'bg-blue-50 text-blue-700 border-blue-100',
};

const getLessonStatus = (lesson: Lesson) => {
  if (lesson.isPublished) return 'Published';
  if (lesson.scheduledAt) return 'Auto Publish';
  return 'Draft';
};

const CATEGORIES = ['General', 'Recycling', 'Climate', 'Waste', 'Lifestyle', 'Energy', 'Water', 'Nature', 'Food'];

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;
}

function OptimizedInput({ value, onChange, ...props }: any) {
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => { setLocalValue(value); }, [value]);
  return <input value={localValue} onChange={e => setLocalValue(e.target.value)} onBlur={() => onChange(localValue)} {...props} />;
}

function OptimizedTextArea({ value, onChange, ...props }: any) {
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => { setLocalValue(value); }, [value]);
  return <textarea value={localValue} onChange={e => setLocalValue(e.target.value)} onBlur={() => onChange(localValue)} {...props} />;
}

interface FormDataState {
  title: string;
  description: string;
  content: string;
  category: string;
  difficulty: string;
  isPublished: boolean;
  featured: boolean;
  quizPassingScore: number;
  pointsReward: number;
  transcript?: string | null;
  durationMinutes: number;
  quizQuestions: any[];
  pages: any[];
  scheduledAt: string;
}

const emptyForm: FormDataState = { title: '', description: '', content: '', category: 'General', difficulty: 'Beginner', isPublished: false, featured: false, quizPassingScore: 70, pointsReward: 10, durationMinutes: 8, quizQuestions: [], pages: [{ title: '', description: '', content: '' }], scheduledAt: '' };

interface ModalProps {
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  initial?: Lesson | null;
}

const formatLocalDatetime = (dateString?: string | null) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function LessonModal({ onClose, onSave, initial }: ModalProps) {
  const [form, setForm] = useState<FormDataState>(
    initial
      ? { title: initial.title, description: initial.description, content: initial.content, category: initial.category, difficulty: initial.difficulty || 'Beginner', isPublished: initial.isPublished, featured: initial.featured || false, quizPassingScore: initial.quizPassingScore || 70, pointsReward: initial.pointsReward || 10, quizQuestions: initial.quizQuestions || [], transcript: initial.transcript, durationMinutes: initial.durationMinutes || 8, pages: (initial as any).pages && (initial as any).pages.length > 0 ? (initial as any).pages : [{ title: '', description: '', content: '' }], scheduledAt: formatLocalDatetime(initial.scheduledAt) }
      : emptyForm
  );
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [removeThumbnail, setRemoveThumbnail] = useState(false);
  const [removeVideo, setRemoveVideo] = useState(false);
  const [thumbnailKey, setThumbnailKey] = useState(Date.now());
  const [videoKey, setVideoKey] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [enableVideo, setEnableVideo] = useState(initial ? !!initial.videoUrl : false);
  const [enableQuiz, setEnableQuiz] = useState(initial ? (initial.quizQuestions && initial.quizQuestions.length > 0) : false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 280);
  };

  const clearThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailKey(Date.now());
    if (initial?.imageUrl) setRemoveThumbnail(true);
  };

  const clearVideo = () => {
    setVideoFile(null);
    setVideoKey(Date.now());
    setUploadedVideoUrl(null);
    if (initial?.videoUrl) setRemoveVideo(true);
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setVideoFile(file);
    if (file) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = function () {
        window.URL.revokeObjectURL(video.src);
        const durationMinutes = Math.max(1, Math.ceil(video.duration / 60));
        setForm(f => ({ ...f, durationMinutes }));
      };
      video.src = URL.createObjectURL(file);
    }
  };

  const handleGenerateTranscript = async () => {
    if (!videoFile) {
      setErr('Please select a video file first to generate a transcript.');
      return;
    }
    setIsTranscribing(true);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('video', videoFile);
      const res = await adminPostForm<{ transcript: string, videoUrl: string }>('/admin/transcribe', fd);
      setForm(f => ({ ...f, transcript: res.transcript }));
      setUploadedVideoUrl(res.videoUrl);
    } catch (error: any) {
      setErr(error.message || 'Transcription failed');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleAddQuestion = () => {
    setForm(f => ({
      ...f,
      quizQuestions: [...f.quizQuestions, { question: '', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: 'A' }]
    }));
  };

  const handleUpdateQuestion = (index: number, field: string, value: string) => {
    setForm(f => {
      const q = [...f.quizQuestions];
      q[index] = { ...q[index], [field]: value };
      return { ...f, quizQuestions: q };
    });
  };

  const handleRemoveQuestion = (index: number) => {
    setForm(f => {
      const q = [...f.quizQuestions];
      q.splice(index, 1);
      return { ...f, quizQuestions: q };
    });
  };

  const handleAddPage = () => {
    setForm(f => ({ ...f, pages: [...f.pages, { title: '', description: '', content: '' }] }));
  };

  const handleUpdatePage = (index: number, field: string, value: string) => {
    setForm(f => {
      const p = [...f.pages];
      p[index] = { ...p[index], [field]: value };
      return { ...f, pages: p };
    });
  };

  const handleRemovePage = (index: number) => {
    if (!confirm('Are you sure you want to remove this page?')) return;
    setForm(f => {
      const p = [...f.pages];
      p.splice(index, 1);
      return { ...f, pages: p };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) { 
      setErr('Title and description are required.'); 
      return; 
    }
    if (form.pages.length === 0) {
      setErr('At least one lesson page is required.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('content', form.content);
      formData.append('category', form.category);
      formData.append('difficulty', form.difficulty);
      formData.append('isPublished', String(form.isPublished));
      if (form.scheduledAt) {
        formData.append('scheduledAt', new Date(form.scheduledAt).toISOString());
      } else {
        formData.append('scheduledAt', ''); // Send empty to clear if needed
      }
      formData.append('featured', String(form.featured));
      formData.append('quizPassingScore', enableQuiz ? String(form.quizPassingScore) : '0');
      formData.append('pointsReward', String(form.pointsReward));

      const hasVideoSubmit = enableVideo && !!(videoFile || uploadedVideoUrl || (initial?.videoUrl && !removeVideo));
      formData.append('durationMinutes', hasVideoSubmit ? String(form.durationMinutes) : '0');

      formData.append('quizQuestions', JSON.stringify(enableQuiz ? form.quizQuestions : []));
      formData.append('pages', JSON.stringify(form.pages));
      if (enableVideo && form.transcript) formData.append('transcript', form.transcript);
      if (enableVideo) {
        if (uploadedVideoUrl) {
          formData.append('uploadedVideoUrl', uploadedVideoUrl);
        } else if (videoFile) {
          formData.append('video', videoFile);
        }
      }
      if (thumbnailFile) formData.append('thumbnail', thumbnailFile);
      if (removeThumbnail) formData.append('removeThumbnail', 'true');
      if (!enableVideo || removeVideo) formData.append('removeVideo', 'true');

      await onSave(formData);
      handleClose();
    } catch (error: any) {
      setErr(error.message || 'Failed to save lesson.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={`absolute -inset-[100px] bg-black/60 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} />
      <div className={`relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-[960px] max-h-[600px] flex flex-col overflow-hidden ${isClosing ? 'animate-modal-exit' : 'animate-modal'}`}>
        <div className="flex flex-shrink-0 items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-serif font-bold text-gray-900">{initial ? 'Edit Lesson' : 'Add Learning Content'}</h2>
          <button onClick={handleClose} type="button" className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto lesson-modal-scroll p-6 flex flex-col md:flex-row gap-8" style={{ scrollbarGutter: 'stable' }}>
          <div className="flex-1 space-y-4">
            {err && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{err}</p>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <OptimizedInput value={form.title} onChange={(val: string) => setForm(f => ({ ...f, title: val }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all" placeholder="Lesson title" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <OptimizedTextArea value={form.description} onChange={(val: string) => setForm(f => ({ ...f, description: val }))} rows={2} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all resize-none" placeholder="Short description" />
            </div>
            <div className="bg-gray-50/50 rounded-xl border border-gray-200 p-5 shadow-sm mb-4 mt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-800">Lesson Pages</h3>
                  <p className="text-xs text-gray-500 mt-1">Split the lesson into multiple swipeable pages.</p>
                </div>
                <button type="button" onClick={handleAddPage} className="text-xs text-green-600 font-semibold hover:text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">+ Add Page</button>
              </div>
              <div className="space-y-4">
                {form.pages.map((p, i) => (
                  <div key={i} className="p-4 border border-gray-200 rounded-xl bg-white space-y-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Page {i + 1}</span>
                      <button type="button" onClick={() => handleRemovePage(i)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
                      <textarea value={p.content} onChange={(e) => handleUpdatePage(i, 'content', e.target.value)} rows={5} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all resize-none font-mono text-xs" placeholder="Full lesson content..." />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all">
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>
              </div>
              {enableVideo && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                  <OptimizedInput type="number" min="1" value={form.durationMinutes} onChange={(val: string) => setForm(f => ({ ...f, durationMinutes: parseInt(val) || 1 }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail Image</label>
              <div className="flex items-center gap-2">
                <input key={thumbnailKey} type="file" accept="image/*" onChange={e => { setThumbnailFile(e.target.files?.[0] || null); setRemoveThumbnail(false); }} className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                {(thumbnailFile || (initial?.imageUrl && !removeThumbnail)) && (
                  <button type="button" onClick={clearThumbnail} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors flex-shrink-0" title="Remove file">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {initial?.imageUrl && !thumbnailFile && !removeThumbnail && (
                <p className="mt-2 text-xs text-green-600 font-medium">
                  ✓ Current image: <a href={`${API_HOST}${initial.imageUrl}`} target="_blank" rel="noreferrer" className="underline hover:text-green-700" title={initial.imageUrl}>{initial.imageUrl.split('/').pop()}</a>
                </p>
              )}
            </div>
            <div className="bg-gray-50/50 rounded-xl border border-gray-200 p-4 shadow-sm space-y-4 mb-4 mt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${enableVideo ? 'bg-green-500' : 'bg-gray-300'}`} onClick={() => setEnableVideo(!enableVideo)}>
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${enableVideo ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-sm font-semibold text-gray-700">Include Video in Lesson</span>
              </label>

              {enableVideo && (
                <div className="space-y-4 pt-3 border-t border-gray-200/60">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Video File</label>
                    <div className="flex items-center gap-2">
                      <input key={videoKey} type="file" accept="video/*" onChange={(e) => { handleVideoSelect(e); setRemoveVideo(false); }} className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                      {(videoFile || (initial?.videoUrl && !removeVideo)) && (
                        <button type="button" onClick={clearVideo} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors flex-shrink-0" title="Remove file">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {initial?.videoUrl && !videoFile && !isTranscribing && !removeVideo && (
                      <p className="mt-2 text-xs text-green-600 font-medium">
                        ✓ Current video: <a href={`${API_HOST}${initial.videoUrl}`} target="_blank" rel="noreferrer" className="underline hover:text-green-700" title={initial.videoUrl}>{initial.videoUrl.split('/').pop()}</a>
                      </p>
                    )}
                  </div>
                  {isTranscribing ? (
                    <div className="flex items-center gap-2 text-sm text-green-600 font-medium bg-green-50 p-3 rounded-xl">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating transcript from video...
                    </div>
                  ) : (
                    <div className="p-4 border border-gray-200 rounded-xl shadow-sm bg-white space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-bold text-gray-800">Transcript</label>
                        {videoFile && (
                          <button type="button" onClick={handleGenerateTranscript} className="text-xs px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:text-green-700 hover:border-green-200 transition-colors shadow-sm flex items-center gap-2">
                            {form.transcript ? 'Regenerate Transcript' : 'Generate Transcript'}
                          </button>
                        )}
                      </div>
                      {form.transcript ? (
                        <OptimizedTextArea value={form.transcript} onChange={(val: string) => setForm(f => ({ ...f, transcript: val }))} rows={5} className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl font-mono text-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-green-200" placeholder="Transcript text..." />
                      ) : (
                        <div className="w-full px-4 py-6 text-sm text-center border border-dashed border-gray-200 rounded-xl text-gray-500 bg-gray-50/50 flex flex-col items-center justify-center gap-2">
                          <p>{videoFile ? 'Click the button above to extract text from the selected video.' : 'Select a video to generate a transcript or paste one manually.'}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="h-2 w-full flex-shrink-0" />
          </div>

          <div className="w-full md:w-[400px] flex flex-col gap-6">
            <div className="bg-gray-50/50 rounded-xl border border-gray-200 p-5 shadow-sm">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${enableQuiz ? 'bg-green-500' : 'bg-gray-300'}`} onClick={() => {
                  if (enableQuiz && form.quizQuestions.length > 0) {
                    if (!confirm('Disable quiz and remove all questions?')) return;
                    setForm(f => ({ ...f, quizQuestions: [] }));
                  }
                  setEnableQuiz(!enableQuiz);
                }}>
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${enableQuiz ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-sm font-semibold text-gray-800">Include Quiz Configuration</span>
              </label>

              {enableQuiz && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-800">Quiz Configuration</h3>
                    <button type="button" onClick={handleAddQuestion} className="text-xs text-green-600 font-semibold hover:text-green-700">+ Add Question</button>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Passing Score (%)</label>
                    <OptimizedInput type="number" min="0" max="100" value={form.quizPassingScore} onChange={(val: string) => setForm(f => ({ ...f, quizPassingScore: parseInt(val) || 0 }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
                  </div>

                  <div className="space-y-4">
                    {form.quizQuestions.map((q, i) => (
                      <div key={i} className="p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-semibold text-gray-500 uppercase">Question {i + 1}</span>
                          <button type="button" onClick={() => handleRemoveQuestion(i)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <OptimizedInput value={q.question} onChange={(val: string) => handleUpdateQuestion(i, 'question', val)} placeholder="Question text" className="w-full mb-2 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200" />
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <OptimizedInput value={q.optionA} onChange={(val: string) => handleUpdateQuestion(i, 'optionA', val)} placeholder="Option A" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200" />
                          <OptimizedInput value={q.optionB} onChange={(val: string) => handleUpdateQuestion(i, 'optionB', val)} placeholder="Option B" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200" />
                          <OptimizedInput value={q.optionC} onChange={(val: string) => handleUpdateQuestion(i, 'optionC', val)} placeholder="Option C" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200" />
                          <OptimizedInput value={q.optionD} onChange={(val: string) => handleUpdateQuestion(i, 'optionD', val)} placeholder="Option D" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200" />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-gray-700">Correct Answer:</label>
                          <select value={q.correctAnswer} onChange={e => handleUpdateQuestion(i, 'correctAnswer', e.target.value)} className="px-2 py-1 text-sm border border-gray-200 rounded-lg">
                            {['A', 'B', 'C', 'D'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Eco Points Reward</label>
                <OptimizedInput type="number" min="0" value={form.pointsReward} onChange={(val: string) => setForm(f => ({ ...f, pointsReward: parseInt(val) || 0 }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
              </div>
              
              <div className="pt-2 border-t border-gray-100">
                <label className="flex items-center gap-3 cursor-pointer mb-2">
                  <div className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${form.featured ? 'bg-indigo-500' : 'bg-gray-300'}`} onClick={() => setForm(f => ({ ...f, featured: !f.featured }))}>
                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${form.featured ? 'translate-x-4' : ''}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Feature this lesson</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${form.isPublished ? 'bg-green-500' : 'bg-gray-300'}`} onClick={() => setForm(f => ({ ...f, isPublished: !f.isPublished }))}>
                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${form.isPublished ? 'translate-x-4' : ''}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Publish immediately</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Schedule Publish Date</label>
                <OptimizedInput type="datetime-local" value={form.scheduledAt} onChange={(val: string) => setForm(f => ({ ...f, scheduledAt: val }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
                <p className="text-xs text-gray-500 mt-1">If set, the lesson will be automatically published at this time.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleClose} className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Saving…' : (initial ? 'Update Lesson' : 'Create Lesson')}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LearningContent() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await adminGet<Lesson[]>('/admin/lessons');
      setLessons(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load lessons.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    lessons.filter(c => {
      const status = getLessonStatus(c);
      const matchesStatus = filterStatus === 'All' || status === filterStatus;
      return matchesStatus && c.title.toLowerCase().includes(search.toLowerCase());
    }), [lessons, search, filterStatus]);

  const handleAdd = async (form: FormData) => {
    const newLesson = await adminPostForm<Lesson>('/admin/lessons', form);
    setLessons(prev => [newLesson, ...prev]);
  };

  const handleEdit = async (form: FormData) => {
    if (!editing) return;
    const updated = await adminPutForm<Lesson>(`/admin/lessons/${editing.id}`, form);
    setLessons(prev => prev.map(l => l.id === updated.id ? updated : l));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lesson? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await adminDelete(`/admin/lessons/${id}`);
      setLessons(prev => prev.filter(l => l.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete lesson.');
    } finally {
      setDeleting(null);
    }
  };

  const handleTogglePublish = async (lesson: Lesson) => {
    setToggling(lesson.id);
    try {
      const updated = await adminPatch<Lesson>(`/admin/lessons/${lesson.id}/publish`, { is_published: !lesson.isPublished });
      setLessons(prev => prev.map(l => l.id === updated.id ? updated : l));
    } catch (err: any) {
      alert(err.message || 'Failed to toggle publish status.');
    } finally {
      setToggling(null);
    }
  };

  const handleToggleFeatured = async (lesson: Lesson) => {
    setToggling(lesson.id + 'featured');
    try {
      const updated = await adminPatch<Lesson>(`/admin/lessons/${lesson.id}/feature`, { featured: !lesson.featured });
      setLessons(prev => prev.map(l => l.id === updated.id ? updated : l));
    } catch (err: any) {
      alert(err.message || 'Failed to toggle featured status.');
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="p-8 space-y-6 bg-gray-50/50 min-h-full">
      {/* Modals */}
      {modal === 'add' && <LessonModal onClose={() => setModal(null)} onSave={handleAdd} />}
      {modal === 'edit' && editing && <LessonModal onClose={() => { setModal(null); setEditing(null); }} onSave={handleEdit} initial={editing} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Learning Content</h2>
          <p className="text-gray-500 text-sm mt-1">Create and manage eco-education articles and modules</p>
        </div>
        <button onClick={() => setModal('add')} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 hover:shadow-lg active:scale-95 transition-all duration-200">
          <Plus className="w-4 h-4" />
          Add Content
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="flex w-full gap-4 overflow-x-auto pb-2">
        {[
          { label: 'Total Content', value: loading ? '—' : lessons.length, extra: 'modules', color: 'text-gray-900 dark:text-white' },
          { label: 'Published', value: loading ? '—' : lessons.filter(c => getLessonStatus(c) === 'Published').length, extra: 'live', color: 'text-green-600' },
          { label: 'Auto Publish', value: loading ? '—' : lessons.filter(c => getLessonStatus(c) === 'Auto Publish').length, extra: 'scheduled', color: 'text-blue-600' },
          { label: 'Drafts', value: loading ? '—' : lessons.filter(c => getLessonStatus(c) === 'Draft').length, extra: 'unpublished', color: 'text-yellow-600' },
        ].map((s, idx) => {
          const delayClass = idx === 0 ? '' : idx === 1 ? 'delay-60' : 'delay-160';
          return (
            <div key={s.label} className={`flex-1 min-w-[200px] bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm animate-reveal ${delayClass} hover:-translate-y-1 hover:shadow-md transition-all duration-300`}>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{s.label}</p>
              <p className={`text-3xl font-serif font-bold mt-1 ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.extra}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3 items-center animate-reveal delay-160">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search content..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all" />
        </div>
        {['All', 'Published', 'Auto Publish', 'Draft'].map(f => (
          <button key={f} onClick={() => setFilterStatus(f)} className={`px-4 py-2 text-sm rounded-xl border font-medium transition-all ${filterStatus === f ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}>{f}</button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-reveal delay-280">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <Skeleton className="h-28 rounded-none" />
              <div className="p-5 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))
          : filtered.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
              <div className="bg-gradient-to-br from-green-50 to-emerald-100 h-32 flex items-center justify-center text-4xl relative overflow-hidden">
                {item.imageUrl && item.imageUrl !== 'null' && item.imageUrl !== 'undefined' ? (
                  <img src={item.imageUrl.startsWith('http') ? item.imageUrl : `${API_HOST}${item.imageUrl}`} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <BookOpen className="w-12 h-12 text-green-600 opacity-50" />
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${statusColors[getLessonStatus(item)]}`}>
                    {getLessonStatus(item)}
                  </span>
                  <div className="flex gap-2">
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full border bg-blue-50 text-blue-700 border-blue-100">
                      {item.category}
                    </span>
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full border bg-amber-50 text-amber-700 border-amber-100">
                      {item.difficulty || 'Beginner'}
                    </span>
                  </div>
                </div>
                <h3 className="font-serif font-bold text-gray-900 mb-1 leading-snug">{item.title}</h3>
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{item.description}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                  {item.durationMinutes > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{item.durationMinutes}m</span>}
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{item.pointsReward} pts</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTogglePublish(item)}
                    disabled={toggling === item.id}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${item.isPublished ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' : 'bg-green-50 text-green-700 hover:bg-green-100'} disabled:opacity-60`}
                  >
                    {toggling === item.id ? '…' : item.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => handleToggleFeatured(item)}
                    disabled={toggling === item.id + 'featured'}
                    title={item.featured ? 'Unfeature' : 'Feature'}
                    className={`flex items-center justify-center px-3 py-2 text-xs font-semibold rounded-xl transition-colors disabled:opacity-60 ${item.featured ? 'bg-yellow-50 text-yellow-500 hover:bg-yellow-100' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                  >
                    {toggling === item.id + 'featured' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className={`w-3 h-3 ${item.featured ? 'fill-current' : ''}`} />}
                  </button>
                  <button onClick={() => { setEditing(item); setModal('edit'); }} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-xs font-semibold rounded-xl hover:bg-blue-100 transition-colors">
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id} className="flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-100 transition-colors disabled:opacity-60">
                    {deleting === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">{lessons.length === 0 ? 'No lessons yet. Create your first one!' : 'No content found matching your filters.'}</p>
        </div>
      )}
    </div>
  );
}
