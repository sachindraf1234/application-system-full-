import React, { useState, useEffect } from 'react';
import {
  ApplicantOverview,
  DashboardStats,
  ApplicantFullDetails,
  SystemSettings,
  Staff,
  SyncLog,
  ExcelSectionType
} from './types';
import { SyncHeader } from './components/SyncHeader';
import { Sidebar } from './components/Sidebar';
import { RegistrationForm } from './components/RegistrationForm';
import { MasterRegistryView } from './components/MasterRegistryView';
import { AllMasterRecordsView } from './components/AllMasterRecordsView';
import { EnglishTestingView } from './components/EnglishTestingView';
import { DeparturesFlightsView } from './components/DeparturesFlightsView';
import { EmbassyPendingView } from './components/EmbassyPendingView';
import { EmbassyInterviewsView } from './components/EmbassyInterviewsView';
import { TenPointChecklistView } from './components/TenPointChecklistView';
import { DeparturePendingView } from './components/DeparturePendingView';
import { DocumentUploadExtractor } from './components/DocumentUploadExtractor';
import { TransArabianPrintForm } from './components/TransArabianPrintForm';
import { ExcelHubModal } from './components/ExcelHubModal';
import { FollowUpModal } from './components/FollowUpModal';
import { FollowUpBoard } from './components/FollowUpBoard';
import { MasterProfileModal } from './components/MasterProfileModal';
import {
  ExecutiveDashboardView,
  SettingsWorkspaceView
} from './components/SubDashboards';
import { AICopilot } from './components/AICopilot';
import { FollowUpContactBoard } from './components/FollowUpContactBoard';
import { ReportsView } from './components/ReportsView';
import { TimelineCalendarView } from './components/TimelineCalendar';
import { StaffManagementView } from './components/StaffManagementView';
import { AuditLogView } from './components/AuditLogView';
import { SystemSettingsView } from './components/SystemSettingsView';
import { CheckCircle2, AlertCircle, Info, Phone, AlertTriangle } from 'lucide-react';

