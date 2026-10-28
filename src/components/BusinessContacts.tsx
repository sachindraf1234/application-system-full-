import React, { useState, useEffect } from 'react';
import {
  Building,
  Plus,
  Search,
  Phone,
  Mail,
  Trash2,
  Briefcase,
  CheckCircle,
  Tag
} from 'lucide-react';
import { BusinessContact } from '../types';

interface Props {
  showNotification: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const BusinessContactsView: React.FC<Props> = ({ showNotification }) => {
  const [contacts, setContacts] = useState<BusinessContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [form, setForm] = useState({
    company_name: '',
    category: 'COCO CHIPS BUYERS',
    contact_person: '',
    phone: '',
    email_or_website: '',
    remarks: ''
  });

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/business-contacts');
      const json = await res.json();
      if (json.success) {
        setContacts(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch business contacts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name || !form.contact_person) {
      showNotification('error', 'Company Name and Contact Person are required.');
      return;
    }

    try {
      const res = await fetch('/api/v1/business-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (json.success) {
        showNotification('success', `Added business contact ${json.data.company_name}`);
        setShowAddModal(false);
        setForm({
          company_name: '',
          category: 'COCO CHIPS BUYERS',
          contact_person: '',
          phone: '',
          email_or_website: '',
          remarks: ''
        });
        fetchContacts();
      } else {
        showNotification('error', json.error || 'Failed to create business contact');
      }
    } catch (err: any) {
      showNotification('error', 'Error creating contact: ' + err.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove business contact ${name}?`)) return;
    try {
      const res = await fetch(`/api/v1/business-contacts/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showNotification('success', `Deleted ${name}`);
        fetchContacts();
      }
    } catch (err) {
      showNotification('error', 'Failed to delete contact');
    }
  };

  const filtered = contacts.filter((c) =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_person.toLowerCase().includes(search.toLowerCase()) ||
    (c.category && c.category.toLowerCase().includes(search.toLowerCase())) ||
    c.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono bg-cyan-400 text-slate-950">
              NON-APPLICANT DIRECTORY
            </span>
            <span className="text-xs text-slate-300">Master Prompt V3 Module</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-1.5">
            Business & Commercial Contacts Directory
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Separate database for commercial buyers (e.g. COCO CHIPS BUYERS), international employer reps, and trade suppliers. Completely isolated from applicant data.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow cursor-pointer active:scale-98 shrink-0"
        >
          <Plus className="w-4 h-4 text-emerald-300" />
          <span>+ Add Business Contact</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-slate-500" />
          <span>Showing {filtered.length} commercial directory records</span>
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search company, category, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-1.5 text-xs rounded-xl focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Grid of Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-slate-400 text-xs">
            Loading business contacts...
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full p-8 text-center text-slate-400 text-xs">
            No business contacts matching filter.
          </div>
        ) : (
          filtered.map((contact) => (
            <div
              key={contact.id}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-50 text-cyan-800 border border-cyan-200">
                    {contact.category || 'COCO CHIPS BUYERS'}
                  </span>
                  <button
                    onClick={() => handleDelete(contact.id, contact.company_name)}
                    className="text-slate-300 hover:text-rose-600 transition cursor-pointer p-1"
                    title="Remove Contact"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h3 className="font-bold text-sm text-slate-900 leading-snug">
                  {contact.company_name}
                </h3>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-800">{contact.contact_person}</span>
                </div>
                {contact.phone && (
                  <div className="flex items-center gap-2 font-mono">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                {contact.email_or_website && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate text-slate-700">{contact.email_or_website}</span>
                  </div>
                )}
                {contact.remarks && (
                  <p className="text-[11px] text-slate-500 italic mt-1 pt-1 border-t border-slate-50">
                    "{contact.remarks}"
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                Add New Business Contact
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Company / Organization Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. COCO CHIPS BUYERS - GLOBAL AGRO"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. COCO CHIPS BUYERS"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Contact Person *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mr. David Harrison"
                    value={form.contact_person}
                    onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +442079460912"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email / Website</label>
                  <input
                    type="text"
                    placeholder="e.g. info@globalagro.co.uk"
                    value={form.email_or_website}
                    onChange={(e) => setForm({ ...form, email_or_website: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Remarks / Business Context</label>
                <textarea
                  rows={2}
                  placeholder="Notes regarding contracts, substrate specifications, commercial terms..."
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition cursor-pointer shadow-xs active:scale-98"
                >
                  Save Business Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
