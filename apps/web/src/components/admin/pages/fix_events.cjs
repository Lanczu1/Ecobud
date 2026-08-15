const fs = require('fs');
const file = 'c:/xampz/htdocs/Ecobud/apps/web/src/components/admin/pages/Events.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add lucide-react icons
content = content.replace(
  /import { Calendar.*?} from 'lucide-react';/,
  "import { Calendar, Plus, Edit3, Trash2, MapPin, Users, Clock, Search, AlertCircle, X, Loader2, Image as ImageIcon, QrCode, Download, Leaf, FileText, BarChart3, ChevronDown, ChevronUp, ShieldCheck, CheckCircle, XCircle, ExternalLink } from 'lucide-react';"
);

// 2. Add interface Submission
const interfaceStr = `
interface EventSubmission {
  id: string;
  userId: string;
  challengeId: string;
  proofText: string | null;
  proofUrl: string | null;
  afterProofUrl: string | null;
  status: 'pending' | 'approved' | 'rejected';
  moderatorNotes: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    profile: { displayName: string | null; avatarUrl: string | null; } | null;
  };
  challenge: {
    id: string;
    title: string;
    type: string;
  };
  submissionType?: 'CHALLENGE' | 'EVENT';
}
`;
content = content.replace('interface AdminEvent {', interfaceStr + '\ninterface AdminEvent {');

// 3. Add states
content = content.replace(
  "const [activeTab, setActiveTab] = useState<'events' | 'reports'>('events');",
  "const [activeTab, setActiveTab] = useState<'events' | 'reports' | 'submissions'>('events');\n  const [submissions, setSubmissions] = useState<EventSubmission[]>([]);\n  const [submissionsLoading, setSubmissionsLoading] = useState(false);\n  const [processingSubId, setProcessingSubId] = useState<string | null>(null);\n  const [selectedImage, setSelectedImage] = useState<string | null>(null);\n  const [isZoomed, setIsZoomed] = useState(false);\n  const [zoomOrigin, setZoomOrigin] = useState('center center');"
);

// 4. Add loadSubmissions and handleApprove/Reject
const logicStr = `
  const loadSubmissions = async () => {
    setSubmissionsLoading(true);
    try {
      const data = await adminGet<EventSubmission[]>('/admin/submissions');
      setSubmissions(data.filter(s => s.submissionType === 'EVENT'));
    } catch (err: any) {
      console.error(err);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'submissions') loadSubmissions();
  }, [activeTab]);

  const handleApproveSub = async (id: string) => {
    setProcessingSubId(id);
    try {
      await adminPost(\`/admin/submissions/\${id}/review\`, { status: 'approved' });
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'approved' } : s));
    } catch (err: any) {
      alert(err.message || 'Failed to approve');
    } finally {
      setProcessingSubId(null);
    }
  };

  const handleRejectSub = async (id: string) => {
    const notes = window.prompt('Enter reason for rejection (optional):');
    if (notes === null) return;
    setProcessingSubId(id);
    try {
      await adminPost(\`/admin/submissions/\${id}/review\`, { status: 'rejected', notes });
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'rejected', moderatorNotes: notes } : s));
    } catch (err: any) {
      alert(err.message || 'Failed to reject');
    } finally {
      setProcessingSubId(null);
    }
  };
`;
content = content.replace(
  "const load = async () => {",
  logicStr + '\n  const load = async () => {'
);

// 5. Add Tab Button
const tabButtonStr = `
        <button
          onClick={() => setActiveTab('submissions')}
          className={\`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 \${
            activeTab === 'submissions'
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white dark:border dark:border-gray-700'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200'
          }\`}
        >
          <ShieldCheck className="w-4 h-4" />
          Submissions
          {submissions.filter(s => s.status === 'pending').length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[10px]">
              {submissions.filter(s => s.status === 'pending').length}
            </span>
          )}
        </button>
`;
content = content.replace(
  /(<button[\s\S]*?Automated Reports\s*<\/button>)/,
  "$1" + tabButtonStr
);

