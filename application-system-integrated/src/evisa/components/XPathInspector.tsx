import React, { useState, useEffect } from "react";
import { ShieldCheck, Code2, Edit3, Save, Check } from "lucide-react";

export const XPathInspector: React.FC = () => {
  const [xpaths, setXpaths] = useState({
    sessionExpiredCheck: "//*[contains(text(), 'Your session has expired')] | //*[contains(text(), 'Sesiunea dumneavoastră a expirat')]",
    currentNationalityPopout: "//li[contains(., 'Sri Lanka')] | //a[contains(., 'Sri Lanka')] | //*[contains(@class, 'rcbItem') and contains(., 'Sri Lanka')]",
    countryOfResidencePopout: "//li[contains(., 'Sri Lanka')] | //a[contains(., 'Sri Lanka')] | //*[contains(@class, 'rcbItem') and contains(., 'Sri Lanka')]",
    diplomaticMissionPopout: "//li[contains(., 'Colombo')] | //a[contains(., 'Colombo')] | //*[contains(@class, 'rcbItem') and contains(., 'Colombo')]",
    travelDocumentPopout: "//li[contains(., 'Ordinary')] | //li[contains(., 'Simplu')] | //*[contains(@class, 'rcbItem') and contains(., 'Ordinary')]",
    saveButton: "//button[contains(normalize-space(), 'Save')] | //*[contains(@class, 'btn') and contains(text(), 'Save')] | //a[contains(text(), 'Save')]",
    nextButton: "//button[contains(normalize-space(), 'Next')] | //*[contains(@class, 'btn') and contains(text(), 'Next')] | //a[contains(text(), 'Next')]",
    homeCountryDropdown: "//select[contains(@id, 'Home country') or contains(@name, 'Home country')] | //label[contains(., 'Home country')]/following-sibling::select",
    placeField: "//label[contains(., 'Place')]/following-sibling::input | //input[contains(@id, 'place')]",
    addressField: "//label[contains(., 'Address')]/following-sibling::textarea | //textarea[contains(@id, 'address')]",
    typeOfHostDropdown: "//select[contains(@id, 'Type of host')] | //label[contains(., 'Type of host')]/following-sibling::select",
    hotelNameField: "//label[contains(., 'Hotel name')]/following-sibling::input | //input[contains(@id, 'hotel_name')]",
    hostAddressField: "//label[contains(., 'Host address')]/following-sibling::textarea | //textarea[contains(@id, 'host_address')]",
    spouseSurnameField: "//label[contains(., 'Surname of spouse') and not(contains(., 'birth'))]/following-sibling::input",
    spouseFirstNameField: "//label[contains(., 'First name(s) of spouse')]/following-sibling::input",
    spouseBirthSurnameField: "//label[contains(., 'Surname of spouse at birth')]/following-sibling::input",
  });

  const [saved, setSaved] = useState(false);
  const [snapshot, setSnapshot] = useState('');
  const [domResults, setDomResults] = useState<Array<{name:string;count:number;error?:string;matches:string[]}>>([]);
  const inspect = () => {
    if (!snapshot.trim()) {setDomResults([]);return;}
    const sanitized=snapshot.replace(/\s(?:src|href)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'');
    const dom=new DOMParser().parseFromString(sanitized,'text/html');
    setDomResults(Object.entries(xpaths).map(([name,expression])=>{
      try {
        const result=dom.evaluate(expression,dom,null,XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,null);
        const matches=Array.from({length:Math.min(3,result.snapshotLength)},(_,i)=>{
          const el=result.snapshotItem(i);return `${el?.nodeName || '?'}: ${(el?.textContent || '').trim().slice(0,80)}`;
        });
        return {name,count:result.snapshotLength,matches};
      } catch(error) {return {name,count:0,matches:[],error:error instanceof Error?error.message:'Invalid XPath'};}
    }));
  };
  useEffect(() => { try { const values=JSON.parse(localStorage.getItem('evisa-reference-xpaths') || '{}'); if (values && typeof values === 'object') setXpaths(current => Object.fromEntries(Object.entries(current).map(([key,value]) => [key,typeof values[key] === 'string' ? values[key] : value])) as typeof current); } catch {} }, []);

  const handleSave = () => {
    try { localStorage.setItem('evisa-reference-xpaths', JSON.stringify(xpaths)); } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">XPath Selectors & Session Guards Inspector</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Editable e-v selectors: saved overrides are used in generated reference code. Check the official portal DOM; no live browser is connected.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
        >
          {saved ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
          <span>{saved ? "Saved locally!" : "Save selectors in this browser"}</span>
        </button>
      </div>

      <section className="rounded-xl border border-cyan-800/60 bg-slate-950 p-4 mb-5 space-y-3">
        <h3 className="font-bold text-cyan-300 text-sm">Local DOM Snapshot Tester</h3>
        <p className="text-xs text-slate-400">Paste saved HTML from your own browser, or select an HTML file. XPath expressions run only against that local, inert snapshot; no portal connection is made. HTML is not saved.</p>
        <input aria-label="Load DOM snapshot file" type="file" accept=".html,.htm,.txt,text/html" onChange={async e=>{const file=e.target.files?.[0];if(file){if(file.size>1_000_000){setSnapshot('');setDomResults([{name:'Upload',count:0,matches:[],error:'File must be under 1 MB.'}]);return;}setSnapshot(await file.text());setDomResults([]);}}} className="text-xs text-slate-300" />
        <textarea aria-label="DOM snapshot HTML" value={snapshot} onChange={e=>{setSnapshot(e.target.value);setDomResults([]);}} placeholder="Paste local HTML markup here" rows={4} className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono text-xs text-slate-100" />
        <button type="button" onClick={inspect} className="rounded bg-cyan-700 px-4 py-2 text-xs font-bold text-white">Test XPath against snapshot</button>
        {domResults.length>0&&<div aria-label="XPath match results" className="grid gap-1 text-xs">{domResults.map(result=><div key={result.name} className="rounded border border-slate-800 p-2"><strong className="text-cyan-300">{result.name}</strong>: {result.error||`${result.count} match(es)`}{result.matches.length>0&&<span className="text-slate-400"> · {result.matches.join(' | ')}</span>}</div>)}</div>}
      </section>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(xpaths).map(([key, value]) => (
          <div key={key} className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Code2 className="w-3.5 h-3.5" />
                <span>{key.replace(/([A-Z])/g, " $1")}</span>
              </span>
            </div>
            <textarea
              data-testid={`evisa-xpath-${key}`}
              value={value}
              onChange={(e) => setXpaths({ ...xpaths, [key]: e.target.value })}
              rows={2}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-emerald-400 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
