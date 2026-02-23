import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import api from '../../utils/api';
import { FiSend, FiMessageSquare, FiUser, FiTrash2 } from 'react-icons/fi';

const SUGGESTIONS = ["Today's milk", 'How many cattle?', 'This month profit', 'Upcoming vaccinations', 'Farm dashboard', 'Help'];

export default function Chatbot() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello! 🐄 I'm your **DairyPro** farm assistant. Ask me about milk, cattle, health, breeding, finances — in English or Hindi!" },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: 'user', content: text };
    const allMsgs = [...messages, userMsg];
    setMessages(allMsgs);
    setInput('');
    setLoading(true);

    try {
      const history = allMsgs.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const res = await api.post('/chatbot/ask', { message: text, history });
      const { reply } = res.data.data;
      setMessages(prev => [...prev, { role: 'assistant', content: reply || 'No response.' }]);
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong.';
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${msg}` }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const clear = () => {
    setMessages([{ role: 'assistant', content: 'Chat cleared! 🐄 Ask me anything.' }]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 rounded-xl">
            <FiMessageSquare className="text-emerald-600" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">🐄 Farm Assistant</h1>
            <p className="text-xs text-gray-400">Real-time farm data • Hindi & English</p>
          </div>
        </div>
        <button onClick={clear} className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition" title="Clear chat">
          <FiTrash2 size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm ${msg.role === 'user' ? 'bg-blue-100' : 'bg-emerald-100'}`}>
              {msg.role === 'user' ? <FiUser className="text-blue-600" size={15} /> : '🐄'}
            </div>
            {msg.role === 'user' ? (
              <div className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-blue-600 text-white text-sm whitespace-pre-wrap">{msg.content}</div>
            ) : (
              <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-bl-sm bg-gray-50 border border-gray-100 text-gray-800 text-sm leading-relaxed prose prose-sm prose-emerald max-w-none
                [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:pl-4 [&_ol]:my-1.5 [&_ol]:pl-4
                [&_li]:text-sm [&_strong]:text-gray-900
                [&_table]:my-2 [&_table]:w-full [&_table]:text-xs
                [&_th]:bg-emerald-50 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:border [&_th]:border-emerald-200
                [&_td]:px-3 [&_td]:py-1.5 [&_td]:border [&_td]:border-gray-200
              ">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm">🐄</div>
            <div className="bg-gray-50 border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-gray-400">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      <div className="flex flex-wrap gap-2 mt-3">
        {SUGGESTIONS.map((s, i) => (
          <button key={i} onClick={() => send(s)} disabled={loading}
            className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition border border-emerald-200 disabled:opacity-40">
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); send(input); }} className="mt-3 flex gap-2">
        <input ref={inputRef} className="input flex-1" value={input} onChange={e => setInput(e.target.value)}
          placeholder="Ask anything about your farm..." disabled={loading} />
        <button type="submit" disabled={loading || !input.trim()} className="btn-primary px-4">
          <FiSend size={18} />
        </button>
      </form>
    </div>
  );
}