// Update existing tabs for dark mode if they aren't
content = content.replace(/bg-green-600 text-white shadow-md/g, "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white dark:border dark:border-gray-700");
content = content.replace(/text-gray-500 hover:text-gray-700 hover:bg-gray-50/g, "text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200");
content = content.replace(/bg-white rounded-2xl border border-gray-100 shadow-sm p-1\.5 flex gap-1\.5 animate-reveal/, "bg-gray-100 dark:bg-gray-800/50 rounded-xl p-1 flex gap-1 animate-reveal");

// 6. Add Submissions UI Tab
const submissionsTabStr = `
      {/* ═══ SUBMISSIONS TAB ═══ */}
      {activeTab === 'submissions' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden animate-reveal delay-160">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-white">Event Submissions</h3>
              <button onClick={loadSubmissions} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                {submissionsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Refresh
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/70 dark:bg-gray-800/50">
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-6 py-4">User</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-4">Event</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-4">Proof</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-4">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-4">Date</th>
                  <th className="px-4 py-4 w-[160px]"></th>
                </tr>
              </thead>
              <tbody>
                {submissionsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-4"><div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : submissions.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400 dark:text-gray-500">No event submissions found.</td></tr>
                ) : (
                  submissions.map(sub => {
                    const fullProofUrl = sub.proofUrl ? (sub.proofUrl.startsWith('/') ? \`\${API_HOST}\${sub.proofUrl}\` : sub.proofUrl) : null;
                    const avatarUrl = sub.user?.profile?.avatarUrl ? (sub.user.profile.avatarUrl.startsWith('/') ? \`\${API_HOST}\${sub.user.profile.avatarUrl}\` : sub.user.profile.avatarUrl) : null;
                    const statusBg: Record<string, string> = {
                      pending: 'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800',
                      approved: 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
                      rejected: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
                    };
                    return (
                      <tr key={sub.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors group border-t border-gray-50 dark:border-gray-800/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt={sub.user?.name} className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <span className="text-xs font-bold text-green-700 dark:text-green-400">{(sub.user?.name || '?').charAt(0).toUpperCase()}</span>
                              </div>
                            )}
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{sub.user?.profile?.displayName || sub.user?.name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{sub.challenge?.title || 'Unknown Event'}</p>
                        </td>
                        <td className="px-4 py-4">
                          {fullProofUrl ? (
                            <button onClick={() => setSelectedImage(fullProofUrl)} className="relative w-14 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer">
                              <img src={fullProofUrl} alt="Proof" className="w-full h-full object-cover" />
                            </button>
                          ) : sub.proofText ? (
                            <span className="text-sm text-gray-600 dark:text-gray-300 max-w-[120px] truncate block">{sub.proofText}</span>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500">No proof</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className={\`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border \${statusBg[sub.status] || 'bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}\`}>
                            {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                          </span>
                          {sub.moderatorNotes && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 max-w-[100px] truncate" title={sub.moderatorNotes}>{sub.moderatorNotes}</p>}
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(sub.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            {sub.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApproveSub(sub.id)}
                                  disabled={processingSubId === sub.id}
                                  title="Approve"
                                  className="p-1.5 text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  {processingSubId === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => handleRejectSub(sub.id)}
                                  disabled={processingSubId === sub.id}
                                  title="Reject"
                                  className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 disabled:opacity-50 rounded-lg transition-colors"
                                >
                                  {processingSubId === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
`;

content = content.replace(
  /{activeTab === 'events' && \(/,
  submissionsTabStr + '\n      {activeTab === \'events\' && ('
);

// Add the image preview modal if not present
if (!content.includes('selectedImage && (')) {
  const imgModal = `
      {/* Image preview modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={() => setSelectedImage(null)}>
          <div className="relative w-full h-full flex items-center justify-center">
            <button onClick={e => { e.stopPropagation(); setSelectedImage(null); }} className="absolute top-6 right-6 p-2 text-white/70 hover:text-white z-[110]">
              <XCircle className="w-8 h-8" />
            </button>
            <img src={selectedImage} alt="Proof" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl border border-white/10" onClick={e => e.stopPropagation()} />
          </div>
        </div>
      )}
  `;
  content = content.replace(/(<\/div>\s*)$/, imgModal + '$1');
}

fs.writeFileSync(file, content);
