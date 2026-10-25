import React from 'react';
import { RefreshCw, Search, ShieldCheck, Mail, Phone, ExternalLink, Globe, Sparkles } from 'lucide-react';
import { SyncLog } from '../types';

interface Props {
  syncing: boolean;
  onSync: () => void;
  lastSync: SyncLog | null;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  activeTab: string;
  onTabChange: (tab: any) => void;
  applicantCount: number;
}

export const SyncHeader: React.FC<Props> = ({
  syncing,
  onSync,
  lastSync,
  searchTerm,
  onSearchChange,
  activeTab,
  onTabChange,
  applicantCount
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 text-white shadow-lg transition-all no-print">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand & Agency Identification */}
        <div className="flex items-center gap-3.5">
          <div className="relative group cursor-pointer" onClick={() => onTabChange('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-slate-900 flex items-center justify-center font-black text-white text-base tracking-wider shadow-md shadow-emerald-950/40 border border-emerald-400/30 group-hover:scale-105 transition-transform duration-200">
              TA
            </div>
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl blur-xs opacity-0 group-hover:opacity-40 transition-opacity -z-10"></div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white leading-none">
                TRANS ARABIAN
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded-md">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> SLBFE 1542
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
              <span>Recruitment Management</span>
              <span className="text-slate-600">·</span>
              <span className="hidden md:inline text-slate-300">Colombo, Sri Lanka</span>
              <span className="hidden md:inline text-slate-600">·</span>
              <span className="text-slate-300 font-medium">transarabianexcel@gmail.com</span>
            </div>
          </div>
        </div>

        {/* Universal Search Bar */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative group">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-emerald-400 transition-colors" />
            <input
              type="text"
              placeholder="Search candidate name, passport, phone, SE#, trade..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 focus:border-emerald-500 text-slate-100 placeholder-slate-400 pl-10 pr-12 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-700/60 border border-slate-600/50 rounded">
                ⌘K
              </kbd>
            </div>
          </div>
        </div>

        {/* Live Sync Status & Trigger Button */}
        <div className="flex items-center gap-3">
          {/* Live Sync Status Beacon */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-800/60 border border-slate-700/60 px-3 py-1.5 rounded-xl text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-300 text-[11px] font-medium">
              {lastSync
                ? `Live · Synced ${new Date(lastSync.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Google Sheet Connected'}
            </span>
          </div>

          {/* Sync Trigger Button */}
          <button
            onClick={onSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md shadow-emerald-950/40 border border-emerald-400/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync Live Sheet'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
