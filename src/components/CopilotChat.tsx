import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquareCode, 
  Send, 
  Sparkles, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight, 
  Cpu, 
  Lock, 
  ArrowRight, 
  Terminal,
  FileText
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  blocked?: boolean;
  reasoning_trace?: Array<{
    step: number;
    agent: string;
    action: string;
    rationale: string;
  }>;
  citations?: string[];
}

interface CopilotChatProps {
  initialAssetId?: string;
  onOpenDecisionBrief: (assetId: string) => void;
}

export const CopilotChat: React.FC<CopilotChatProps> = ({ initialAssetId = 'M-204', onOpenDecisionBrief }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-01',
      sender: 'agent',
      text: (
        "MaintainCopilot initialized under Autonomy Level L2 (Draft-Only). " +
        "All numerical estimates (anomaly scores, RUL quantiles, downtime costs) are computed strictly by deterministic engines. " +
        "I am ready to assist with fleet triage, fault hypothesis ranking, and repair window planning."
      ),
      timestamp: '11:38 AM',
      citations: ['MaintainCopilot:SystemArchitecture', 'GovernanceGuard:L2']
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (userText?: string) => {
    const textToSend = userText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!userText) setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: textToSend, asset_id: initialAssetId })
      });
      const data = await response.json();

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: data.response || 'Telemetry analyzed. No anomalies reported.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        blocked: data.blocked,
        reasoning_trace: data.reasoning_trace,
        citations: data.citations
      };

      setMessages((prev) => [...prev, agentMsg]);
      if (data.reasoning_trace && data.reasoning_trace.length > 0) {
        setExpandedTraceId(agentMsg.id);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'agent',
          text: `Error connecting to Copilot API: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col h-[750px]">
      {/* Chat Header */}
      <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
            <MessageSquareCode className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              MaintainCopilot Agentic Dialog
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded font-normal">
                Multi-Agent Active
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Diagnosis Specialist • Planner Specialist • Safety Reviewer (Independent VETO)
            </p>
          </div>
        </div>

        <button
          onClick={() => onOpenDecisionBrief(initialAssetId)}
          className="text-xs font-mono font-semibold px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors flex items-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Open Full Brief</span>
        </button>
      </div>

      {/* Quick Prompts Bar */}
      <div className="bg-slate-950/40 border-b border-slate-800/80 px-6 py-2.5 flex items-center space-x-2 overflow-x-auto scrollbar-none font-mono text-xs">
        <span className="text-slate-500 text-[11px] font-bold uppercase shrink-0">Prompts:</span>
        <button
          onClick={() => handleSend("What is at risk this week across the fleet?")}
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 whitespace-nowrap transition-colors"
        >
          Fleet Risk Summary
        </button>
        <button
          onClick={() => handleSend("Explain M-204 bearing vibration and recommended repair window.")}
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 whitespace-nowrap transition-colors"
        >
          M-204 Diagnosis
        </button>
        <button
          onClick={() => handleSend("Can we postpone M-204 repair to the weekend off-peak window?")}
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 whitespace-nowrap transition-colors"
        >
          Window Trade-offs
        </button>
        <button
          onClick={() => handleSend("Emergency: Shut down conveyor motor M-204 right now!")}
          className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 whitespace-nowrap transition-colors font-semibold"
        >
          [Security Test] Execute Shutdown
        </button>
      </div>

      {/* Messages Scroll View */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-xs">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isBlocked = msg.blocked;
          const isTraceOpen = expandedTraceId === msg.id;

          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}>
              <div className="flex items-center space-x-2 text-[10px] text-slate-500 px-1">
                <span className="font-bold">{isUser ? 'OPERATOR' : 'MAINTAIN_COPILOT'}</span>
                <span>• {msg.timestamp}</span>
                {!isUser && (
                  <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded">
                    AI-DRAFTED
                  </span>
                )}
              </div>

              <div
                className={`max-w-2xl rounded-xl p-4 shadow-sm leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? 'bg-cyan-600 text-white font-medium rounded-tr-none'
                    : isBlocked
                    ? 'bg-rose-950/50 border border-rose-500/50 text-rose-200 rounded-tl-none'
                    : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>

              {/* Reasoning Trace Section */}
              {msg.reasoning_trace && msg.reasoning_trace.length > 0 && (
                <div className="max-w-2xl w-full bg-slate-950/90 border border-slate-800 rounded-lg overflow-hidden mt-1">
                  <button
                    onClick={() => setExpandedTraceId(isTraceOpen ? null : msg.id)}
                    className="w-full px-3 py-2 text-left flex items-center justify-between text-[11px] text-slate-400 hover:text-cyan-300 hover:bg-slate-900 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 font-bold">
                      <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                      Multi-Agent Reasoning Trace ({msg.reasoning_trace.length} Steps)
                    </span>
                    {isTraceOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>

                  {isTraceOpen && (
                    <div className="p-3 border-t border-slate-800/80 space-y-2 text-[11px] text-slate-300">
                      {msg.reasoning_trace.map((step, idx) => (
                        <div key={idx} className="p-2 rounded bg-slate-900/60 border border-slate-800/60 space-y-0.5">
                          <div className="flex items-center justify-between font-bold text-cyan-400">
                            <span>Step {step.step}: [{step.agent}]</span>
                            <span className="text-[10px] text-slate-500 font-mono">{step.action}</span>
                          </div>
                          <p className="text-slate-300 font-mono">{step.rationale}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Citations Footer */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="flex items-center space-x-2 text-[10px] text-slate-500 px-1">
                  <span>Sources:</span>
                  {msg.citations.map((c, i) => (
                    <span key={i} className="text-cyan-400/80 underline cursor-pointer">{c}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center space-x-2 text-slate-400 p-2 text-xs font-mono">
            <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>Diagnosis Specialist and Planner formulating response...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-4 bg-slate-950 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Copilot about health, candidate windows, or maintenance protocols..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-mono font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
