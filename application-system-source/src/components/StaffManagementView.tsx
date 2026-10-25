import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  Plus,
  Phone,
  CheckCircle2,
  XCircle,
  UserCheck
} from 'lucide-react';
import { Staff } from '../types';

interface Props {
  showNotification: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const StaffManagementView: React.FC<Props> = ({ showNotification }) => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/applicants'); // Fetching main state
      const json = await res.json();
      if (json.applicants) {
        // fetch staff from settings endpoint or db Store
      }
    } catch (err) {
      console.error('Failed to load staff list', err);
    } finally {
      // Seed default staff display
      setStaffList([
        { staff_id: 'S-01', name: 'Althaf Hussain', telephone: '+94771234567', role: 'Administrator', active: true },
        { staff_id: 'S-02', name: 'Fathima Nazia', telephone: '+94777654321', role: 'Registration Staff', active: true },
        { staff_id: 'S-03', name: 'Rizwan Ahmed', telephone: '+94779988776', role: 'Embassy Staff', active: true },
        { staff_id: 'S-04', name: 'Mohamed Shiyam', telephone: '+94772233445', role: 'Departure/Ticket Staff', active: true }
      ]);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-md flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono bg-emerald-400 text-slate-950">
              STAFF DIRECTORY & RBAC
            </span>
            <span className="text-xs text-slate-300">Master Prompt V3 Module</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-1.5">
            Staff Management & Operational Roles
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Manage authorized staff members assigned to registration, follow-up contact handling, embassy documentation, and departure ticketing.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
            <tr>
              <th className="p-3.5 pl-4 font-mono">Staff ID</th>
              <th className="p-3.5">Full Name</th>
              <th className="p-3.5">Telephone Contact</th>
              <th className="p-3.5">Assigned Operational Role</th>
              <th className="p-3.5 text-center">Account Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {staffList.map((member) => (
              <tr key={member.staff_id} className="hover:bg-slate-50/80 transition">
                <td className="p-3.5 pl-4 font-mono font-bold text-slate-900">{member.staff_id}</td>
                <td className="p-3.5 font-bold text-slate-900">{member.name}</td>
                <td className="p-3.5 font-mono text-slate-700">{member.telephone}</td>
                <td className="p-3.5 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      member.role === 'Administrator'
                        ? 'bg-purple-100 text-purple-800'
                        : member.role === 'Registration Staff'
                        ? 'bg-blue-100 text-blue-800'
                        : member.role === 'Embassy Staff'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    {member.role}
                  </span>
                </td>
                <td className="p-3.5 text-center">
                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                    <CheckCircle2 className="w-3 h-3" />
                    Active
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
