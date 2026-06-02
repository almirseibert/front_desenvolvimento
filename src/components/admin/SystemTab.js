import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, AlertTriangle, Megaphone, List, Monitor,
  Download, LogOut, RefreshCw, CheckCircle, XCircle, HelpCircle,
} from 'lucide-react';
import apiClient from '../../services/apiClient';

const STATUS_CONFIG = {
  ok:       { icon: <CheckCircle size={16} className="text-green-500" />, badge: 'bg-green-100 text-green-700', label: 'Online' },
  error:    { icon: <XCircle size={16} className="text-red-500" />,     badge: 'bg-red-100 text-red-700',   label: 'Erro' },
  unknown:  { icon: <HelpCircle size={16} className="text-gray-400" />, badge: 'bg-gray-100 text-gray-500', label: 'Desconhecido' },
  checking: { icon: <RefreshCw size={16} className="animate-spin text-yellow-500" />, badge: 'bg-yellow-50 text-yellow-600', label: 'Verificando...' },
};

const EXPORT_MODULES = [
  { key: 'vehicles',  label: 'Veículos' },
  { key: 'obras',     label: 'Obras' },
  { key: 'employees', label: 'Funcionários' },
  { key: 'refuelings',label: 'Abastecimentos' },
  { key: 'revisions', label: 'Revisões' },
  { key: 'fines',     label: 'Multas' },
  { key: 'tires',     label: 'Pneus' },
  { key: 'orders',    label: 'Ordens C/S' },
];

