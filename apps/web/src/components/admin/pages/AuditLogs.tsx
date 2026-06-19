import { ShieldCheck } from 'lucide-react';

export function AuditLogs() {
  return (
    <div className="p-8 space-y-6 bg-gray-50/50 min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Audit Logs</h2>
          <p className="text-gray-500 text-sm mt-1">View system audit logs</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
        <ShieldCheck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400">Audit logs coming soon.</p>
      </div>
    </div>
  );
}
