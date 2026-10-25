import React, { useState } from 'react';
import { Sparkles, RefreshCw, Send, HelpCircle, FileText, CheckCircle2, MessageSquare, Bot, User } from 'lucide-react';
import { ApplicantOverview } from '../types';

interface Props {
  applicants: ApplicantOverview[];
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const AICopilot: React.FC<Props> = ({ applicants, showNotification }) => {
  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: `Hello! I am your TRANS ARABIAN Recruitment Intelligence Copilot, powered by Gemini 3.8 Flash. I have real-time access to our live master database across candidates, embassy processing pipelines, document checklists, and flight schedules. How can I assist you today?`
    }
  ]);
  const [thinking, setThinking] = useState(false);

  const quickPrompts = [
    { label: 'Embassy-ready Candidates', prompt: 'List all candidates with valid passports ready for Embassy submission' },
    { label: 'Follow-up Bottlenecks', prompt: 'Identify applicants stuck in Follow-up stage for more than 7 days' },
    { label: 'Hospitality CV Profile', prompt: 'Draft a professional bio-data profile summary for hospitality and kitchen candidates' },
    { label: 'Trade Vacancy Analysis', prompt: 'Analyze candidate distribution vs high-demand Gulf trade vacancies' },
    { label: 'WhatsApp Reminder', prompt: 'Draft a friendly WhatsApp appointment reminder message for an applicant coming to the office' }
  ];

  const handleSend = async (queryText?: string) => {
    const q = queryText || prompt;
    if (!q.trim()) return;

    const newHistory = [...history, { role: 'user' as const, text: q }];
    setHistory(newHistory);
    setPrompt('');
    setThinking(true);

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: q })
      });

      const data = await res.json();
      if (res.ok && data.text) {
        setHistory([...newHistory, { role: 'assistant' as const, text: data.text }]);
      } else {
        setHistory([
          ...newHistory,
          { role: 'assistant' as const, text: `AI Service Notice: ${data.error || 'No response returned.'}` }
        ]);
      }
    } catch (err: any) {
      setHistory([
        ...newHistory,
        { role: 'assistant' as const, text: `Connection error: ${err.message}` }
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-950/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-900 leading-tight">Trans Arabian Copilot</h3>
              <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Natural language intelligence grounded in live candidate and embassy records.
            </p>
          </div>
        </div>
      </div>

      {/* Suggested Fast Prompts */}
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
          Recommended Inquiries:
        </span>
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip.prompt)}
              className="text-xs bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-900 px-3 py-1.5 rounded-xl border border-slate-200/80 transition-all shadow-2xs hover:border-purple-200 cursor-pointer active:scale-98"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-200/70 min-h-[380px] max-h-[500px] overflow-y-auto space-y-4 shadow-inner">
        {history.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-700 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div
              className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-purple-900 to-indigo-900 text-white shadow-sm rounded-tr-xs'
                  : 'bg-white text-slate-800 border border-slate-200/80 shadow-xs rounded-tl-xs'
              }`}
            >
              {msg.text}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}
        {thinking && (
          <div className="flex items-center gap-2 text-xs text-purple-700 p-2 font-medium">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
            <span>Analyzing candidate database & generating response...</span>
          </div>
        )}
      </div>

      {/* Prompt Bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask anything about candidates, embassy interviews, document readiness, or statistics..."
          className="flex-1 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-purple-500 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all shadow-xs"
        />
        <button
          onClick={() => handleSend()}
          disabled={thinking}
          className="flex items-center gap-1.5 bg-gradient-to-r from-purple-900 to-indigo-900 hover:from-purple-800 hover:to-indigo-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer active:scale-98"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
};
