import React, { useState } from 'react';
import {
  Settings,
  Building2,
  Briefcase,
  Link,
  Shield,
  Save,
  Plus,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { SystemSettings } from '../types';

interface Props {
  settings: SystemSettings;
  onUpdateSettings: (newSettings: SystemSettings) => void;
  showNotification: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const SystemSettingsView: React.FC<Props> = ({
  settings,
  onUpdateSettings,
  showNotification
}) => {
  const [formData, setFormData] = useState<SystemSettings>({ ...settings });
  const [newCompany, setNewCompany] = useState('');
  const [newSubCompany, setNewSubCompany] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const handleAddCompany = () => {
    if (!newCompany.trim()) return;
    if (formData.companies.includes(newCompany.trim())) {
      showNotification('error', 'Company already exists');
      return;
    }
    setFormData({ ...formData, companies: [...formData.companies, newCompany.trim()] });
    setNewCompany('');
  };

  const handleRemoveCompany = (comp: string) => {
    setFormData({ ...formData, companies: formData.companies.filter((c) => c !== comp) });
  };

  const handleAddSubCompany = () => {
    if (!newSubCompany.trim()) return;
    if (formData.sub_companies.includes(newSubCompany.trim())) {
      showNotification('error', 'Sub-company already exists');
      return;
    }
    setFormData({ ...formData, sub_companies: [...formData.sub_companies, newSubCompany.trim()] });
    setNewSubCompany('');
  };

  const handleRemoveSubCompany = (sub: string) => {
    setFormData({ ...formData, sub_companies: formData.sub_companies.filter((s) => s !== sub) });
  };

  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    if (formData.job_categories.includes(newCategory.trim())) {
      showNotification('error', 'Category already exists');
      return;
    }
    setFormData({ ...formData, job_categories: [...formData.job_categories, newCategory.trim()] });
    setNewCategory('');
  };

  const handleRemoveCategory = (cat: string) => {
    setFormData({ ...formData, job_categories: formData.job_categories.filter((c) => c !== cat) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    showNotification('success', 'System configurations saved successfully!');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-md flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono bg-emerald-400 text-slate-950">
              SYSTEM CONFIGURATION
            </span>
            <span className="text-xs text-slate-300">Master Prompt V3 Module</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-1.5">
            TRANS ARABIAN Master Settings & Lookups
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Manage dynamic employer company lists, sub-companies, job trade categories, Google Live Data sync endpoints, and system parameters.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Google Sync Integration Endpoint */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Link className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-base text-slate-900">Google Sheets & Apps Script Sync Endpoint</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Google Apps Script Exec Endpoint URL *</label>
              <input
                type="url"
                required
                value={formData.google_apps_script_endpoint}
                onChange={(e) => setFormData({ ...formData, google_apps_script_endpoint: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-slate-900"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Configured endpoint used for fetching external Google Sheet records during live data sync.
              </p>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Source Google Spreadsheet Link</label>
              <input
                type="url"
                value={formData.google_sheet_url}
                onChange={(e) => setFormData({ ...formData, google_sheet_url: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Main Employer Companies */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-base text-slate-900">Employer Companies ({formData.companies.length})</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. DUNNAREA HOTEL"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold uppercase"
              />
              <button
                type="button"
                onClick={handleAddCompany}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition cursor-pointer"
              >
                + Add Company
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {formData.companies.map((comp) => (
                <div
                  key={comp}
                  className="flex items-center gap-2 bg-slate-100 border border-slate-200/80 font-bold text-slate-800 px-3 py-1.5 rounded-xl text-xs"
                >
                  <span>{comp}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCompany(comp)}
                    className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section 3: Sub Companies */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-base text-slate-900">Sub Companies ({formData.sub_companies.length})</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. CUSCO WELDERS DEPT"
                value={newSubCompany}
                onChange={(e) => setNewSubCompany(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold uppercase"
              />
              <button
                type="button"
                onClick={handleAddSubCompany}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition cursor-pointer"
              >
                + Add Sub-Company
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {formData.sub_companies.map((sub) => (
                <div
                  key={sub}
                  className="flex items-center gap-2 bg-slate-100 border border-slate-200/80 font-bold text-slate-800 px-3 py-1.5 rounded-xl text-xs"
                >
                  <span>{sub}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSubCompany(sub)}
                    className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section 4: Job Trade Categories */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Briefcase className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-base text-slate-900">Job Trade Categories ({formData.job_categories.length})</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Kitchen Helper, Welder, Housekeeping"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition cursor-pointer"
              >
                + Add Category
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {formData.job_categories.map((cat) => (
                <div
                  key={cat}
                  className="flex items-center gap-2 bg-slate-100 border border-slate-200/80 font-bold text-slate-800 px-3 py-1.5 rounded-xl text-xs"
                >
                  <span>{cat}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(cat)}
                    className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Submit Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 py-3 rounded-xl shadow transition cursor-pointer active:scale-98"
          >
            <Save className="w-4 h-4" />
            <span>Save All Configurations</span>
          </button>
        </div>
      </form>
    </div>
  );
};
