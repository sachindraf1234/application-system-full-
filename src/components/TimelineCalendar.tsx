import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Settings,
  ChevronLeft,
  ChevronRight,
  User,
  Building2
} from 'lucide-react';
import { TimelineRule, TimelineEvent } from '../types';

interface Props {
  showNotification: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const TimelineCalendarView: React.FC<Props> = ({ showNotification }) => {
  const [rules, setRules] = useState<TimelineRule[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'calendar' | 'rules'>('calendar');
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  // Override Form
  const [overrideDate, setOverrideDate] = useState('');
  const [overrideTime, setOverrideTime] = useState('09:00');
  const [overrideReason, setOverrideReason] = useState('');
  const [changedBy, setChangedBy] = useState('Althaf Hussain');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resRules, resEvents] = await Promise.all([
        fetch('/api/v1/timeline/rules'),
        fetch('/api/v1/timeline/events')
      ]);
      const jsonRules = await resRules.json();
      const jsonEvents = await resEvents.json();

      if (jsonRules.success) setRules(jsonRules.rules || []);
      if (jsonEvents.success) setEvents(jsonEvents.events || []);
    } catch (err) {
      console.error('Failed to fetch timeline calendar data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !overrideDate || !overrideReason) {
      showNotification('error', 'New date and override reason are required.');
      return;
    }

    try {
      const res = await fetch(`/api/v1/timeline/events/${selectedEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_date: overrideDate,
          scheduled_time: overrideTime,
          override_reason: overrideReason,
          changed_by: changedBy
        })
      });
      const json = await res.json();
      if (json.success) {
        showNotification('success', `Updated event date for ${selectedEvent.title}. Reason logged to audit.`);
        setSelectedEvent(null);
        setOverrideReason('');
        fetchData();
      } else {
        showNotification('error', json.error || 'Failed to update event date');
      }
    } catch (err: any) {
      showNotification('error', 'Error updating timeline date: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono bg-purple-400 text-slate-950">
              CONFIGURABLE TIMELINE ENGINE
            </span>
            <span className="text-xs text-slate-300">Master Prompt V3 Rule</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-1.5">
            Recruitment Calendar & Workflow Timeline
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Fully adjustable workflow timeline intervals. Reminders and deadlines are calculated dynamically and can be manually overridden with mandatory audit tracking.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-1.5 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'calendar' ? 'bg-purple-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Calendar View</span>
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-1.5 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'rules' ? 'bg-purple-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Timeline Rules Settings</span>
          </button>
        </div>
      </div>

      {activeTab === 'calendar' ? (
        /* Calendar View */
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex justify-between items-center text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <CalendarIcon className="w-4 h-4 text-purple-600" />
              <span>Upcoming Agency Events & Deadlines</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Total Active Schedule: <strong>{events.length}</strong> events
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full p-8 text-center text-slate-400 text-xs">
                Loading calendar events...
              </div>
            ) : events.length === 0 ? (
              <div className="col-span-full p-8 text-center text-slate-400 text-xs">
                No events currently scheduled.
              </div>
            ) : (
              events.map((evt) => (
                <div
                  key={evt.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-purple-50 text-purple-800 border border-purple-200">
                        {evt.event_type}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {evt.scheduled_date} {evt.scheduled_time || ''}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-slate-900 leading-snug">
                      {evt.title}
                    </h4>

                    {evt.applicant_name && (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{evt.applicant_name}</span>
                        {evt.applicant_id && <span className="font-mono text-slate-400 text-[10px]">({evt.applicant_id})</span>}
                      </div>
                    )}

                    {evt.remarks && (
                      <p className="text-[11px] text-slate-500 italic">
                        "{evt.remarks}"
                      </p>
                    )}

                    {evt.override_reason && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900 space-y-0.5">
                        <span className="font-bold block">Manual Override Recorded:</span>
                        <span>"{evt.override_reason}" (by {evt.changed_by || 'Staff'})</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => {
                        setSelectedEvent(evt);
                        setOverrideDate(evt.scheduled_date);
                        setOverrideTime(evt.scheduled_time || '09:00');
                      }}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3 text-purple-300" />
                      <span>Adjust / Override Date</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Timeline Rules Settings Tab */
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Adjustable Workflow Timeline Rules
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure default intervals for reminders, embassy appointments, departure checks, and ticket warnings. Changing rules affects future scheduling only.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 pl-4 font-mono">Rule Code</th>
                  <th className="p-3">Rule Name</th>
                  <th className="p-3">Module</th>
                  <th className="p-3">Event Type</th>
                  <th className="p-3 text-center">Interval Value</th>
                  <th className="p-3 text-center">Unit</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 pl-4 font-mono font-bold text-slate-900">{rule.rule_code}</td>
                    <td className="p-3 font-bold text-slate-800">{rule.rule_name}</td>
                    <td className="p-3 uppercase font-semibold text-purple-700">{rule.module}</td>
                    <td className="p-3 font-mono text-slate-600">{rule.event_type}</td>
                    <td className="p-3 text-center font-mono font-bold text-slate-900">{rule.interval_value}</td>
                    <td className="p-3 text-center font-mono font-semibold text-slate-600">{rule.interval_unit}</td>
                    <td className="p-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Override Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                Override Event Date (Audit Log Enforced)
              </h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="font-bold text-slate-800 block">{selectedEvent.title}</span>
              <span className="text-slate-500 block">Candidate: {selectedEvent.applicant_name || 'N/A'}</span>
              <span className="text-slate-500 block font-mono">Original Date: {selectedEvent.scheduled_date}</span>
            </div>

            <form onSubmit={handleSaveOverride} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">New Scheduled Date *</label>
                  <input
                    type="date"
                    required
                    value={overrideDate}
                    onChange={(e) => setOverrideDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">New Scheduled Time</label>
                  <input
                    type="time"
                    value={overrideTime}
                    onChange={(e) => setOverrideTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Mandatory Override Reason *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="State operational reason for date adjustment (e.g. Embassy holiday postponement, flight reschedule)..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Authorized Staff Name *</label>
                <input
                  type="text"
                  required
                  value={changedBy}
                  onChange={(e) => setChangedBy(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition cursor-pointer shadow-xs active:scale-98"
                >
                  Confirm & Audit Log Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
