import React, { useState, useRef } from 'react';
import { ApplicantOverview } from '../types';
import { Printer, X, FileX, UploadCloud, CheckCircle2, ChevronDown } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  applicant: ApplicantOverview | null;
  onRefreshData?: () => void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const VisaRefusalPdfModal: React.FC<Props> = ({
  isOpen,
  onClose,
  applicant,
  onRefreshData,
  showNotification
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [additionalRemarks, setAdditionalRemarks] = useState<string>(
    "REJECTED BASED ON ART. 27 ALIN. 4 LIT. H FROM OUG 194/2002: DOUBTS REGARDING THE CREDIBILITY OF APPLICANT'S STATEMENTS"
  );
  const [refusalDate, setRefusalDate] = useState<string>('18.09.2026');
  const [refNo, setRefNo] = useState<string>('C42-26-1808');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state from applicant
  React.useEffect(() => {
    if (applicant) {
      const currentReason =
        (applicant as any).refusal_reason ||
        applicant.interview_status ||
        applicant.closed_remarks ||
        "REJECTED BASED ON ART. 27 ALIN. 4 LIT. H FROM OUG 194/2002: DOUBTS REGARDING THE CREDIBILITY OF APPLICANT'S STATEMENTS";

      setSelectedReason(currentReason);
      setAdditionalRemarks(
        currentReason.startsWith('REJECTED BASED ON')
          ? currentReason
          : `REJECTED BASED ON ART. 27 ALIN. 4 LIT. H FROM OUG 194/2002: ${currentReason.toUpperCase()}`
      );
      setRefusalDate(
        (applicant as any).refusal_date
          ? (applicant as any).refusal_date.replace(/-/g, '.')
          : '18.09.2026'
      );
      setRefNo((applicant as any).refusal_ref_no || 'C42-26-1808');
    }
  }, [applicant]);

  if (!isOpen || !applicant) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleSaveRefusal = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/applicants/${applicant.applicant_id}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visa_status: 'Rejected',
          status: additionalRemarks,
          interview_status: additionalRemarks,
          remarks: additionalRemarks,
          refusal_reason: additionalRemarks,
          refusal_date: refusalDate.replace(/\./g, '-'),
          refusal_ref_no: refNo
        })
      });

      if (res.ok) {
        showNotification('success', `Visa refusal details updated for ${applicant.full_name}`);
        onRefreshData?.();
      } else {
        showNotification('error', 'Failed to update refusal details');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const res = await fetch('/api/documents/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: base64,
            mimeType: file.type,
            fileName: file.name,
            sectionContext: 'embassy_refusal'
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          const ext = data.extracted;
          const extractedReason =
            ext.status ||
            ext.rejection_reason ||
            "REJECTED BASED ON ART. 27 ALIN. 4 LIT. H FROM OUG 194/2002: DOUBTS REGARDING THE CREDIBILITY OF APPLICANT'S STATEMENTS";
          setSelectedReason(extractedReason);
          setAdditionalRemarks(extractedReason);
          if (ext.appointment_date) {
            setRefusalDate(ext.appointment_date.replace(/-/g, '.'));
          }
          if (ext.refusal_ref_no) {
            setRefNo(ext.refusal_ref_no);
          }
          showNotification('success', `AI successfully extracted refusal reason from ${file.name}`);
          onRefreshData?.();
        } else {
          showNotification('error', data.error || 'Failed to extract refusal document.');
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      showNotification('error', err.message);
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col my-auto max-h-[96vh]">
        {/* Modal Toolbar - Hidden during print */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <FileX className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                ROMANIAN LONG-STAY VISA REFUSAL FORM
              </h3>
              <p className="text-[11px] text-slate-400">
                Official Consular Refusal notification for: <strong className="text-white">{applicant.full_name}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer border border-slate-700 active:scale-98"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{isUploading ? 'Extracting AI...' : 'Scan / Re-Upload Refusal Form'}</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,image/*"
              className="hidden"
            />
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-98"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Download PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Edit Bar - Hidden when printing */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 print:hidden space-y-2 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold uppercase text-slate-600 block mb-0.5">
                Additional Remarks / Rejection Ground (In Status Field)
              </label>
              <input
                type="text"
                value={additionalRemarks}
                onChange={(e) => setAdditionalRemarks(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-rose-900"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-600 block mb-0.5">
                Reference No.
              </label>
              <input
                type="text"
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase text-slate-600 block mb-0.5">
                  Date
                </label>
                <input
                  type="text"
                  value={refusalDate}
                  onChange={(e) => setRefusalDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold"
                />
              </div>
              <button
                onClick={handleSaveRefusal}
                disabled={isSaving}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer shadow-xs transition"
              >
                {isSaving ? 'Saving...' : 'Apply'}
              </button>
            </div>
          </div>
        </div>

        {/* Printable Paper Canvas - EXACT match of the uploaded 4-page Romanian Long-Stay Visa Refusal Form */}
        <div className="p-8 overflow-y-auto bg-slate-100/70 print:bg-white print:p-0 font-serif text-[11px] leading-[1.35] text-black">
          <div className="max-w-[210mm] mx-auto bg-white p-10 rounded-sm shadow-md border border-slate-300 print:border-none print:shadow-none print:p-0 space-y-12">
            
            {/* ================= PAGE 1 ================= */}
            <div className="min-h-[270mm] flex flex-col justify-between space-y-4 page-break-after">
              <div>
                {/* Official Title */}
                <div className="text-center font-bold text-xs uppercase tracking-tight space-y-0.5 border-b border-black pb-2">
                  <div className="italic font-normal">
                    FORM FOR NOTIFYING REASONS FOR REFUSAL/ANNULMENT/REVOCATION<br />
                    OF A ROMANIAN LONG-STAY VISA¹
                  </div>
                  <div className="italic text-[10px]">
                    FORMULAR PENTRU NOTIFICAREA ŞI MOTIVAREA REFUZULUI/ANULĂRII/REVOCĂRII<br />
                    VIZEI ROMÂNE DE LUNGĂ ŞEDERE²
                  </div>
                </div>

                {/* Header Embassy Details */}
                <div className="pt-3 flex justify-between items-start text-[11px]">
                  <div className="space-y-0.5">
                    <div className="font-bold">
                      Embassy of Romania to The Democratic Socialist Republic of Sri Lanka, Colombo
                    </div>
                    <div className="italic text-[10.5px]">
                      Ambasada României în Republica Socialistă Democrată Sri Lanka, Colombo
                    </div>
                    <div className="pt-1 font-mono text-[11px]">
                      No./ Nr. <span className="font-bold underline">{refNo}</span> Date / Data <span className="font-bold underline">{refusalDate}</span>
                    </div>
                    <div className="italic text-[9.5px] text-slate-700">
                      Personal data controller / Operator de date cu caracter personal
                    </div>
                  </div>

                  {/* Flag & EU Emblem Box */}
                  <div className="flex items-center gap-2 border border-black p-1 shrink-0 bg-slate-50">
                    <div className="w-8 h-8 flex flex-col border border-slate-400">
                      <div className="flex-1 bg-blue-700"></div>
                      <div className="flex-1 bg-yellow-400"></div>
                      <div className="flex-1 bg-red-600"></div>
                    </div>
                    <div className="w-8 h-8 bg-blue-900 text-yellow-300 flex items-center justify-center text-[7px] font-black border border-slate-400">
                      ★ ★ ★
                    </div>
                  </div>
                </div>

                {/* Salutation with Candidate Name */}
                <div className="pt-4 pb-2 border-b border-black/40 text-[11px]">
                  <span className="italic font-bold">Dear Ms./Mr./ Stimatā doamnă/Stimate domnule </span>
                  <span className="font-extrabold uppercase underline tracking-wider ml-1">
                    {applicant.full_name}
                  </span>
                </div>

                {/* Examination Statement */}
                <div className="pt-3 space-y-1.5">
                  <div className="font-bold">
                    The Embassy of Romania To The Democratic Socialist Republic of Sri Lanka, Colombo /
                    <span className="italic font-normal block">Ambasada României la Colombo, Sri Lanka, has / a:</span>
                  </div>

                  <div className="space-y-1 pt-1 pl-1">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-xs">[☒]</span>
                      <span>examined your long-stay visa application; / examinat cererea dumneavoastră de viză de lungă şedere;</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-700">
                      <span className="font-normal text-xs">[☐]</span>
                      <span>examined your long-stay visa / examinat viza dumneavoastră, number / nr.: ........................................, issued: / eliberată la: ........................................ [date/month/ year] / [data/luna/anul].</span>
                    </div>
                    <div className="flex items-start gap-2 font-bold pt-1">
                      <span className="text-xs">[☒]</span>
                      <span>The visa has been refused / Viza a fost refuzată</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-700">
                      <span className="text-xs">[☐]</span>
                      <span>The visa has been annulled / Viza a fost anulată</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-700">
                      <span className="text-xs">[☐]</span>
                      <span>The visa has been revoked/ Viza a fost revocată</span>
                    </div>
                  </div>
                </div>

                {/* Grounds Section Header */}
                <div className="pt-4 font-bold border-t border-black mt-3">
                  This decision is based on the following reason(s): / Decizia se bazează pe motivul (motivele) de mai jos:
                </div>

                {/* Ground 1 to 3 */}
                <div className="pt-2 space-y-2 text-[10.5px]">
                  <div className="flex items-start gap-2">
                    <span className="text-xs">[☐]</span>
                    <div>
                      <strong>1.</strong> You have submitted a travel document that: / Aţi prezentat un document de călătorie care: [☐] is false, counterfeit or forged / este contrafăcut, fals sau falsificat [☐] is not valid 3 months from the expected date of departure from the territory of Romania/ nu este valabil 3 luni de la data preconizată pentru ieşirea de pe teritoriul României [☐] is more than 10 years old / este mai vechi de 10 ani [☐] is not accepted by Romania/ nu este acceptat de statul român;
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-xs">[☐]</span>
                    <div>
                      <strong>2.</strong> You have failed to provide sufficient documents to justify the purpose and conditions of the intended stay / Nu ați prezentat suficiente documente pentru justificarea scopului şi a condiţiilor privind şederea preconizată [☐] You have failed to submit the additionally requested documents / Nu aţi prezentat documentele suplimentare solicitate;
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-xs">[☐]</span>
                    <div>
                      <strong>3.</strong> You have failed to provide proof of sufficient means of subsistence, for the duration of the intended stay or for the return to your country of origin or of residence, or for the transit to a third country into which you are certain to be admitted, or you are not in a position to acquire such means lawfully / Nu ați prezentat dovada unor mijloace de întreţinere suficiente, pe durata şederii prevăzute sau pentru întoarcerea în ţara de origine sau de reşedinţă sau pentru tranzitul către o ţară terţă în care este sigur că puteți fi primit, sau nu sunteţi în măsură să dobândiți astfel de mijloace în mod legal;
                    </div>
                  </div>
                </div>
              </div>

              {/* Page 1 Footer */}
              <div className="pt-4 border-t border-slate-300 text-[9px] text-slate-600 flex justify-between items-end">
                <div className="space-y-0.5">
                  <div>¹ The visa applicant/holder shall receive this document, in original form, from the Romanian diplomatic mission/consular post where they lodged their visa application. A copy of this document shall be archived with the corresponding visa application file.</div>
                  <div>² Solicitantul/titularul vizei va primi acest document, în original, din partea misiunii diplomatice/oficiului consular al României unde a formulat cererea. O copie a documentului va fi archivată la dosarul solicitantului vizei.</div>
                </div>
                <div className="font-mono font-bold text-right pl-4">1 / 4</div>
              </div>
            </div>

            {/* ================= PAGE 2 ================= */}
            <div className="min-h-[270mm] flex flex-col justify-between space-y-4 page-break-after pt-6 border-t-2 border-dashed border-slate-200 print:border-none print:pt-0">
              <div className="space-y-2.5 text-[10.5px]">
                <div className="flex items-start gap-2">
                  <span className="text-xs">[☐]</span>
                  <div>
                    <strong>4.</strong> You have failed to provide proof of holding an adequate and valid travel medical insurance / Nu aţi prezentat dovada deţinerii unei asigurări medicale de călătorie corespunzătoare şi valabile;
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-xs">[☐]</span>
                  <div>
                    <strong>5.</strong> As a minor, you failed to provide a translated notarized, apostilled or legalized document that contains the consent of both parents, of the parent who exercises parental authority by themselves, of the surviving parent or of another person with legal representative status of, regarding the stay on the territory of Romania for the purpose of which the visa is requested/ Minorul nu a putut prezenta un act autentificat notarial, apostilat sau supralegalizat, tradus, care să cuprindă încuviinţarea din partea ambilor părinți, a părintelui care exercita singur autoritatea părintească, a părintelui supravieţuitor sau a unei alte persoane care are calitatea de reprezentant legal, cu privire la şederea pe teritoriul României în scopul pentru care se solicita viza;
                  </div>
                </div>

                {/* Ground 6 - THE MATCHED PRIMARY REASON */}
                <div className="flex items-start gap-2 bg-rose-50/80 p-2 border border-rose-300 rounded font-medium">
                  <span className="text-xs font-bold text-rose-800">[☒]</span>
                  <div>
                    <strong>6.</strong> There are well-founded doubts regarding the authenticity of the supporting documents / Există îndoieli întemeiate referitoare la autenticitatea documentelor justificative [☐] There are well-founded doubts regarding the veracity of the content of the supporting documents/Există îndoieli întemeiate referitoare la veridicitatea conţinutului documentelor justificative <strong>[☒] There are well-founded doubts regarding the degree of trust awarded to your statements during the consular interview / Există îndoieli întemeiate referitoare la gradul de încredere care poate fi acordat declaraţiilor din cadrul interviului consular</strong> [☐] The information submitted regarding the justification for the purpose and conditions of the intended stay was not reliable / Informaţiile cu privire la justificarea scopului şi a condiţiilor privind şederea prevăzută nu sunt fiabile [☐] There are reasons to believe that the visa is being requested for the purpose of illegal migration / Există motive să se considere că viza este solicitată în scopul migrării ilegale;
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-xs">[☐]</span>
                  <div>
                    <strong>7.</strong> You have failed to presented guarantees that you will leave the territory of Romania, in the event that your temporary stay will not be extended / Nu ați prezentat garanţii că veți părăsi teritoriul României, în eventualitatea în care şederea dumneavoastră temporară nu va fi prelungită;
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-xs">[☐]</span>
                  <div>
                    <strong>8.</strong> An alert has been issued in the National Alert Information System (SINS), for the purpose of refusing entry / Pe numele dumneavoastră a fost emisă o alertă în Sistemul Informatic Naţional de Semnalări (SINS), în scopul refuzării intrării [☐] An alert has been issued in the Schengen Information System (SIS) for the purpose of refusing entry by ........................................................................................ / Pe numele dumneavoastră a fost emisă o alertă în Sistemul de Informaţii Schengen (SIS) în scopul refuzării intrării, de ........................................................................................ (indication of the Member State in question/se precizează statul membru).
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-xs">[☐]</span>
                  <div>
                    <strong>9.</strong> An alert for the purpose of refusing visa issuance has been issued in the national migration, asylum and visa integrated information system / A fost emisă o alertă privind refuzul eliberării vizei în sistemul informatic integrat pe probleme de migraţie, azil şi vize;
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-xs">[☐]</span>
                  <div>
                    <strong>10.</strong> You are deemed to be a threat to national defense and security, order, health or public morals / Sunteţi considerat(ă) ca reprezentând o ameninţare pentru apărarea şi securitatea naţională, ordinea şi sănătatea publică [☐] You have been reported by international organizations to which Romania is party to/by institutions specialized in combatting terrorism offences, that you, in any way, finance, prepare, support or commit acts of terrorism / Aţi fost semnalat de organizaţii internaţionale la care România este parte/de instituţii specializate în combaterea terorismului, că finanţaţi, pregătiți, sprijiniţi, în orice mod, sau comiteţi acte de terorism [☐] There are indications that you are party to transnational criminal organizations or that you support the activity of these groups / există indicii că faceţi parte din grupuri infracţionale organizate cu caracter transnaţional sau că sprijiniţi activitatea acestor grupuri; [☐] There are serious reasons to believe that you have committed or participated in committing crimes against peace and humanity or war crimes
                  </div>
                </div>
              </div>

              {/* Page 2 Footer */}
              <div className="pt-4 border-t border-slate-300 text-[9px] text-slate-600 flex justify-end">
                <div className="font-mono font-bold">2 / 4</div>
              </div>
            </div>

            {/* ================= PAGE 3 ================= */}
            <div className="min-h-[270mm] flex flex-col justify-between space-y-4 page-break-after pt-6 border-t-2 border-dashed border-slate-200 print:border-none print:pt-0">
              <div className="space-y-2.5 text-[10.5px]">
                <div className="flex items-start gap-2">
                  <span className="text-xs">[☐]</span>
                  <div>
                    or crimes against humanity / Există motive serioase să se considere că ați săvarsit sau participat la săvarsirea unor infracțiuni contra păcii si omenirii ori unor crime de război sau crime contra umanității;
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-xs">[☐]</span>
                  <div>
                    <strong>11.</strong> You have been irrevocably condemned for crimes committed abroad that are incompatible with the purpose for which you apply for a visa / Aţi fost condamnat definitiv pentru infracţiuni săvârşite în străinătate, incompatibile cu scopul pentru care solicitați acordarea vizei;
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-xs">[☐]</span>
                  <div>
                    <strong>12.</strong> It was found that on the date of the visa application you did not meet the conditions provided for by GEO Nº 194/2002³ / S-a constatat că la data solicitării vizei nu îndeplineaţi condiţiile prevăzute de OUG nr. 194/2002⁴ [☐] You obtained the Romanian visa on the basis of false documents or information / Aţi obţinut viza română în baza unor documente sau informații false [☐] You introduced or tried to illegally introduce other aliens into Romania or have facilitated their transportation or accommodation / Aţi introdus sau aţi încercat să introduceţi ilegal în România alți străini sau aţi înlesnit transportul sau cazarea acestora [☐] You violated the customs regulations or crossed or tried to cross the state border illegally / Aţi încălcat reglementările vamale ori aţi trecut sau aţi încercat să treceţi ilegal frontiera de stat [☐] You entered Romania during the previously imposed entry ban period / Aţi intrat în România în perioada de interdicţie dispusă anterior;
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-xs">[☐]</span>
                  <div>
                    <strong>13.</strong> It was found that you no longer meet the conditions required upon obtaining the visa, according to the provisions of GEO Nº 194/2002 / S-a constatat că nu mai îndepliniți condițiile cerute la acordarea vizei, potrivit dispoziţiilor OUG nr. 194/2002 [☐] You did not comply with the purpose for which the visa was granted/ Nu aţi respectat scopul pentru care a fost acordată viza de intrare [☐] After the visa was granted, the entry ban measure was imposed against you or you were declared as undesirable / După acordarea vizei, împotriva dumneavoastră a fost dispusă măsura interzicerii intrării sau aţi fost declarat indezirabil [☐] You have been found to have violated employment regulations / S-a constatat ca aţi încălcat reglementările referitoare la angajarea în muncă [☐] The employer has been liquidated, is insolvent, does not carry out commercial activities, has not paid its obligations to the state budget, has been definitively convicted of a crime under the Labor Code or has been sanctioned for hiring an illegally staying foreigner/ Angajatorul a fost lichidat, se afla în insolvenţă, nu desfăşoară activităţi comerciale, nu are achitate obligaţiile către bugetul de stat, a fost condamnat definitiv pentru o infracţiune din Codul Muncii ori a fost sancţionat pentru primirea la munca a unui străin cu şedere ilegală [☐] Your employer no longer fulfils the conditions laid out in art.5(1)(b) of GEO N. 32/2026 / Angajatorul nu mai îndeplineşte condiţia prevăzută la art.5(1)(b) of OUG nr. 32/2026.
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-xs">[☐]</span>
                  <div>
                    <strong>14.</strong> The visa was revoked at your own request⁵ / Viza a fost revocată la solicitarea dumneavoastră⁶.
                  </div>
                </div>

                {/* Additional remarks box - EXACTLY AS HIGHLIGHTED IN SCANNED DOCUMENT */}
                <div className="pt-3">
                  <div className="border border-black p-3 space-y-1 bg-slate-50/60 font-sans">
                    <div className="font-bold text-[11px] underline">Additional remarks:</div>
                    <div className="pt-3 pb-3 text-xs font-black tracking-wide text-rose-950 uppercase font-mono leading-relaxed">
                      {additionalRemarks}
                    </div>
                  </div>
                </div>
              </div>

              {/* Page 3 Footer */}
              <div className="pt-4 border-t border-slate-300 text-[8.5px] text-slate-600 flex justify-between items-end">
                <div className="space-y-0.5">
                  <div>³ Emergency Government Ordinance Nº 194/2002 regarding the regime of aliens in Romania, republished, amended and completed;</div>
                  <div>⁴ Ordonanţa de urgenţă a Guvernului nr. 194/2002 privind regimul străinilor în România, republicată, cu modificările şi completările ulterioare;</div>
                  <div>⁵ Revocation of a visa based on this reason is not subject to the right of appeal.</div>
                  <div>⁶ Revocarea unei vize din acest motiv nu poate face obiectul unei căi de atac.</div>
                </div>
                <div className="font-mono font-bold text-right pl-4">3 / 4</div>
              </div>
            </div>

            {/* ================= PAGE 4 ================= */}
            <div className="min-h-[270mm] flex flex-col justify-between space-y-6 pt-6 border-t-2 border-dashed border-slate-200 print:border-none print:pt-0">
              <div className="space-y-4 text-[10.5px]">
                {/* Legal remedies & appeal notification text */}
                <p className="text-justify leading-relaxed">
                  You may appeal against the decision to refuse/annul/revoke a visa. The rules that apply to appeals against decisions on refusal/annulment/revocation of a visa are set out in Art. 31 Para. (5) and Art.33 Para.(6) of Emergency Government Ordinance Nº194/2002 regarding the regime of aliens in Romania, republished, amended and completed. / Puteți exercita o cale de atac împotriva deciziei de refuzare/anulare/revocare a vizei române de lungă şedere. Normele privind introducerea unei căi de atac împotriva deciziilor de refuzare/anulare/revocare a unei vize sunt prevăzute la art.31 alin.(5) şi art.33 alin.(6) din Ordonanţa de Urgenţă nr. 194/2002 privind regimul străinilor în România, cu modificările şi completările ulterioare.
                </p>

                <p className="text-justify leading-relaxed">
                  The preliminary complaint procedure is mandatory and a formal complaint must be lodged within 30 days of receiving the refusal form. Subsequently, the appeal must be introduced within 6 months of receiving the formal notice of the response to the prior complaint or within 6 months of the expiry of the deadline for responding to the prior complaint, but no longer than 1 year after receiving the formal notice of the standard refusal form. The request to exercise the right to dispute the decision to refuse/annul/revoke a visa may be submitted by written, dated and signed request, delivered to the eMail address <span className="font-bold underline text-blue-800">relatii_cu_publicul@mae.ro</span> or to the Headquarters of the Ministry of Foreign Affairs, at 31 Alexandru Alley, Sector 1, Bucharest, 011822. The competent authorities to which the appeal may be lodged are the administrative divisions of the courts of appeal with territorial jurisdiction, with contact details available at <span className="underline">https://portal.just.ro/SitePages/instante.aspx</span>. Information on the procedure to be followed can be consulted in Law Nº554/2004 of administrative litigation, amended and completed, as well as on the official website of the Ministry of Foreign Affairs - section on visas. / Procedura formulării plângerii prealabile este obligatorie şi trebuie depusă în termen de 30 de zile de la comunicarea formularului de refuz/anulare revocare. Calea de atac trebuie introdusă în termen de 6 luni de la data comunicării răspunsului la plângerea prealabilă sau de la data expirării termenului de soluţionare a plângerii prealabile, dar în nu mai mult de 1 an de la data comunicării formularului de refuz. Solicitarea privind exercitarea dreptului de contestare a deciziei de refuzare/anulare/revocare a vizei poate fi depusă, prin cerere scrisă, datată şi semnată. Aceasta poate fi transmisă/depusă la adresa de corespondenţă <span className="font-bold underline text-blue-800">relatii_cu_publicul@mae.ro</span>, respectiv la sediul MAE, în Aleea Alexandru nr.31, Sector 1, Bucureşti, cod 011822. Autorităţile competente la care poate fi introdusă calea de atac sunt secţiile de contencios administrativ ale curţilor de apel competente teritorial, ale căror date de contact se regăsesc la <span className="underline">https://portal.just.ro/SitePages/instante.aspx</span>. Informaţii cu privire la procedura care trebuie urmată pot fi consultate în Legea contenciosului administrativ nr.554/2004 cu modificările şi completările ulterioare, precum şi în pagina web oficială a Ministerului Afacerilor Externe, la rubrica privind vizele.
                </p>

                {/* Date and Stamp Block */}
                <div className="pt-8">
                  <div className="font-bold text-[11px] pb-2">
                    Date and stamp of Embassy/Consulate General/Consulate/ of the authorities responsible for checks on persons/of other competent authorities: / Data şi ştampila ambasadei / consulatului general / consulatului / biroului consular / autorităţilor însărcinate cu verificarea persoanelor/altor autorităţi competente:
                  </div>

                  <div className="flex justify-between items-center pt-4">
                    <div className="font-mono text-xs">
                      <strong>Date:</strong> {refusalDate.replace(/-/g, '/')}
                    </div>

                    {/* Official Romanian Embassy Colombo Consular Seal Replica */}
                    <div className="w-32 h-32 rounded-full border-2 border-blue-900 text-blue-900 flex flex-col items-center justify-center p-2 text-center text-[7.5px] font-bold uppercase tracking-tight shadow-xs select-none rotate-[-5deg]">
                      <div className="text-[6.5px]">ROMÂNIA</div>
                      <div className="font-serif text-[7.5px] my-0.5">AMBASADA ROMÂNIEI</div>
                      <div className="text-[6.5px]">LA COLOMBO</div>
                      <div className="text-[6px] tracking-widest text-slate-700">★ ★ ★</div>
                      <div className="text-[6.5px] font-black">SECŢIA CONSULARĂ</div>
                    </div>
                  </div>
                </div>

                {/* Candidate Signature Block */}
                <div className="pt-8">
                  <div className="font-bold text-[11px] pb-1">
                    Signature of person concerned: / Semnătura persoanei vizate:
                  </div>
                  <div className="border-b border-black w-72 pt-8"></div>
                </div>
              </div>

              {/* Page 4 Footer */}
              <div className="pt-4 border-t border-slate-300 text-[9px] text-slate-600 flex justify-end">
                <div className="font-mono font-bold">4 / 4</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