const SystemTab = () => {
  // System message
  const [updateMessage, setUpdateMessage] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [savingMsg, setSavingMsg] = useState(false);

  // Health
  const [health, setHealth] = useState({ api: 'unknown', whatsapp: 'unknown', socket: 'unknown' });
  const [checking, setChecking] = useState(false);
  const [usageStats, setUsageStats] = useState(null);

  // Broadcast
  const [broadcast, setBroadcast] = useState({ message: '', target: 'all', channels: [] });
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Audit log
  const [auditLog, setAuditLog] = useState([]);
  const [auditFilter, setAuditFilter] = useState({ period: '7d', user: '', module: '' });
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    fetchUpdateMessage();
    checkHealth();
    fetchSessions();
  }, []);

  const fetchUpdateMessage = async () => {
    try {
      const d = await apiClient.adminGetUpdateMessage();
      if (d) { setUpdateMessage(d.message || ''); setShowPopup(d.showPopup || false); }
    } catch (_) {}
  };

  const handleSaveMessage = async (e) => {
    e.preventDefault();
    setSavingMsg(true);
    try {
      await apiClient.adminSaveUpdateMessage({ message: updateMessage, showPopup: showPopup });
      alert('Mensagem salva com sucesso!');
    } catch (_) {
      alert('Erro ao salvar mensagem.');
    } finally {
      setSavingMsg(false);
    }
  };

  const checkHealth = useCallback(async () => {
    setChecking(true);
    setHealth({ api: 'checking', whatsapp: 'checking', socket: 'checking' });
    try {
      const d = await apiClient.adminGetSystemHealth();
      setHealth(d || { api: 'ok', whatsapp: 'unknown', socket: 'unknown' });
      setUsageStats(d?.usage || null);
    } catch (_) {
      setHealth({ api: 'ok', whatsapp: 'unknown', socket: 'unknown' });
    } finally {
      setChecking(false);
    }
  }, []);

  const fetchAuditLog = async () => {
    setLoadingAudit(true);
    try {
      const d = await apiClient.adminGetAuditLog(auditFilter);
      setAuditLog(d || []);
    } catch (_) {
      setAuditLog([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const d = await apiClient.adminGetActiveSessions();
      setSessions(d || []);
    } catch (_) {
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleForceLogout = async (sessionId) => {
    if (!window.confirm('Forçar logout desta sessão?')) return;
    try {
      await apiClient.adminForceLogout(sessionId);
      fetchSessions();
    } catch (_) {
      alert('Disponível em breve (backend pendente).');
    }
  };

  const handleExport = async (module) => {
    try {
      const data = await apiClient.adminExportData(module);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${module}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) {
      alert('Disponível em breve (backend pendente).');
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcast.message) { alert('Digite uma mensagem.'); return; }
    if (broadcast.channels.length === 0) { alert('Selecione ao menos um canal.'); return; }
    setSendingBroadcast(true);
    try {
      await apiClient.adminBroadcast(broadcast);
      alert('Broadcast enviado com sucesso!');
      setBroadcast({ message: '', target: 'all', channels: [] });
    } catch (_) {
      alert('Disponível em breve (backend pendente).');
    } finally {
      setSendingBroadcast(false);
    }
  };

  const toggleChannel = (ch) =>
    setBroadcast(p => ({
      ...p,
      channels: p.channels.includes(ch) ? p.channels.filter(c => c !== ch) : [...p.channels, ch],
    }));

  const ACTION_BADGE = {
    create: 'bg-green-100 text-green-700',
    update: 'bg-blue-100 text-blue-700',
    delete: 'bg-red-100 text-red-700',
    login:  'bg-purple-100 text-purple-700',
  };

  const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
    return (
      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cfg.badge}`}>
        {cfg.icon} {cfg.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">

      {/* Health Check */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Activity size={18} className="text-green-500" /> Status do Sistema
          </h3>
          <button
            onClick={checkHealth}
            disabled={checking}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
          >
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'API Backend', key: 'api', desc: 'Servidor principal de dados' },
            { label: 'WhatsApp Bot', key: 'whatsapp', desc: 'Serviço de mensagens automáticas' },
            { label: 'Socket.io', key: 'socket', desc: 'Eventos em tempo real' },
          ].map(s => (
            <div key={s.key} className="p-4 border border-gray-100 rounded-lg flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-gray-800">{s.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
              </div>
              <StatusBadge status={checking ? 'checking' : health[s.key]} />
            </div>
          ))}
        </div>

        {usageStats && (
          <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { label: 'Usuários Ativos', value: usageStats.activeUsers },
              { label: 'Sessões Hoje', value: usageStats.todaySessions },
              { label: 'Req/hora', value: usageStats.requestsPerHour },
              { label: 'Uptime', value: usageStats.uptime },
            ].map(s => (
              <div key={s.label}>
                <div className="text-2xl font-bold text-gray-800">{s.value ?? '-'}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mensagem Global */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-5">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-orange-500" /> Mensagem Global do Sistema
        </h3>
        <form onSubmit={handleSaveMessage} className="space-y-3">
          <textarea
            rows={4}
            value={updateMessage}
            onChange={e => setUpdateMessage(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 outline-none resize-none"
            placeholder="Ex: Manutenção programada para sábado às 22h. O sistema ficará indisponível por 2 horas."
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPopup}
                onChange={e => setShowPopup(e.target.checked)}
                className="h-4 w-4 text-gray-800 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Exibir como pop-up na tela inicial</span>
            </label>
            <button
              type="submit"
              disabled={savingMsg}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg text-sm disabled:opacity-50 transition-colors"
            >
              {savingMsg ? 'Salvando...' : 'Salvar Mensagem'}
            </button>
          </div>
        </form>
      </div>

      {/* Broadcast */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-5">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Megaphone size={18} className="text-blue-500" /> Envio de Broadcast
        </h3>
        <form onSubmit={handleBroadcast} className="space-y-4">
          <textarea
            rows={3}
            value={broadcast.message}
            onChange={e => setBroadcast(p => ({ ...p, message: e.target.value }))}
            className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none resize-none"
            placeholder="Mensagem de broadcast para usuários selecionados..."
          />
          <div className="flex flex-wrap gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destinatários</label>
              <select
                value={broadcast.target}
                onChange={e => setBroadcast(p => ({ ...p, target: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-yellow-400 outline-none"
              >
                <option value="all">Todos os usuários</option>
                <option value="admin">Somente Admins</option>
                <option value="editor">Somente Editores</option>
                <option value="viewer">Somente Visualizadores</option>
                <option value="operador">Somente Operadores</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Canais de envio</label>
              <div className="flex gap-4">
                {[
                  { key: 'whatsapp', label: 'WhatsApp', color: 'text-green-600' },
                  { key: 'email', label: 'E-mail', color: 'text-blue-600' },
                  { key: 'inapp', label: 'In-app', color: 'text-purple-600' },
                ].map(ch => (
                  <label key={ch.key} className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={broadcast.channels.includes(ch.key)}
                      onChange={() => toggleChannel(ch.key)}
                      className="h-4 w-4 text-yellow-500 rounded border-gray-300 focus:ring-yellow-400"
                    />
                    <span className={`text-sm font-medium ${ch.color}`}>{ch.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={sendingBroadcast}
            className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg text-sm disabled:opacity-50 transition-colors"
          >
            {sendingBroadcast ? 'Enviando...' : 'Enviar Broadcast'}
          </button>
        </form>
      </div>

      {/* Log de Auditoria */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <List size={18} className="text-gray-500" /> Log de Auditoria
          </h3>
        </div>
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={auditFilter.period}
            onChange={e => setAuditFilter(p => ({ ...p, period: e.target.value }))}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-yellow-400 outline-none"
          >
            <option value="1d">Últimas 24h</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>
          <input
            value={auditFilter.user}
            onChange={e => setAuditFilter(p => ({ ...p, user: e.target.value }))}
            placeholder="Filtrar por usuário..."
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none flex-1 min-w-32"
          />
          <input
            value={auditFilter.module}
            onChange={e => setAuditFilter(p => ({ ...p, module: e.target.value }))}
            placeholder="Filtrar por módulo..."
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none flex-1 min-w-32"
          />
          <button
            onClick={fetchAuditLog}
            className="px-3 py-1.5 bg-yellow-400 hover:bg-[#fdf8f0]0 text-gray-900 font-bold rounded-lg text-sm transition-colors"
          >
            Filtrar
          </button>
        </div>

        {loadingAudit ? (
          <div className="text-center py-6 text-gray-400 text-sm">Carregando...</div>
        ) : auditLog.length === 0 ? (
          <div className="text-center py-10 text-gray-300">
            <List size={36} className="mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">Log de Auditoria</p>
            <p className="text-xs text-gray-300 mt-1">Disponível após implementação no backend. Registrará todas as ações dos usuários.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <th className="p-3 text-left font-semibold">Data/Hora</th>
                  <th className="p-3 text-left font-semibold">Usuário</th>
                  <th className="p-3 text-center font-semibold">Ação</th>
                  <th className="p-3 text-left font-semibold">Módulo</th>
                  <th className="p-3 text-left font-semibold">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((entry, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="p-3 text-xs text-gray-400">{new Date(entry.timestamp).toLocaleString('pt-BR')}</td>
                    <td className="p-3 text-gray-800 font-medium">{entry.user}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${ACTION_BADGE[entry.action] || 'bg-gray-100 text-gray-600'}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600">{entry.module}</td>
                    <td className="p-3 text-xs text-gray-400">{entry.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sessões Ativas */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Monitor size={18} className="text-indigo-500" /> Sessões Ativas
          </h3>
          <button
            onClick={fetchSessions}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
          >
            <RefreshCw size={14} className={loadingSessions ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>

        {loadingSessions ? (
          <div className="text-center py-6 text-gray-400 text-sm">Carregando...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-10 text-gray-300">
            <Monitor size={32} className="mx-auto mb-2" />
            <p className="text-sm text-gray-400">Gestão de sessões disponível após implementação no backend.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <th className="p-3 text-left font-semibold">Usuário</th>
                  <th className="p-3 text-left font-semibold">Dispositivo</th>
                  <th className="p-3 text-left font-semibold">IP</th>
                  <th className="p-3 text-left font-semibold">Desde</th>
                  <th className="p-3 text-center font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-800">{s.user}</td>
                    <td className="p-3 text-xs text-gray-500">{s.device || 'Browser'}</td>
                    <td className="p-3 text-xs text-gray-400">{s.ip}</td>
                    <td className="p-3 text-xs text-gray-400">{new Date(s.startedAt).toLocaleString('pt-BR')}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleForceLogout(s.id)}
                        className="flex items-center gap-1 px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs font-bold mx-auto transition-colors"
                      >
                        <LogOut size={12} /> Desconectar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Backup & Export */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-5">
        <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
          <Download size={18} className="text-gray-500" /> Backup & Exportação
        </h3>
        <p className="text-sm text-gray-400 mb-4">Exporte dados em formato JSON para backup ou migração.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {EXPORT_MODULES.map(m => (
            <button
              key={m.key}
              onClick={() => handleExport(m.key)}
              className="flex items-center justify-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 text-sm text-gray-700 font-medium transition-colors"
            >
              <Download size={14} className="text-gray-400" /> {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SystemTab;

