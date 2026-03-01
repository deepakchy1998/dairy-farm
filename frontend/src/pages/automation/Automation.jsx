import { useState, useEffect, useCallback } from 'react';
import { FiZap, FiPlay, FiRotateCcw, FiCheck, FiAlertTriangle, FiClock, FiCalendar, FiUsers, FiTruck } from 'react-icons/fi';
import { GiMilkCarton } from 'react-icons/gi';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

function AutoCard({ icon: Icon, title, desc, count, done, onRun, onUndo, loading, result, color = 'emerald' }) {
  const remaining = Math.max(0, (count || 0) - (done || 0));
  const allDone = count > 0 && remaining === 0;
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl bg-${color}-50 dark:bg-${color}-900/20`}>
          <Icon className={`text-${color}-600 dark:text-${color}-400`} size={22} />
        </div>
        {allDone && <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full font-medium flex items-center gap-1"><FiCheck size={12} /> Done</span>}
      </div>
      <h3 className="font-bold text-gray-800 dark:text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{desc}</p>

      {count > 0 && (
        <div className="flex items-center gap-3 mb-3 text-xs">
          <span className="text-gray-500">Total: <strong>{count}</strong></span>
          <span className="text-green-600">Done: <strong>{done}</strong></span>
          <span className={remaining > 0 ? 'text-orange-500' : 'text-green-600'}>Remaining: <strong>{remaining}</strong></span>
        </div>
      )}

      {result && (
        <div className={`text-xs mb-3 px-3 py-2 rounded-lg ${result.error ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'}`}>
          {result.error || result.message}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onRun} disabled={loading || allDone}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition
            ${allDone ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed' : `bg-${color}-600 hover:bg-${color}-700 text-white`}
            disabled:opacity-50`}>
          {loading ? <span className="animate-spin">⏳</span> : <FiPlay size={14} />}
          {loading ? 'Running...' : allDone ? 'All Done' : 'Run'}
        </button>
        {done > 0 && onUndo && (
          <button onClick={onUndo} disabled={loading}
            className="px-3 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 hover:border-red-200 transition disabled:opacity-50">
            <FiRotateCcw size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Automation() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState({});
  const [results, setResults] = useState({});
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyResult, setDailyResult] = useState(null);
  const [salaryMonth, setSalaryMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [salaryResult, setSalaryResult] = useState(null);
  const [salaryLoading, setSalaryLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/automation/status');
      setStatus(res.data.data);
    } catch {}
  }, []);

  const fetchPredictions = useCallback(async () => {
    try {
      const res = await api.get('/automation/breeding-predictions');
      setPredictions(res.data.data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchStatus(); fetchPredictions(); }, [fetchStatus, fetchPredictions]);

  const run = async (endpoint, key, body = {}) => {
    setLoading(l => ({ ...l, [key]: true }));
    setResults(r => ({ ...r, [key]: null }));
    try {
      const res = await api.post(`/automation/${endpoint}`, body);
      setResults(r => ({ ...r, [key]: res.data.data }));
      fetchStatus();
    } catch (err) {
      setResults(r => ({ ...r, [key]: { error: err.response?.data?.message || 'Failed' } }));
    } finally {
      setLoading(l => ({ ...l, [key]: false }));
    }
  };

  const undo = async (type, key) => {
    setLoading(l => ({ ...l, [key]: true }));
    try {
      const res = await api.post('/automation/undo', { type });
      setResults(r => ({ ...r, [key]: res.data.data }));
      fetchStatus();
    } catch (err) {
      setResults(r => ({ ...r, [key]: { error: err.response?.data?.message || 'Failed' } }));
    } finally {
      setLoading(l => ({ ...l, [key]: false }));
    }
  };

  const runDaily = async () => {
    setDailyLoading(true);
    setDailyResult(null);
    try {
      const res = await api.post('/automation/run-daily');
      setDailyResult(res.data.data);
      fetchStatus();
    } catch (err) {
      setDailyResult({ error: err.response?.data?.message || 'Failed' });
    } finally {
      setDailyLoading(false);
    }
  };

  const runSalary = async () => {
    setSalaryLoading(true);
    setSalaryResult(null);
    try {
      const res = await api.post('/automation/salary-calculate', { month: salaryMonth });
      setSalaryResult(res.data.data);
    } catch (err) {
      setSalaryResult({ error: err.response?.data?.message || 'Failed' });
    } finally {
      setSalaryLoading(false);
    }
  };

  const avail = status?.available || {};
  const heatPredictions = predictions.filter(p => p.type === 'heat_prediction');
  const dryOffPredictions = predictions.filter(p => p.type === 'dry_off');
  const vaccPredictions = predictions.filter(p => p.type === 'vaccination_due');

  return (
    <div className="max-w-[1100px] mx-auto h-[calc(100vh-8rem)] overflow-y-auto pr-1 scrollbar-thin">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <FiZap className="text-amber-500" /> Smart Automation
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Reduce manual work — one click to fill daily records. All automations are safe & reversible.
          </p>
        </div>
        <button onClick={runDaily} disabled={dailyLoading}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium shadow-lg hover:shadow-xl hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50">
          {dailyLoading ? <span className="animate-spin">⏳</span> : <FiZap size={18} />}
          {dailyLoading ? 'Running All...' : 'Run All Daily Tasks'}
        </button>
      </div>

      {/* Daily result */}
      {dailyResult && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${dailyResult.error ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'}`}>
          {dailyResult.error ? dailyResult.error : (
            <div className="flex flex-wrap gap-4">
              <span>🥛 Milk: <strong>{dailyResult.results?.milk?.created || 0}</strong> records</span>
              <span>👷 Attendance: <strong>{dailyResult.results?.attendance?.created || 0}</strong> marked</span>
              <span>🚚 Delivery: <strong>{dailyResult.results?.delivery?.created || 0}</strong> generated</span>
            </div>
          )}
        </div>
      )}

      {/* Today's automation logs */}
      {status?.todayLogs?.length > 0 && (
        <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <FiClock size={14} /> Today's Automation Log
          </h3>
          <div className="space-y-1.5">
            {status.todayLogs.map((log, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>✅ {log.summary}</span>
                <span className="text-gray-400">{new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Automation Cards */}
      <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-3">📋 Daily Tasks</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <AutoCard
          icon={GiMilkCarton} color="emerald"
          title="Milk Records Pre-fill"
          desc="Copy yesterday's milk yield as today's starting template. You can then adjust individual values."
          count={avail.milkPrefill?.total} done={avail.milkPrefill?.done}
          onRun={() => run('milk-prefill', 'milk')}
          onUndo={() => undo('milk_prefill', 'milk')}
          loading={loading.milk} result={results.milk}
        />
        <AutoCard
          icon={FiUsers} color="blue"
          title="Attendance Pre-fill"
          desc="Mark all active employees as present. Then just change the exceptions (absent, half-day, leave)."
          count={avail.attendance?.total} done={avail.attendance?.done}
          onRun={() => run('attendance-prefill', 'attendance')}
          onUndo={() => undo('attendance_prefill', 'attendance')}
          loading={loading.attendance} result={results.attendance}
        />
        <AutoCard
          icon={FiTruck} color="purple"
          title="Milk Delivery"
          desc="Auto-generate today's deliveries for all active customers based on their daily quantity & rate."
          count={avail.delivery?.total} done={avail.delivery?.done}
          onRun={() => run('delivery-generate', 'delivery', { session: 'morning' })}
          onUndo={() => undo('delivery_generate', 'delivery')}
          loading={loading.delivery} result={results.delivery}
        />
      </div>

      {/* Monthly Tasks */}
      <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-3">📅 Monthly Tasks</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Salary Calculator */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/20">
              <FiCalendar className="text-teal-600 dark:text-teal-400" size={22} />
            </div>
          </div>
          <h3 className="font-bold text-gray-800 dark:text-white mb-1">Salary Calculator</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Auto-calculate salary for all employees based on attendance, overtime & advances.
          </p>
          <div className="flex gap-2 mb-3">
            <input type="month" value={salaryMonth} onChange={e => setSalaryMonth(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-white" />
            <button onClick={runSalary} disabled={salaryLoading}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
              {salaryLoading ? '⏳' : 'Calculate'}
            </button>
          </div>
          {salaryResult && (
            <div className={`text-xs px-3 py-2 rounded-lg ${salaryResult.error ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'}`}>
              {salaryResult.error || salaryResult.message}
            </div>
          )}
        </div>

        {/* Customer Bills */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
              <FiUsers className="text-indigo-600 dark:text-indigo-400" size={22} />
            </div>
          </div>
          <h3 className="font-bold text-gray-800 dark:text-white mb-1">Customer Bills</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Auto-generated monthly bill summary for all milk delivery customers.
          </p>
          <a href="/milk-delivery" className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition">
            View in Dudh Khata →
          </a>
        </div>
      </div>

      {/* Smart Predictions */}
      {predictions.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-3">🔮 Smart Predictions & Reminders</h2>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden mb-8 max-h-[50vh] overflow-y-auto scrollbar-thin">
            {/* Heat Predictions */}
            {heatPredictions.length > 0 && (
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <h4 className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-2">🔥 Predicted Heat Dates</h4>
                <div className="space-y-2">
                  {heatPredictions.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">
                        <strong>Tag {p.tagNumber}</strong> ({p.breed})
                      </span>
                      <div className="text-right">
                        <span className={`font-medium ${p.daysFromNow <= 3 ? 'text-red-600' : p.daysFromNow <= 7 ? 'text-orange-500' : 'text-gray-500'}`}>
                          {p.daysFromNow <= 0 ? 'Today!' : `In ${p.daysFromNow} days`}
                        </span>
                        <span className="text-xs text-gray-400 ml-2">{new Date(p.predictedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">Based on 21-day heat cycle calculation</p>
              </div>
            )}

            {/* Dry Off Reminders */}
            {dryOffPredictions.length > 0 && (
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <h4 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-2">🤰 Dry-Off Reminders</h4>
                <div className="space-y-2">
                  {dryOffPredictions.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">
                        <strong>Tag {p.tagNumber}</strong> — delivery {new Date(p.deliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                      <span className={`font-medium ${p.daysFromNow <= 0 ? 'text-red-600' : p.daysFromNow <= 7 ? 'text-orange-500' : 'text-blue-500'}`}>
                        {p.daysFromNow <= 0 ? '⚠️ Dry off NOW' : `Dry off in ${p.daysFromNow}d`}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">Dry off recommended 60 days before expected delivery</p>
              </div>
            )}

            {/* Vaccination Due */}
            {vaccPredictions.length > 0 && (
              <div className="p-4">
                <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">💉 Upcoming Vaccinations</h4>
                <div className="space-y-2">
                  {vaccPredictions.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">
                        <strong>Tag {p.tagNumber}</strong> — {p.description}
                      </span>
                      <span className={`font-medium ${p.daysFromNow <= 2 ? 'text-red-600' : 'text-blue-500'}`}>
                        {p.daysFromNow <= 0 ? 'Today!' : `In ${p.daysFromNow} days`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Info */}
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-400">
        <h3 className="font-semibold mb-2">ℹ️ How Automation Works</h3>
        <ul className="space-y-1 text-xs">
          <li>✅ <strong>Safe:</strong> Automations never overwrite existing records — they only fill missing ones</li>
          <li>✅ <strong>Reversible:</strong> Click ↺ to undo any automation for today</li>
          <li>✅ <strong>Smart:</strong> Skips inactive cattle, resigned employees, paused customers</li>
          <li>✅ <strong>Editable:</strong> After auto-fill, you can manually adjust any individual record</li>
          <li>💡 <strong>Tip:</strong> Click "Run All Daily Tasks" each morning to fill everything in one click!</li>
        </ul>
      </div>
    </div>
  );
}
