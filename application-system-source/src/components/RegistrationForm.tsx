import React, { useState } from 'react';
import { Camera, Plus, Trash2, Printer, Save, CheckCircle, AlertTriangle } from 'lucide-react';
import { Staff } from '../types';

interface Props {
  staffList: Staff[];
  onSuccess: () => void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
  onOpenBlankPrint: () => void;
}

export const RegistrationForm: React.FC<Props> = ({
  staffList,
  onSuccess,
  showNotification,
  onOpenBlankPrint
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [profile, setProfile] = useState({
    full_name: '',
    surname: '',
    other_name: '',
    nic_number: '',
    gender: 'Male' as 'Male' | 'Female',
    date_of_birth: '',
    age: '',
    religion: 'Islam',
    nationality: 'Sri Lankan',
    civil_status: 'Single',
    height: '5 ft 7 in',
    weight: '68 kg',
    address: '',
    living_place: 'Colombo',
    mobile_number: '',
    telephone_home: '',
    alternate_phone: '',
    email: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: 'Brother',
    preferred_job_category: 'Kitchen Helper',
    english_status: 'Not Checked',
    registration_source: 'Office Walk-in',
    current_status: 'GREEN_REGISTERED' as any,
    responsible_staff_id: ''
  });

  const [passport, setPassport] = useState({
    passport_number: '',
    place_of_birth: 'Colombo',
    date_of_issue: '',
    date_of_expiry: '',
    passport_status: 'With Agency' as any,
    physical_rack_location: 'Main Vault Shelf A-1',
    remarks: 'Original Passport submitted'
  });

  const [education, setEducation] = useState({
    education_qualification: 'O/L Passed',
    professional_qualification: 'Vocational Training',
    languages: ['Sinhala', 'English'],
    english_status: 'Not Checked',
    arabic_status: 'None',
    driving_license_number: '',
    driving_license_type: 'None'
  });

  const [experiences, setExperiences] = useState<
    Array<{
      from_date: string;
      to_date: string;
      company_place: string;
      position: string;
      duration: string;
      country: string;
      remarks: string;
    }>
  >([
    { from_date: '2022', to_date: '2024', company_place: 'Hilton Hotel', position: 'Assistant Cook', duration: '2 Years', country: 'Sri Lanka', remarks: 'Good conduct' }
  ]);

  // Handle Photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedPhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dob = e.target.value;
    let calculatedAge = '';
    if (dob) {
      const birthYear = new Date(dob).getFullYear();
      const currentYear = new Date().getFullYear();
      calculatedAge = String(Math.max(18, currentYear - birthYear));
    }
    setProfile({ ...profile, date_of_birth: dob, age: calculatedAge });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.full_name) {
      showNotification('error', 'Please enter candidate full name as shown on passport.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        profile: {
          ...profile,
          applicant_photo: selectedPhoto
        },
        passport,
        education: {
          ...education
        },
        experiences: experiences.filter((r) => r.position.trim() !== '')
      };

      const res = await fetch('/api/applicants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showNotification('success', `Candidate successfully registered! Master ID: ${data.applicantId}`);
        onSuccess();
      } else if (res.status === 409) {
        showNotification(
          'error',
          `Duplicate Passport Number detected! Candidate is already registered (${data.existingApplicantName}).`
        );
      } else {
        showNotification('error', data.error || 'Failed to register applicant');
      }
    } catch (err: any) {
      showNotification('error', `Connection error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
      {/* Form Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-200 gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
            TRANS ARABIAN FOREIGN EMPLOYMENT AGENCY
          </span>
          <h2 className="text-xl font-bold text-slate-900">
            Official Candidate Registration & Bio-Data Form
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete statutory registration for overseas employment placement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenBlankPrint}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-300 transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-700" /> Print Official Form
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* Section 1: Candidate Identity & Photo */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          <div className="md:col-span-9 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Full Name (Exactly as in Passport) *
              </label>
              <input
                type="text"
                required
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value.toUpperCase() })}
                placeholder="e.g. MOHAMED RIZWAN MOHAMED ASLAM"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 uppercase focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Surname / Initials
              </label>
              <input
                type="text"
                value={profile.surname}
                onChange={(e) => setProfile({ ...profile, surname: e.target.value.toUpperCase() })}
                placeholder="e.g. MOHAMED"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs uppercase"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                National ID (NIC) Number
              </label>
              <input
                type="text"
                value={profile.nic_number}
                onChange={(e) => setProfile({ ...profile, nic_number: e.target.value.toUpperCase() })}
                placeholder="e.g. 199423401923"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Gender *
              </label>
              <select
                value={profile.gender}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Date of Birth *
              </label>
              <input
                type="date"
                required
                value={profile.date_of_birth}
                onChange={handleDobChange}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Age (Years)
              </label>
              <input
                type="number"
                value={profile.age}
                onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                placeholder="Auto-calculated"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Religion
              </label>
              <select
                value={profile.religion}
                onChange={(e) => setProfile({ ...profile, religion: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
              >
                <option value="Islam">Islam</option>
                <option value="Buddhist">Buddhist</option>
                <option value="Hindu">Hindu</option>
                <option value="Christian">Christian</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Civil Status
              </label>
              <select
                value={profile.civil_status}
                onChange={(e) => setProfile({ ...profile, civil_status: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
              >
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Target Trade / Job Category *
              </label>
              <input
                type="text"
                required
                value={profile.preferred_job_category}
                onChange={(e) => setProfile({ ...profile, preferred_job_category: e.target.value })}
                placeholder="e.g. Kitchen Helper / Cook / Mason / Heavy Driver"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold uppercase text-emerald-800"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                District / Living Place
              </label>
              <input
                type="text"
                value={profile.living_place}
                onChange={(e) => setProfile({ ...profile, living_place: e.target.value })}
                placeholder="e.g. Colombo, Kandy, Galle, Batticaloa"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>
          </div>

          {/* Photo Slot */}
          <div className="md:col-span-3 flex flex-col items-center">
            <div className="w-32 h-40 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center p-1 overflow-hidden relative group">
              {selectedPhoto ? (
                <img src={selectedPhoto} alt="Photo" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <div className="text-center p-2 text-slate-400">
                  <Camera className="w-7 h-7 mx-auto mb-1 text-slate-300" />
                  <span className="text-[10px] font-medium block">AFFIX PASSPORT SIZE PHOTO</span>
                </div>
              )}
            </div>
            <input type="file" id="applicant-reg-photo" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            <label
              htmlFor="applicant-reg-photo"
              className="mt-2 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-300 cursor-pointer"
            >
              Upload Photo
            </label>
          </div>
        </div>

        {/* Section 2: Passport Details */}
        <div className="pt-4 border-t border-slate-200">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Section 2: Passport Particulars & Physical Custody
            </h4>
            <span className="text-[10px] text-slate-400">Check duplicate on submit</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Passport Number *
              </label>
              <input
                type="text"
                required
                value={passport.passport_number}
                onChange={(e) => setPassport({ ...passport, passport_number: e.target.value.toUpperCase().trim() })}
                placeholder="e.g. N11301688"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 uppercase"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Place of Issue
              </label>
              <input
                type="text"
                value={passport.place_of_birth}
                onChange={(e) => setPassport({ ...passport, place_of_birth: e.target.value })}
                placeholder="Colombo"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Date of Issue
              </label>
              <input
                type="date"
                value={passport.date_of_issue}
                onChange={(e) => setPassport({ ...passport, date_of_issue: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Date of Expiry *
              </label>
              <input
                type="date"
                required
                value={passport.date_of_expiry}
                onChange={(e) => setPassport({ ...passport, date_of_expiry: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-emerald-800"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Contact & Emergency Information */}
        <div className="pt-4 border-t border-slate-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
            Section 3: Contact Details & Permanent Residence
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Primary Mobile Phone *
              </label>
              <input
                type="tel"
                required
                value={profile.mobile_number}
                onChange={(e) => setProfile({ ...profile, mobile_number: e.target.value })}
                placeholder="+94 77 XXXXXXX"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                WhatsApp / Alternate Phone
              </label>
              <input
                type="tel"
                value={profile.alternate_phone}
                onChange={(e) => setProfile({ ...profile, alternate_phone: e.target.value })}
                placeholder="+94 71 XXXXXXX"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Applicant Email
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="applicant@gmail.com"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Permanent Residence Address
              </label>
              <input
                type="text"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="No, Street Name, Town, Sri Lanka"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Qualifications & Languages */}
        <div className="pt-4 border-t border-slate-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
            Section 4: Qualifications & Language Competency
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                School Education
              </label>
              <select
                value={education.education_qualification}
                onChange={(e) => setEducation({ ...education, education_qualification: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium"
              >
                <option value="Below O/L">Below O/L</option>
                <option value="O/L Passed">O/L Passed</option>
                <option value="A/L Passed">A/L Passed</option>
                <option value="Diploma">Diploma / NVQ 4</option>
                <option value="Degree">Degree / Higher</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                English Proficiency Level
              </label>
              <select
                value={profile.english_status}
                onChange={(e) => setProfile({ ...profile, english_status: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
              >
                <option value="Not Checked">Not Checked</option>
                <option value="Excellent">Excellent (Fluent)</option>
                <option value="Good">Good (Conversational)</option>
                <option value="Average">Average (Working)</option>
                <option value="Basic">Basic (Elementary)</option>
                <option value="Poor">Poor</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Arabic Speaking Level
              </label>
              <select
                value={education.arabic_status}
                onChange={(e) => setEducation({ ...education, arabic_status: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
              >
                <option value="None">None</option>
                <option value="Basic">Basic</option>
                <option value="Working">Working / Fluent</option>
                <option value="Fluent">Fluent (Gulf Returnee)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Driving License Type
              </label>
              <select
                value={education.driving_license_type}
                onChange={(e) => setEducation({ ...education, driving_license_type: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
              >
                <option value="None">None</option>
                <option value="Light Vehicle">Light Vehicle (Car/Van)</option>
                <option value="Heavy Vehicle">Heavy Vehicle / Bus / Lorry</option>
                <option value="Forklift">Forklift Operator</option>
                <option value="Motorcycle">Motorcycle</option>
                <option value="Gulf License">Gulf Valid License (KSA/UAE/Qatar)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 5: Employment & Work Experience */}
        <div className="pt-4 border-t border-slate-200">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Section 5: Local & Overseas Work Experience
            </h4>
            <button
              type="button"
              onClick={() =>
                setExperiences([
                  ...experiences,
                  { from_date: '', to_date: '', company_place: '', position: '', duration: '', country: '', remarks: '' }
                ])
              }
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Experience Row
            </button>
          </div>

          <div className="space-y-2">
            {experiences.map((exp, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-5 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 items-center">
                <input
                  type="text"
                  placeholder="Position (e.g. Cook / Welder)"
                  value={exp.position}
                  onChange={(e) => {
                    const next = [...experiences];
                    next[idx].position = e.target.value;
                    setExperiences(next);
                  }}
                  className="bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium"
                />
                <input
                  type="text"
                  placeholder="Company / Establishment"
                  value={exp.company_place}
                  onChange={(e) => {
                    const next = [...experiences];
                    next[idx].company_place = e.target.value;
                    setExperiences(next);
                  }}
                  className="bg-white border border-slate-300 rounded-lg p-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="Country (e.g. Saudi Arabia)"
                  value={exp.country}
                  onChange={(e) => {
                    const next = [...experiences];
                    next[idx].country = e.target.value;
                    setExperiences(next);
                  }}
                  className="bg-white border border-slate-300 rounded-lg p-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="Duration (e.g. 2 Years)"
                  value={exp.duration}
                  onChange={(e) => {
                    const next = [...experiences];
                    next[idx].duration = e.target.value;
                    setExperiences(next);
                  }}
                  className="bg-white border border-slate-300 rounded-lg p-2 text-xs"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Remarks"
                    value={exp.remarks}
                    onChange={(e) => {
                      const next = [...experiences];
                      next[idx].remarks = e.target.value;
                      setExperiences(next);
                    }}
                    className="flex-1 bg-white border border-slate-300 rounded-lg p-2 text-xs"
                  />
                  {experiences.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setExperiences(experiences.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-8 py-3 rounded-xl shadow-lg transition disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Complete Registration & Issue File ID</span>
          </button>
        </div>
      </form>
    </div>
  );
};
