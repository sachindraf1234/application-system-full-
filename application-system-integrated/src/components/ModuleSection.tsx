import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Play, Square, RefreshCw, AlertTriangle, Terminal } from 'lucide-react';
import transArabianLogo from '../assets/images/trans_arabian_logo_official.jpeg';

interface ModuleInfo {
  id: string;
  name: string;
  repo: string;
  kind: 'web' | 'cli' | 'incomplete';
  description: string;
  sourceReady: boolean;
  running: boolean;
  port?: number;
  startedAt: string | null;
  exitCode: number | null;
  error: string | null;
  missingEnv: string[];
  commands: string[];
  reason: string | null;
  dryRun: boolean;
  uiPath: string | null;
  log: string[];
}

interface Props {
  moduleId: string;
  onBack: () => void;
}

export const ModuleSection: React.FC<Props> = ({ moduleId, onBack }) => {
  const [info, setInfo] = useState<ModuleInfo | null>(null);
  const [modulesEnabled, setModulesEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/modules');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setModulesEnabled(!!data.modulesEnabled);
      setInfo((data.modules as ModuleInfo[]).find((m) => m.id === moduleId) || null);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load module status');
    }
  }, [moduleId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const act = async (action: 'start' | 'stop') => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/modules/${moduleId}/${action}`, { method: 'POST' });
      const data = await res.json();
      setMessage(data.message || data.error || (res.ok ? 'Done.' : 'Request failed.'));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const isTrans = moduleId === 'transarabian-agent';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-4 p-6 min-h-[70vh]">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {isTrans && <img src={transArabianLogo} alt="Trans Arabian" className="h-12 w-auto rounded-md object-contain" />}
          <div>
            <h2 className="text-lg font-bold text-slate-800">{info?.name ?? 'Module'}</h2>
            <p className="text-xs text-slate-500">{info?.description}</p>
            {info && (
              <a href={info.repo} target="_blank" rel="noreferrer" className="text-xs text-blue-600 inline-flex items-center gap-1 mt-1">
                {info.repo.replace('https://github.com/', '')} <ExternalLink size={11} />
              </a>
            )}
          </div>
        </div>
        <button onClick={onBack} className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      {loadError && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{loadError}</div>}

      {info && info.kind === 'web' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-1 rounded border ${info.running ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-600 bg-slate-50 border-slate-200'}`}>
              {info.running ? `Running · port ${info.port}` : 'Stopped'}
            </span>
            {!info.sourceReady && <span className="text-xs text-red-700">Source missing</span>}
            <button
              onClick={() => act('start')}
              disabled={busy || info.running || !modulesEnabled || !info.sourceReady}
              className="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-40 inline-flex items-center gap-1"
            >
              <Play size={14} /> Start
            </button>
            <button
              onClick={() => act('stop')}
              disabled={busy || !info.running}
              className="text-sm px-3 py-1.5 rounded-lg bg-slate-700 text-white disabled:opacity-40 inline-flex items-center gap-1"
            >
              <Square size={14} /> Stop
            </button>
            <button onClick={refresh} className="text-sm px-2 py-1.5 text-slate-600 inline-flex items-center gap-1">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          {info.dryRun && (
            <div className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded p-3">
              DRY RUN: this bot records what it would send to a local outbox (<code>modules/{info.id}/data/dry_run_outbox.jsonl</code>). Nothing is sent to WhatsApp.
            </div>
          )}
          {!modulesEnabled && (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
              Starting modules is turned off on this server. Set <code>MODULES_ENABLED=true</code> to allow it.
            </div>
          )}
          {info.missingEnv.length > 0 && (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3 flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>Missing configuration: {info.missingEnv.join(', ')} — add them to <code>modules/{info.id}/.env</code> (never commit that file).</span>
            </div>
          )}
          {message && <div className="text-sm text-slate-700">{message}</div>}
          {info.running && info.uiPath ? (
            <iframe title={info.name} src={info.uiPath} className="w-full flex-1 min-h-[60vh] rounded-lg border border-slate-200" />
          ) : (
            <div className="text-sm text-slate-500">Start the module to open its interface here.</div>
          )}
          {info.log.length > 0 && (
            <pre className="text-[11px] bg-slate-900 text-slate-100 rounded-lg p-3 overflow-auto max-h-56">{info.log.join('\n')}</pre>
          )}
        </>
      )}

      {info && info.kind === 'cli' && (
        <div className="flex flex-col gap-3">
          <div className="text-sm text-slate-700">This module runs from the command line (it has no web interface yet). Run these from <code>modules/{info.id}/</code>:</div>
          <pre className="text-xs bg-slate-900 text-slate-100 rounded-lg p-4 overflow-auto flex gap-2">
            <Terminal size={14} className="shrink-0" />
            {info.commands.join('\n')}
          </pre>
        </div>
      )}

      {info && info.kind === 'incomplete' && (
        <div className="text-sm text-red-800 bg-red-50 border border-red-200 rounded p-4">
          <div className="font-semibold mb-1">Cannot run yet</div>
          {info.reason}
        </div>
      )}
    </div>
  );
};
