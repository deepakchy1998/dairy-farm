import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { FiX, FiSend } from 'react-icons/fi';
import api from '../utils/api';
import useDraggable from '../hooks/useDraggable';
import { useAuth } from '../context/AuthContext';
import { useAppConfig } from '../context/AppConfigContext';

const DEFAULT_SUGGESTIONS = ["How is my farm doing?", 'Analyze milk production', 'Which cattle need attention?', 'How to increase profit?'];

export default function ChatBubble() {
  const [open, setOpen] = useState(false);
  const appConfig = useAppConfig();
  const suggestions = appConfig.chatbotSuggestions?.length ? appConfig.chatbotSuggestions : DEFAULT_SUGGESTIONS;
  const chatbotName = appConfig.chatbotName || 'DairyPro AI';
  const chatbotWelcome = appConfig.chatbotWelcome || "Namaste! 🐄 I have full access to your farm — cattle, milk, health, finance, staff & customers. Ask anything!";
  const [messages, setMessages] = useState([
    { role: 'assistant', content: chatbotWelcome },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewportH, setViewportH] = useState(window.innerHeight);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const { user } = useAuth();

  // If chatbot bubble is disabled globally by admin OR by the user personally, don't render
  if (appConfig.chatBubbleEnabled === false) return null;
  if (user?.chatBubbleEnabled === false) return null;
  const { ref: btnRef, style: btnStyle, handlers: btnHandlers, hasMoved: btnHasMoved } = useDraggable({ x: null, y: null });

  // Track viewport height changes (keyboard open/close on mobile)
  useEffect(() => {
    const onResize = () => setViewportH(window.visualViewport?.height || window.innerHeight);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', onResize);
      vv.addEventListener('scroll', onResize);
    }
    window.addEventListener('resize', onResize);
    return () => {
      if (vv) {
        vv.removeEventListener('resize', onResize);
        vv.removeEventListener('scroll', onResize);
      }
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const send = async (text) => {
    if (!text.trim() || loading) return;
    const allMsgs = [...messages, { role: 'user', content: text }];
    setMessages(allMsgs);
    setInput('');
    setLoading(true);

    try {
      const history = allMsgs.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const res = await api.post('/chatbot/ask', { message: text, history });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.data?.reply || 'No response.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Something went wrong.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleBtnClick = () => {
    if (btnHasMoved.current) { btnHasMoved.current = false; return; }
    setOpen(prev => !prev);
  };

  return (
    <>
      {/* Draggable floating button — hidden when chat is open */}
      {!open && (
      <div
        ref={btnRef}
        {...btnHandlers}
        onClick={handleBtnClick}
        style={{ ...btnStyle, zIndex: 10000, touchAction: 'none', cursor: 'grab' }}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center select-none active:cursor-grabbing"
        title="Farm Assistant — drag to move"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
          <path d="M9 22h6" /><path d="M10 22v-1" /><path d="M14 22v-1" />
          <circle cx="10" cy="9" r="1" fill="currentColor" /><circle cx="14" cy="9" r="1" fill="currentColor" />
        </svg>
        {!open && <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-20" />}
      </div>
      )}

      {/* Chat panel — adapts to keyboard on mobile */}
      {open && (
        <div
          className="fixed z-[9999] bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden
            bottom-0 right-0 left-0 rounded-t-2xl
            sm:bottom-6 sm:right-6 sm:left-auto sm:rounded-2xl sm:w-[380px]"
          style={{ height: `${Math.min(viewportH, 520)}px`, maxHeight: `${viewportH}px` }}
        >
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"><span className="text-lg">🤖</span></div>
              <div>
                <p className="text-white font-semibold text-sm">{chatbotName}</p>
                <p className="text-emerald-100 text-xs">AI Farm Advisor</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white p-1"><FiX size={20} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50 dark:bg-gray-950">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'user' ? (
                  <div className="flex items-end gap-1.5 max-w-[85%] flex-row-reverse">
                    {user?.profilePhoto ? (
                      <img src={user.profilePhoto} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                    ) : null}
                    <div className="px-3 py-2 rounded-2xl rounded-br-sm bg-emerald-600 text-white text-sm">{m.content}</div>
                  </div>
                ) : (
                  <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700 shadow-sm text-sm prose prose-sm prose-emerald dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-3.5 [&_li]:text-sm [&_strong]:text-gray-900 dark:[&_strong]:text-white">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {messages.length <= 2 && (
            <div className="px-3 py-2 flex gap-1.5 flex-wrap border-t dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
              {suggestions.map(s => (
                <button key={s} onClick={() => send(s)} className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[11px] rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800">{s}</button>
              ))}
            </div>
          )}

          <div className="p-3 border-t dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center gap-2 flex-shrink-0">
            <input ref={inputRef} type="text"
              className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300"
              placeholder="Ask anything..." value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && send(input)} disabled={loading} />
            <button onClick={() => send(input)} disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-40 transition">
              <FiSend size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