const CVBuilder = React.lazy(() => import('./CVBuilder'));
const EvisaWorkspace = React.lazy(() => import('./EvisaWorkspace'));

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('followup_contacts');
  const [returnTab, setReturnTab] = useState('applicants');
  const navigateTab = (tab: string) => { if (tab === 'application_creation' || tab === 'evisa') setReturnTab(activeTab); setActiveTab(tab); };
  const [publicDemo, setPublicDemo] = useState(false);
  useEffect(() => { fetch('/api/demo-status').then(r => r.json()).then(data => setPublicDemo(data.publicDemo === true)).catch(() => {}); }, []);

  const [activeExcelSection, setActiveExcelSection] = useState<ExcelSectionType>('all_master');

  // Master Data States
  const [applicants, setApplicants] = useState<ApplicantOverview[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modals & Overlays
  const [detailedApplicant, setDetailedApplicant] = useState<ApplicantFullDetails | null>(null);
  const [selectedForPrint, setSelectedForPrint] = useState<ApplicantFullDetails | null>(null);
  const [selectedForFollowUp, setSelectedForFollowUp] = useState<ApplicantOverview | null>(null);
  const [showExcelHubModal, setShowExcelHubModal] = useState(false);

  // Status & Notification state
  const [isLoading, setIsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Initial Load on mount and refresh
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [appRes, statsRes, setRes, staffRes, syncRes] = await Promise.all([
        fetch('/api/applicants'),
        fetch('/api/dashboard/stats'),
        fetch('/api/settings'),
        fetch('/api/staff'),
        fetch('/api/sync/logs')
      ]);

      if (appRes.ok) setApplicants(await appRes.json());
      if (statsRes.ok) setDashboardStats(await statsRes.json());
      if (setRes.ok) setSettings(await setRes.json());
      if (staffRes.ok) setStaff(await staffRes.json());
      if (syncRes.ok) setSyncHistory(await syncRes.json());
    } catch (err) {
      console.error('Failed to load database records.', err);
      showNotification('error', 'Failed to retrieve database connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error' | 'info', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => {
      setActionMessage(null);
    }, 5000);
  };

  // Google Sheets Apps Script Live Synchronization
  const triggerGoogleSync = async () => {
    setSyncing(true);
    showNotification('info', 'Connecting to Google Apps Script endpoint...');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showNotification('success', `Live Sync Complete! Created: ${data.results.inserted}, Updated: ${data.results.updated}`);
        await fetchInitialData();
      } else {
        showNotification('info', `${data.results?.errors || 'Synchronization processed with preserved local data.'}`);
        await fetchInitialData();
      }
    } catch (err: any) {
      showNotification('error', 'Google Apps Script endpoint is temporarily unreachable.');
    } finally {
      setSyncing(false);
    }
  };

  // Profile Lookup
  const loadApplicantProfile = async (id: string) => {
    try {
      const res = await fetch(`/api/applicants/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDetailedApplicant(data);
      } else {
        showNotification('error', 'Failed to load applicant profile.');
      }
    } catch (err) {
      showNotification('error', 'Database connectivity error.');
    }
  };

  // Print Form Trigger
  const openPrintForApplicant = async (id: string) => {
    try {
      const res = await fetch(`/api/applicants/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedForPrint(data);
      } else {
        showNotification('error', 'Failed to retrieve applicant data for printing.');
      }
    } catch (err) {
      showNotification('error', 'Database connectivity error.');
    }
  };

  // Delete Candidate
  const handleDeleteApplicant = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to permanently delete applicant ${name} (${id}) from the database?`)) {
      try {
        const res = await fetch(`/api/applicants/${id}`, { method: 'DELETE' });
        if (res.ok) {
          showNotification('success', `Applicant ${name} deleted successfully.`);
          await fetchInitialData();
        } else {
          showNotification('error', 'Failed to delete applicant.');
        }
      } catch (err: any) {
        showNotification('error', err.message);
      }
    }
  };

  // Reopen Red Closed Applicant
  const handleReopenApplicant = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/applicants/${id}/reopen`, { method: 'POST' });
      if (res.ok) {
        showNotification('success', `Candidate ${name} re-opened to active Follow-ups.`);
        await fetchInitialData();
      } else {
        showNotification('error', 'Failed to re-open candidate file.');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Save Settings
  const handleSaveSettings = async (updatedSettings: SystemSettings) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      if (res.ok) {
        setSettings(await res.json());
        showNotification('success', 'System configuration updated successfully.');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800 antialiased font-sans">
      {publicDemo && <div role="status" className="bg-amber-400 px-4 py-2 text-center text-xs font-bold text-amber-950">PUBLIC SAMPLE-DATA DEMO · Do not enter real candidate or personal information. Data is temporary and visible to anyone with this link.</div>}
      {/* 1. SYNC HEADER (PHASE 3) */}
      <SyncHeader
        syncing={syncing}
        onSync={triggerGoogleSync}
        lastSync={dashboardStats?.syncStatus || (syncHistory.length > 0 ? syncHistory[0] : null)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        activeTab={activeTab}
        onTabChange={navigateTab}
        applicantCount={applicants.length}
      />

      {/* 2. TOAST NOTIFICATIONS */}
      {actionMessage && (
        <div className="fixed top-16 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-200 no-print">
          <div
            className={`p-3.5 px-4 rounded-xl shadow-2xl flex items-center gap-3 border ${
              actionMessage.type === 'success'
                ? 'bg-emerald-900/90 border-emerald-700 text-emerald-100'
                : actionMessage.type === 'error'
                ? 'bg-red-900/90 border-red-700 text-red-100'
                : 'bg-blue-900/90 border-blue-700 text-blue-100'
            } backdrop-blur-md`}
          >
            {actionMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {actionMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
            {actionMessage.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
            <span className="text-xs font-semibold">{actionMessage.text}</span>
          </div>
        </div>
      )}

      {/* 3. MAIN WORKSPACE CONTAINER */}
      <div className={`max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col gap-6 ${selectedForPrint ? 'no-print' : 'print:p-0 print:m-0 print:max-w-none print:shadow-none'}`}>
        {/* 2-Column Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* SIDEBAR (PHASE 4) */}
          <aside className={`${['application_creation','evisa'].includes(activeTab) ? 'hidden' : 'lg:col-span-3'} no-print`}>
            <Sidebar
              activeTab={activeTab}
              onTabChange={navigateTab}
              applicantCount={applicants.length}
              dashboardStats={dashboardStats}
              onOpenExcelHub={() => setShowExcelHubModal(true)}
            />
          </aside>

          {/* MAIN MODULE DISPLAY (PHASES 5-16) */}
          <main className={`${['application_creation','evisa'].includes(activeTab) ? 'lg:col-span-12' : 'lg:col-span-9'} flex flex-col gap-6`}>
            {/* VIEW 0: PRE-REGISTRATION FOLLOW-UP & INITIAL CONTACTS (MODULE 01 FRONT DOOR) */}
            {activeTab === 'followup_contacts' && (
              <FollowUpContactBoard
                applicants={applicants}
                staffList={staff}
                onRefreshData={fetchInitialData}
                onViewApplicant={loadApplicantProfile}
                showNotification={showNotification}
              />
            )}

            {/* VIEW 1: EXECUTIVE DASHBOARD */}
            {activeTab === 'dashboard' && dashboardStats && (
              <ExecutiveDashboardView stats={dashboardStats} onNavigateTab={setActiveTab} />
            )}

            {/* VIEW 2: MASTER REGISTRY (REGISTER CANDIDATE & REGISTER CANDIDATE RECORDS) */}
            {(activeTab === 'applicants' || activeTab === 'registration') && (
              <MasterRegistryView
                applicants={applicants}
                onViewProfile={loadApplicantProfile}
                onPrintApplicant={openPrintForApplicant}
                onFollowupApplicant={(app) => setSelectedForFollowUp(app)}
                onDeleteApplicant={handleDeleteApplicant}
                onRefreshData={fetchInitialData}
                showNotification={showNotification}
                staffList={staff}
                initialSubSection={activeTab === 'registration' ? 'register_candidate' : 'candidate_records'}
                onNavigateTab={setActiveTab}
              />
            )}

            {activeTab === 'application_creation' && (
              <React.Suspense fallback={<div className="p-8 text-sm text-slate-500">Opening Application Creation…</div>}>
                <CVBuilder applicants={applicants} onBack={() => setActiveTab(returnTab)} />
              </React.Suspense>
            )}

            {activeTab === 'evisa' && (
              <React.Suspense fallback={<div className="p-8 text-sm text-slate-500">Opening E-Visa…</div>}>
                <EvisaWorkspace applicants={applicants} onBack={() => setActiveTab(returnTab)} />
              </React.Suspense>
            )}

            {/* VIEW 5: EMBASSY PENDING (PLACED ABOVE ENGLISH & EMBASSY INTERVIEWS) */}
            {activeTab === 'embassy_pending' && (
              <EmbassyPendingView
                applicants={applicants}
                onViewApplicant={loadApplicantProfile}
                onPrintApplicant={openPrintForApplicant}
                onRefreshData={fetchInitialData}
                showNotification={showNotification}
              />
            )}

            {/* VIEW 6: ENGLISH TESTING (MOVED ABOVE EMBASSY INTERVIEWS) */}
            {activeTab === 'english' && (
              <EnglishTestingView
                applicants={applicants}
                onViewApplicant={loadApplicantProfile}
                onRefreshData={fetchInitialData}
                showNotification={showNotification}
              />
            )}

            {/* VIEW 7: EMBASSY INTERVIEWS WORKSPACE */}
            {activeTab === 'embassy' && (
              <EmbassyInterviewsView
                applicants={applicants}
                onViewApplicant={loadApplicantProfile}
                onPrintApplicant={openPrintForApplicant}
                onRefreshData={fetchInitialData}
                showNotification={showNotification}
              />
            )}

            {/* VIEW 8: 10-POINT CHECKLIST MATRIX */}
            {activeTab === 'documents' && (
              <TenPointChecklistView
                applicants={applicants}
                onViewApplicant={loadApplicantProfile}
                onRefreshData={fetchInitialData}
                showNotification={showNotification}
              />
            )}

            {/* VIEW 9: DEPARTURE PENDING (PLACED ABOVE DEPARTURES & FLIGHTS) */}
            {activeTab === 'departure_pending' && (
              <DeparturePendingView
                applicants={applicants}
                onViewApplicant={loadApplicantProfile}
                onRefreshData={fetchInitialData}
                showNotification={showNotification}
              />
            )}

            {/* VIEW 10: FLIGHT DEPARTURES & TICKETING MASTER SCHEDULE (COMBINED DEPARTURES & TICKETS) */}
            {activeTab === 'departure' && (
              <DeparturesFlightsView
                applicants={applicants}
                onViewApplicant={loadApplicantProfile}
                showNotification={showNotification}
              />
            )}

            {/* VIEW 11: ALL MASTER RECORDS (REPLACING BUSINESS CONTACTS) */}
            {(activeTab === 'all_master' || activeTab === 'business_contacts') && (
              <AllMasterRecordsView
                applicants={applicants}
                staffList={staff}
                onViewProfile={loadApplicantProfile}
                onPrintApplicant={openPrintForApplicant}
                onRefreshData={fetchInitialData}
                showNotification={showNotification}
              />
            )}

            {/* VIEW 10: REPORTS & ANALYTICS */}
            {activeTab === 'reports' && (
              <ReportsView applicants={applicants} showNotification={showNotification} />
            )}

            {/* VIEW 11: CALENDAR & ADJUSTABLE TIMELINE */}
            {activeTab === 'calendar_timeline' && (
              <TimelineCalendarView showNotification={showNotification} />
            )}

            {/* VIEW 12: STAFF DIRECTORY & RBAC ROLES */}
            {activeTab === 'staff' && (
              <StaffManagementView showNotification={showNotification} />
            )}

            {/* VIEW 13: IMMUTABLE AUDIT LOG */}
            {activeTab === 'audit_logs' && (
              <AuditLogView showNotification={showNotification} />
            )}

            {/* VIEW 14: AI RECRUITMENT COPILOT */}
            {activeTab === 'ai_assistant' && (
              <AICopilot applicants={applicants} showNotification={showNotification} />
            )}

            {/* VIEW 15: SYSTEM CONFIGURATION & SETTINGS */}
            {activeTab === 'settings' && settings && (
              <SystemSettingsView
                settings={settings}
                onUpdateSettings={handleSaveSettings}
                showNotification={showNotification}
              />
            )}
          </main>
        </div>
      </div>

      {/* 4. MODALS & POPUPS */}

      {/* Printable A4 Bio-Data Form Modal */}
      {selectedForPrint && (
        <TransArabianPrintForm
          data={selectedForPrint}
          onClose={() => setSelectedForPrint(null)}
        />
      )}

      {/* Excel Hub Modal (XLSX & CSV Generation + Upload) */}
      {showExcelHubModal && (
        <ExcelHubModal
          applicants={applicants}
          onClose={() => setShowExcelHubModal(false)}
          onImportComplete={fetchInitialData}
          showNotification={showNotification}
        />
      )}

      {/* Follow-up Logging Modal with 3-Strike Rule */}
      {selectedForFollowUp && (
        <FollowUpModal
          applicant={selectedForFollowUp}
          currentFollowupCount={1}
          onClose={() => setSelectedForFollowUp(null)}
          onSuccess={fetchInitialData}
          showNotification={showNotification}
        />
      )}

      {/* Master Applicant Profile Modal */}
      {detailedApplicant && (
        <MasterProfileModal
          data={detailedApplicant}
          onClose={() => setDetailedApplicant(null)}
          onRefresh={() => {
            fetchInitialData();
            loadApplicantProfile(detailedApplicant.profile.applicant_id);
          }}
          onOpenPrintForm={() => setSelectedForPrint(detailedApplicant)}
          onOpenFollowupModal={() => {
            const found = applicants.find(
              (a) => a.applicant_id === detailedApplicant.profile.applicant_id
            );
            if (found) setSelectedForFollowUp(found);
          }}
          showNotification={showNotification}
        />
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 border-t border-slate-800 text-xs no-print mt-auto">
        <div className="max-w-[1600px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <span>&copy; 2026 TRANS ARABIAN Tours & Travels • Foreign Employment Agency • All rights reserved.</span>
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveTab('settings')} className="hover:text-white transition">
              Settings & API
            </button>
            <span>•</span>
            <button onClick={() => setShowExcelHubModal(true)} className="hover:text-white transition">
              Excel Hub
            </button>
            <span>•</span>
            <button onClick={() => setActiveTab('ai_assistant')} className="hover:text-white transition">
              AI Copilot
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
