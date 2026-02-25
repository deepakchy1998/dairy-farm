import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import api from '../../utils/api';
import { useNavigate } from 'react-router-dom';
import { FiSend, FiMessageSquare, FiUser, FiTrash2, FiCopy, FiCheck, FiZap, FiClock, FiX } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

const QUICK_ACTIONS = [
  { label: '🥛 Today\'s Milk', msg: 'Aaj ka dudh kitna hai? Give detailed breakdown with morning/evening split' },
  { label: '🐄 Cattle Status', msg: 'Give me complete cattle summary with all categories, breeds, and health status' },
  { label: '💰 Profit & Loss', msg: 'Show this month profit loss with comparison to last month and cost per liter' },
  { label: '💉 Health Alerts', msg: 'Any overdue or upcoming vaccinations? List all with dates and cattle tags' },
  { label: '🐣 Breeding Status', msg: 'Show all active breeding records, expected deliveries, and heat predictions' },
  { label: '📊 Weekly Analysis', msg: 'Analyze my farm performance this week with trends and actionable recommendations' },
  { label: '🌾 Feed Cost', msg: 'Show feed expenses this month by type and suggest optimization' },
  { label: '💡 Improve Profit', msg: 'Analyze my farm data and give me 5 actionable tips to improve profitability' },
  { label: '⚠️ Alerts', msg: '/alerts' },
  { label: '🏆 Top Producers', msg: 'Which cattle are producing the most milk? Show rankings with daily averages' },
  { label: '📉 Low Producers', msg: 'Which cattle have low milk yield? Should I check their health or change feed?' },
  { label: '🔮 Predictions', msg: 'Based on current trends, predict my end-of-month milk production and revenue' },
  { label: '🛡️ Insurance', msg: 'Show my insurance status — any policies expiring soon? Suggest govt schemes I should apply for' },
  { label: '🔥 Heat Calendar', msg: 'Which cattle are due for heat soon? Show predicted heat dates and best breeding windows' },
  { label: '⚖️ Weight Check', msg: 'Show cattle weight status — any underweight or overweight animals that need attention?' },
  { label: '🍼 Lactation', msg: 'Show lactation status of milking cattle — days in milk, who needs dry off, lactation curves' },
  { label: '💊 Disease Risk', msg: 'Based on current season and my cattle health records, what diseases should I watch for?' },
  { label: '📋 Daily Summary', msg: 'Give me a complete daily summary of my farm — milk, health, breeding, finance, alerts — everything' },
  { label: '💵 Milk Rate', msg: 'Calculate my milk payment — what should I get from dairy cooperative based on fat% and SNF%?' },
  { label: '🏥 Vet Schedule', msg: 'Create a vaccination and health checkup schedule for next 30 days for all my cattle' },
];

const FOLLOW_UPS = {
  milk: ['Compare with last week', 'Which cattle gave most today?', 'Show fat% analysis', 'Calculate my milk payment'],
  cattle: ['Show milking cattle details', 'Any cattle need attention?', 'Breed-wise distribution', 'Weight status check'],
  finance: ['How to reduce expenses?', 'Best revenue sources?', 'Cost per liter analysis', 'Monthly trend comparison'],
  health: ['Schedule next vaccinations', 'Common diseases this season', 'Medicine cost analysis', 'Insurance status check'],
  breeding: ['Heat calendar for this week', 'Expected deliveries', 'Breeding success rate', 'Best time for AI'],
  insurance: ['Expiring policies', 'Govt schemes available', 'Claim process help', 'Coverage recommendations'],
  delivery: ['Who has highest dues?', 'This month collection rate', 'Customer wise breakdown', 'Payment reminders to send'],
  employee: ['Who is absent today?', 'Salary due this month', 'Overtime analysis', 'Staff performance review'],
  default: ['Tell me more', 'Give recommendations', 'Compare with last month', 'Create action plan'],
};

function detectContext(lastReply) {
  const lower = (lastReply || '').toLowerCase();
  if (lower.includes('milk') || lower.includes('dudh') || lower.includes('yield')) return 'milk';
  if (lower.includes('cattle') || lower.includes('gaay') || lower.includes('tag')) return 'cattle';
  if (lower.includes('expense') || lower.includes('revenue') || lower.includes('profit') || lower.includes('₹')) return 'finance';
  if (lower.includes('vaccine') || lower.includes('health') || lower.includes('treatment')) return 'health';
  if (lower.includes('breed') || lower.includes('heat') || lower.includes('deliver') || lower.includes('pregnan')) return 'breeding';
  if (lower.includes('insurance') || lower.includes('bima') || lower.includes('policy')) return 'insurance';
  if (lower.includes('customer') || lower.includes('delivery') || lower.includes('khata') || lower.includes('due')) return 'delivery';
  if (lower.includes('employee') || lower.includes('staff') || lower.includes('salary') || lower.includes('attendance')) return 'employee';
  return 'default';
}

