import React from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  PhoneCall,
  BookOpen,
  CalendarCheck,
  CheckSquare,
  PlaneTakeoff,
  Sparkles,
  Settings,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  Plane,
  UploadCloud,
  Files,
  Globe2
} from 'lucide-react';
import { DashboardStats } from '../types';

interface Props {
  activeTab: string;
  onTabChange: (tab: any) => void;
  applicantCount: number;
  dashboardStats: DashboardStats | null;
  onOpenExcelHub: () => void;
}

export const Sidebar: React.FC<Props> = ({
  activeTab,
  onTabChange,
  applicantCount,
  dashboardStats,
  onOpenExcelHub
}) => {
  // Main recruitment & statutory operational sections in strict requested sequence
  const mainSections = [
    {
      id: 'followup_contacts',
      label: 'Follow-Up / Initial Contact',
      icon: PhoneCall,
      badge: 'FRONT DOOR',
      isFrontDoor: true,
      desc: 'Inquiries, outreach & 3-strike pipeline'
    },
    {
      id: 'dashboard',
      label: 'Executive Dashboard',
      icon: LayoutDashboard,
      badge: null,
      desc: 'Operational KPI matrix'
    },
    {
      id: 'applicants',
      label: 'Master Registry',
      icon: Users,
      badge: applicantCount,
      desc: 'Register Form, Gender Registers (Male/Female) & Pending Table'
    },
    {
      id: 'application_creation',
      label: 'Application Creation',
      icon: Files,
      badge: 'CV',
      desc: 'Bilingual CV, work permit forms & batch exports'
    },
    {
      id: 'evisa',
      label: 'E-Visa Application',
      icon: Globe2,
      badge: 'DRAFT',
      desc: 'Visa schematics, reviewed OCR & code references'
    },
    {
      id: 'embassy_pending',
      label: 'Embassy Pending',
      icon: ShieldCheck,
      badge: dashboardStats?.embassy.pending,
      desc: 'SE / E numbers & embassy applications'
    },
    {
      id: 'english',
      label: 'English Testing',
      icon: BookOpen,
      badge: null,
      desc: 'Spoken attempts, ratings & evaluator logs'
    },
    {
      id: 'documents',
      label: 'Embassy documents checklist',
      icon: CheckSquare,
      badge: null,
      desc: 'Embassy mandatory clearance requirements'
    },
    {
      id: 'embassy',
      label: 'Embassy Interviews',
      icon: CalendarCheck,
      badge: dashboardStats?.embassy.pending,
      desc: 'Interview appointments & biometrics'
    },
    {
      id: 'departure_pending',
      label: 'Departure Pending',
      icon: Plane,
      badge: dashboardStats?.departure.pending,
      desc: 'Visa validity & sub-companies'
    },
    {
      id: 'departure',
      label: 'Departures & Flights',
      icon: PlaneTakeoff,
      badge: dashboardStats?.departure.ticketsIssued || dashboardStats?.departure.pending,
      desc: 'Flight Departures & Ticketing Master Schedule'
    },
    {
      id: 'all_master',
      label: 'All Master Records',
      icon: FileSpreadsheet,
      badge: applicantCount,
      desc: '360° matrix with all Excel & Google fields'
    },
    {
      id: 'reports',
      label: 'Reports & Analytics',
      icon: Download,
      badge: null,
      desc: 'Statutory SLBFE returns & printouts'
    }
  ];

  const systemItems = [
    { id: 'calendar_timeline', label: 'Calendar & Timeline Engine', icon: CalendarCheck, badge: null },
    { id: 'staff', label: 'Staff Management', icon: Users, badge: null },
    { id: 'audit_logs', label: 'Activity Audit Log', icon: FileText, badge: null },
    { id: 'settings', label: 'System Configuration', icon: Settings, badge: null },
    { id: 'ai_assistant', label: 'AI Copilot Workspace', icon: Sparkles, badge: 'AI', isAI: true }
  ];

  return (
    <aside className="w-full bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col gap-6">
      {/* 1. Main Recruitment & Operational Sections */}
      <div>
        <div className="flex items-center justify-between px-2.5 mb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Agency Operations
          </span>
          <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
            MAIN SECTIONS
          </span>
        </div>

        <div className="space-y-1">
          {mainSections.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isActive
                        ? (item as any).isAI
                          ? 'bg-purple-600 text-white'
                          : 'bg-emerald-500 text-white'
                        : (item as any).isAI
                        ? 'bg-purple-50 text-purple-600 group-hover:bg-purple-100'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge !== null && item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-md shrink-0 ${
                      isActive
                        ? (item as any).isAI
                          ? 'bg-purple-950 text-purple-300'
                          : 'bg-slate-800 text-emerald-400'
                        : (item as any).isAI
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. System Intelligence */}
      <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2.5 mb-2">
          System Administration
        </span>
        <div className="space-y-1">
          {systemItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                  isActive
                    ? item.isAI
                      ? 'bg-gradient-to-r from-purple-900 to-indigo-900 text-white shadow-md'
                      : 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isActive
                        ? item.isAI
                          ? 'bg-purple-500 text-white'
                          : 'bg-emerald-500 text-white'
                        : item.isAI
                        ? 'bg-purple-50 text-purple-600 group-hover:bg-purple-100'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 shrink-0">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Quick Excel Hub Action */}
      <div className="pt-2 border-t border-slate-100">
        <button
          onClick={onOpenExcelHub}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition cursor-pointer active:scale-98"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>Excel Master Hub</span>
        </button>
      </div>
    </aside>
  );
};
