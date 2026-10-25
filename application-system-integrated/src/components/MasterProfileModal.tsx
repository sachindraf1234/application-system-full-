import React from 'react';
import { ApplicantFullDetails } from '../types';
import { OfficialCandidateRegistrationForm } from './OfficialCandidateRegistrationForm';

interface Props {
  data: ApplicantFullDetails;
  onClose: () => void;
  onRefresh: () => void;
  onOpenPrintForm?: () => void;
  onOpenFollowupModal?: () => void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const MasterProfileModal: React.FC<Props> = ({
  data,
  onClose,
  onRefresh,
  showNotification
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-center items-start overflow-y-auto p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto">
      <div className="w-full max-w-5xl my-4 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden print:border-none print:shadow-none print:rounded-none">
        <OfficialCandidateRegistrationForm
          initialData={data}
          isProfileMode={true}
          onClose={onClose}
          onSuccess={() => {
            onRefresh();
          }}
          showNotification={showNotification}
        />
      </div>
    </div>
  );
};