export default function Chatbot() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Namaste! 🐄 I'm your **DairyPro AI Assistant** — powered by Google Gemini.\n\nI have real-time access to all your farm data — cattle, milk, health, finance, employees, and Dudh Khata. Ask me anything in **Hindi** or **English**!\n\n**Quick commands:**\n- `/alerts` — Farm alerts\n- `/milk` — Today's milk\n- `/staff` — Employee status\n- `/dues` — Customer dues\n\nOr tap a quick action below 👇", ts: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const [responseTime, setResponseTime] = useState(null);
  const [showAllActions, setShowAllActions] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = useCallback(async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: 'user', content: text, ts: Date.now() };
    const allMsgs = [...messages, userMsg];
    setMessages(allMsgs);
    setInput('');
    setLoading(true);
    setResponseTime(null);
    const startTime = Date.now();

    try {
      const history = allMsgs.slice(-8).map(m => ({ role: m.role, content: m.content }));
      const res = await api.post('/chatbot/ask', { message: text, history });
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      setResponseTime(elapsed);
      const { reply } = res.data.data;
      setMessages(prev => [...prev, { role: 'assistant', content: reply || 'No response.', ts: Date.now() }]);
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong. Please try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${msg}`, ts: Date.now() }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [messages, loading]);

  const clear = () => {
    setMessages([{ role: 'assistant', content: 'Chat cleared! 🐄 Fresh start — ask me anything about your farm.', ts: Date.now() }]);
    setResponseTime(null);
  };

  const copyMsg = (content, idx) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
  const context = detectContext(lastAssistantMsg?.content);
  const followUps = FOLLOW_UPS[context] || FOLLOW_UPS.default;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="p-2.5 bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40 rounded-xl">
              <FiMessageSquare className="text-emerald-600 dark:text-emerald-400" size={22} />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">🐄 DairyPro AI</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Gemini 2.5 Flash • Real-time farm data • Hindi & English
              {responseTime && <span className="ml-2 text-emerald-500">⚡ {responseTime}s</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">{messages.length - 1} messages</span>
          <button onClick={clear} className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition" title="Clear chat">
            <FiTrash2 size={18} />
          </button>
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition" title="Close">
            <FiX size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} group`}>
            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm overflow-hidden ${msg.role === 'user' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30'}`}>
              {msg.role === 'user' ? (user?.profilePhoto ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" /> : <FiUser className="text-blue-600 dark:text-blue-400" size={15} />) : '🐄'}
            </div>
            <div className="relative max-w-[80%]">
              {msg.role === 'user' ? (
                <div className="px-4 py-2.5 rounded-2xl rounded-br-sm bg-blue-600 text-white text-sm whitespace-pre-wrap">{msg.content}</div>
              ) : (
                <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-sm leading-relaxed prose prose-sm prose-emerald dark:prose-invert max-w-none
                  [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:pl-4 [&_ol]:my-1.5 [&_ol]:pl-4
                  [&_li]:text-sm [&_strong]:text-gray-900 dark:[&_strong]:text-white
                  [&_table]:my-2 [&_table]:w-full [&_table]:text-xs
                  [&_th]:bg-emerald-50 dark:[&_th]:bg-emerald-900/30 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:border [&_th]:border-emerald-200 dark:[&_th]:border-emerald-800
                  [&_td]:px-3 [&_td]:py-1.5 [&_td]:border [&_td]:border-gray-200 dark:[&_td]:border-gray-700
                  [&_code]:bg-gray-100 dark:[&_code]:bg-gray-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                ">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )}
              {/* Copy button */}
              {msg.role === 'assistant' && i > 0 && (
                <button
                  onClick={() => copyMsg(msg.content, i)}
                  className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600"
                  title="Copy"
                >
                  {copied === i ? <FiCheck size={12} className="text-green-500" /> : <FiCopy size={12} />}
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center text-sm">🐄</div>
            <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500">Analyzing farm data...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Dynamic follow-up suggestions (after AI responds) */}
      {messages.length > 1 && !loading && (
        <div className="flex flex-wrap gap-2 mt-3">
          <FiZap className="text-amber-500 mt-1" size={14} />
          {followUps.map((s, i) => (
            <button key={i} onClick={() => send(s)}
              className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/30 transition border border-amber-200 dark:border-amber-800">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Quick actions — horizontal scroll */}
      {messages.length <= 3 && (
        <div className="mt-3">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 font-medium uppercase tracking-wider">⚡ Quick Actions</p>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin" style={{ WebkitOverflowScrolling: 'touch' }}>
            {QUICK_ACTIONS.map((a, i) => (
              <button key={i} onClick={() => send(a.msg)} disabled={loading}
                className="flex-shrink-0 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-400 transition border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:border-emerald-300 dark:hover:border-emerald-700 whitespace-nowrap">
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); send(input); }} className="mt-3 flex gap-2">
        <input ref={inputRef} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm" value={input} onChange={e => setInput(e.target.value)}
          placeholder="Ask anything about your farm... (Hindi/English)" disabled={loading} />
        <button type="submit" disabled={loading || !input.trim()} className="btn-primary px-4 flex items-center gap-2">
          <FiSend size={18} />
        </button>
      </form>
    </div>
  );
}
