import React, { useState, useEffect } from 'react';
import {
  FileCode2,
  Search,
  Clock,
  User,
  ShieldAlert,
  Filter
} from 'lucide-react';
import { ActivityLog } from '../types';

interface Props {
  showNotification: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const AuditLogView: React.FC<Props> = ({ showNotification }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/audit-logs');
      const json = await res.json();
      if (json.success) {
        setLogs(json.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.user.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      (log.applicant_id && log.applicant_id.toLowerCase().includes(search.toLowerCase())) ||
      (log.applicant_name && log.applicant_name.toLowerCase().includes(search.toLowerCase()));

    if (selectedModule === 'ALL') return matchesSearch;
    return matchesSearch && log.module === selectedModule;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-md flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono bg-rose-500 text-white">
              IMMUTABLE AUDIT TRAIL
            </span>
            <span className="text-xs text-slate-300">Master Prompt V3 Module</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-1.5">
            System Security & Activity Audit Log
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Append-only record of all registration updates, status changes, date overrides, spreadsheet imports, and Google live synchronization events.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {['ALL', 'Registration', 'FollowUp', 'Embassy', 'Documents', 'Departure', 'Ticketing', 'System', 'Sync'].map((mod) => (
            <button
              key={mod}
              onClick={() => setSelectedModule(mod)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer whitespace-nowrap ${
                selectedModule === mod ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
              }`}
            >
              {mod}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action, staff, applicant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-1.5 text-xs rounded-xl focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-3.5 pl-4 font-mono">Timestamp</th>
                <th className="p-3.5">Staff User</th>
                <th className="p-3.5">Module</th>
                <th className="p-3.5">Action Executed</th>
                <th className="p-3.5">Target Candidate / Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    Loading audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No activity logs recorded matching criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.log_id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 pl-4 font-mono font-bold text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{log.user}</span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-800 border border-slate-200">
                        {log.module}
                      </span>
                    </td>
                    <td className="p-3.5 font-semibold text-slate-800">
                      {log.action}
                    </td>
                    <td className="p-3.5 whitespace-nowrap font-bold text-slate-700">
                      {log.applicant_name ? (
                        <span>{log.applicant_name} <span className="font-mono text-slate-400 text-[10px]">({log.applicant_id})</span></span>
                      ) : (
                        <span className="text-slate-400 font-normal italic">System Wide / General</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
