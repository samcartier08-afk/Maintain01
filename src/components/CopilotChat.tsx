import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  ChevronDown, 
  ChevronRight, 
  ArrowRight,
  ShieldAlert,
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
        "Hello! I am MaintainCopilot, your factory reliability assistant. " +
        "I monitor continuous sensor streams, calculate remaining machine life, and suggest optimal repair windows before unexpected downtime happens. " +
        "How can I help you today?"
      ),
      timestamp: '11:38 AM',
      citations: ['Factory Operating Manual', 'ISO Vibration Severity Standards']
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
    <div className="border border-slate-800/80 rounded-lg overflow-hidden bg-slate-950/60 flex flex-col h-[720px] font-sans text-xs">
      {/* Minimal Chat Header */}
      <div className="px-5 py-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-950">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-white text-sm">
              MaintainCopilot AI Assistant
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400 text-xs">
              Live Machinery Reliability Support
            </span>
          </div>
          <div className="text-xs text-slate-400">
            Answers questions on vibration data, repair schedules, spare parts inventory, and safety rules.
          </div>
        </div>

        <button
          onClick={() => onOpenDecisionBrief(initialAssetId)}
          className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 border border-slate-800 px-3 py-1.5 rounded bg-slate-900 font-medium"
        >
          <span>View Repair Plan</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-5 py-2.5 border-b border-slate-900 bg-slate-950/40 flex items-center space-x-2 overflow-x-auto text-xs scrollbar-none">
        <span className="text-slate-500 uppercase tracking-wider text-[11px] font-mono shrink-0">Try asking:</span>
        <button
          onClick={() => handleSend("What is at risk this week across the fleet?")}
          className="px-2.5 py-1 rounded bg-slate-900 text-slate-300 hover:text-white border border-slate-800 whitespace-nowrap transition-colors"
        >
          Which machines need attention this week?
        </button>
        <button
          onClick={() => handleSend("Explain M-204 bearing vibration and recommended repair window.")}
          className="px-2.5 py-1 rounded bg-slate-900 text-slate-300 hover:text-white border border-slate-800 whitespace-nowrap transition-colors"
        >
          Why is conveyor motor M-204 vibrating?
        </button>
        <button
          onClick={() => handleSend("Can we postpone M-204 repair to the weekend off-peak window?")}
          className="px-2.5 py-1 rounded bg-slate-900 text-slate-300 hover:text-white border border-slate-800 whitespace-nowrap transition-colors"
        >
          Can we wait until Saturday?
        </button>
        <button
          onClick={() => handleSend("Emergency: Shut down conveyor motor M-204 right now!")}
          className="px-2.5 py-1 rounded bg-rose-950/20 text-rose-300 hover:text-rose-200 border border-rose-900/40 whitespace-nowrap transition-colors font-medium"
        >
          Shut down motor M-204 now [Tests Safety Guard]
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isBlocked = msg.blocked;
          const isTraceOpen = expandedTraceId === msg.id;

          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}>
              <div className="flex items-center space-x-2 text-[11px] text-slate-500 px-1">
                <span className="font-medium">{isUser ? 'You (Operator)' : 'MaintainCopilot'}</span>
                <span>·</span>
                <span>{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-xl rounded p-3.5 leading-relaxed whitespace-pre-wrap text-xs ${
                  isUser
                    ? 'bg-slate-800 text-white font-normal'
                    : isBlocked
                    ? 'bg-rose-950/30 border border-rose-900/60 text-rose-200'
                    : 'bg-slate-900/80 border border-slate-800/80 text-slate-200'
                }`}
              >
                {msg.text}
              </div>

              {/* Reasoning Trace Monospace Accordion */}
              {msg.reasoning_trace && msg.reasoning_trace.length > 0 && (
                <div className="max-w-xl w-full border border-slate-800 rounded bg-slate-950 text-xs overflow-hidden mt-1 font-mono">
                  <button
                    onClick={() => setExpandedTraceId(isTraceOpen ? null : msg.id)}
                    className="w-full px-3 py-1.5 text-left flex items-center justify-between text-slate-400 hover:text-slate-200 transition-colors text-[11px]"
                  >
                    <span>View AI Verification Steps ({msg.reasoning_trace.length} checks performed)</span>
                    {isTraceOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>

                  {isTraceOpen && (
                    <div className="p-3 border-t border-slate-900 space-y-2 text-slate-400 text-[11px]">
                      {msg.reasoning_trace.map((step, idx) => (
                        <div key={idx} className="space-y-0.5 border-l-2 border-slate-800 pl-2">
                          <div className="text-cyan-400 font-semibold">
                            Step {step.step}: [{step.agent}]
                          </div>
                          <div className="text-slate-300">{step.rationale}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="flex items-center space-x-2 text-[11px] text-slate-500 px-1">
                  <span>Reference:</span>
                  {msg.citations.map((c, i) => (
                    <span key={i} className="text-cyan-400/90 underline cursor-pointer">{c}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="text-slate-400 text-xs py-2 italic">
            Analyzing telemetry and calculating repair options...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-3.5 border-t border-slate-800/80 bg-slate-950">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about machine health, repair timing, or parts..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed font-medium text-xs"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
