import React, { useState } from 'react';
import { Phone, Clock, AlertTriangle, CheckCircle, X, MessageSquare, Calendar } from 'lucide-react';
import { ApplicantOverview } from '../types';

interface Props {
  applicant: ApplicantOverview;
  currentFollowupCount: number;
  onClose: () => void;
  onSuccess: () => void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const FollowUpModal: React.FC<Props> = ({
  applicant,
  currentFollowupCount,
  onClose,
  onSuccess,
  showNotification
}) => {
  const nextNum = currentFollowupCount + 1;
  const isThirdAttempt = nextNum >= 3;

  const [method, setMethod] = useState<'Call' | 'WhatsApp' | 'In-Person' | 'Email' | 'Other'>('Call');
  const [result, setResult] = useState<string>('Interested');
  const [contactedBy, setContactedBy] = useState<string>('Registration Desk');
  const [description, setDescription] = useState<string>('');
  const [nextAction, setNextAction] = useState<string>('Visit office for original passport handover');
  const [nextDate, setNextDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Red closure states
  const [doesNotWantToProceed, setDoesNotWantToProceed] = useState<boolean>(false);
  const [closedReason, setClosedReason] = useState<string>('Travel issue / Family refusal');

  const closureReasons = [
    'Travel issue / Family refusal',
    'Selected other recruitment agency',
    'Medical unfit / Health issue',
    'Passport expired / Renewal problem',
    'Unreachable / Wrong contact number',
    'Salary expectation mismatch',
    'Does not want to go overseas',
    'Did not attend interview / No show'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/applicants/${applicant.applicant_id}/followups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followup_date: new Date().toISOString().split('T')[0],
          contacted_by: contactedBy,
          method,
          result,
          description,
          next_action: nextAction,
          next_followup_date: nextDate,
          doesNotWantToProceed: doesNotWantToProceed || (isThirdAttempt && result === 'Not Interested'),
          closed_reason: closedReason
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(
          doesNotWantToProceed ? 'info' : 'success',
          doesNotWantToProceed 
            ? `Applicant marked as RED_CLOSED (${closedReason})` 
            : `Logged Follow-up 0${nextNum} successfully.`
        );
        onSuccess();
        onClose();
      } else {
        showNotification('error', data.error || 'Failed to log follow-up record');
      }
    } catch (err: any) {
      showNotification('error', `Connection error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                Log Follow-up 0{nextNum}
              </h3>
              <p className="text-xs text-slate-400">{applicant.full_name} ({applicant.registration_number})</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Strike Warning Banner */}
        {isThirdAttempt && (
          <div className="bg-amber-50 border-b border-amber-200 p-3.5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <span className="font-bold">Follow-up 03 Rule Notice:</span> This is the 3rd and final follow-up attempt for this applicant. If candidate does not respond or refuses, agency rules state this record must be closed as <span className="font-bold text-red-700">RED_CLOSED</span>.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Contact Method</label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Call">Phone Call</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="In-Person">In-Person Visit</option>
                <option value="Email">Email</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Call Result</label>
              <select
                value={result}
                onChange={e => {
                  setResult(e.target.value);
                  if (e.target.value === 'Not Interested' || e.target.value === 'Wrong Number') {
                    setDoesNotWantToProceed(true);
                  }
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Interested">Interested / Willing to proceed</option>
                <option value="Will Come to Office">Will Come to Office</option>
                <option value="Asked for Callback">Asked for Callback</option>
                <option value="No Answer">No Answer / Ringing</option>
                <option value="Busy">Busy / Switched Off</option>
                <option value="Not Interested">Not Interested / Refused</option>
                <option value="Wrong Number">Wrong Number</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Contacted By Staff</label>
            <input
              type="text"
              value={contactedBy}
              onChange={e => setContactedBy(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500"
              placeholder="Staff Name or ID"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Conversation Remarks & Details</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
              placeholder="Summarize discussion, applicant conditions, passport status, family consent..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Next Action</label>
              <input
                type="text"
                value={nextAction}
                onChange={e => setNextAction(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. Schedule Embassy"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Next Follow-up Date</label>
              <input
                type="date"
                value={nextDate}
                onChange={e => setNextDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Red Closure Rule Checkbox */}
          <div className="pt-2 border-t border-slate-200">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={doesNotWantToProceed}
                onChange={e => setDoesNotWantToProceed(e.target.checked)}
                className="mt-0.5 rounded text-red-600 focus:ring-red-500"
              />
              <span className="text-xs font-bold text-red-700">
                Mark applicant as RED_CLOSED (File Terminated / Dropped Out)
              </span>
            </label>

            {doesNotWantToProceed && (
              <div className="mt-2.5 p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                <label className="block text-[11px] font-bold uppercase text-red-800">
                  Select Reason for Closing File:
                </label>
                <select
                  value={closedReason}
                  onChange={e => setClosedReason(e.target.value)}
                  className="w-full bg-white border border-red-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-red-500 font-medium"
                >
                  {closureReasons.map((r, i) => (
                    <option key={i} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer ${
                doesNotWantToProceed ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              {doesNotWantToProceed ? 'Confirm RED Closure' : `Save Follow-up 0${nextNum}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
