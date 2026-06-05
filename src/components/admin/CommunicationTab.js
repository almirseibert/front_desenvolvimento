import React, { useState, useEffect } from 'react';
import { MessageSquare, Mail, Users, FileText, Trash2, Plus, Eye, EyeOff } from 'lucide-react';
import WhatsAppStatusPanel from '../WhatsAppStatusPanel';
import apiClient from '../../services/apiClient';

const AREAS = [
  { id: 'obras', label: 'Obras', events: ['Nova obra criada', 'Obra encerrada', 'Alerta de prazo', 'Obra iniciada', 'Veículo alocado'] },
  { id: 'abastecimento', label: 'Abastecimento', events: ['Solicitação pendente', 'Abastecimento aprovado', 'Abastecimento rejeitado', 'Alerta de consumo elevado'] },
  { id: 'manutencoes', label: 'Manutenções', events: ['Revisão vencida', 'OS aberta', 'OS concluída', 'Veículo em manutenção', 'Veículo liberado'] },
  { id: 'frota', label: 'Frota / Veículos', events: ['Km sem atualizar (15 dias)', 'CRLV vencendo', 'Seguro vencendo', 'Tacógrafo vencendo', 'Veículo inativo'] },
  { id: 'estoque', label: 'Estoque', events: ['Item abaixo do mínimo', 'Item sem movimentação', 'Pedido de compra gerado', 'Entrada de material'] },
  { id: 'multas', label: 'Multas', events: ['Nova multa registrada', 'Prazo de recurso vencendo', 'Multa paga'] },
  { id: 'faturamento', label: 'Faturamento', events: ['Relatório diário gerado', 'Inconsistência detectada', 'Fechamento mensal'] },
  { id: 'pneus', label: 'Pneus', events: ['Pneu com desgaste crítico', 'Rodízio pendente', 'Pneu substituído'] },
  { id: 'funcionarios', label: 'Funcionários', events: ['CNH vencendo', 'ASO vencendo', 'Funcionário inativo (30 dias)'] },
];

const CHANNELS = [
  { key: 'whatsapp', label: 'WhatsApp', color: 'text-green-600' },
  { key: 'email', label: 'E-mail', color: 'text-blue-600' },
  { key: 'inapp', label: 'In-app', color: 'text-purple-600' },
];

const defaultRouting = () =>
  AREAS.reduce((acc, a) => ({
    ...acc,
    [a.id]: { managers: [], events: [], channels: { whatsapp: false, email: false, inapp: false } },
  }), {});

const SUB_TABS = [
  { id: 'whatsapp', label: 'WhatsApp', icon: <MessageSquare size={14} /> },
  { id: 'email', label: 'E-mail (SMTP)', icon: <Mail size={14} /> },
  { id: 'gestores', label: 'Gestores de Área', icon: <Users size={14} /> },
  { id: 'templates', label: 'Templates', icon: <FileText size={14} /> },
];

const CommunicationTab = ({ socket, users = [] }) => {
  const [subTab, setSubTab] = useState('whatsapp');

  // Email config
  const [emailConfig, setEmailConfig] = useState({
    host: '', port: 587, user: '', password: '',
    fromAddress: '', fromName: '', tls: true,
  });
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Routing
  const [routing, setRouting] = useState(defaultRouting());
  const [savingRouting, setSavingRouting] = useState(false);

  // Templates
  const [templates, setTemplates] = useState([]);
  const [newTpl, setNewTpl] = useState({ name: '', channel: 'whatsapp', content: '' });
  const [savingTpl, setSavingTpl] = useState(false);

  useEffect(() => {
    loadEmailConfig();
    loadRouting();
    loadTemplates();
  }, []);

  const setEmail = (field, value) => setEmailConfig(p => ({ ...p, [field]: value }));

  const loadEmailConfig = async () => {
    try { const d = await apiClient.adminGetEmailConfig(); if (d) setEmailConfig(d); } catch (_) {}
  };
  const loadRouting = async () => {
    try { const d = await apiClient.adminGetNotificationRouting(); if (d) setRouting(d); } catch (_) {}
  };
  const loadTemplates = async () => {
    try { const d = await apiClient.adminGetMessageTemplates(); if (d) setTemplates(d); } catch (_) {}
  };

  const handleSaveEmail = async (e) => {
    e.preventDefault();
    setSavingEmail(true);
    try {
      await apiClient.adminSaveEmailConfig(emailConfig);
      setEmailMsg('ok');
    } catch (err) {
      setEmailMsg(err.message || 'error');
    } finally {
      setSavingEmail(false);
      setTimeout(() => setEmailMsg(''), 3000);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) return;
    setSendingTest(true);
    try {
      const result = await apiClient.adminSendTestEmail({ to: testEmail });
      const linhas = [
        `✅ ${result.message || 'E-mail aceito pelo SMTP.'}`,
        result.from        ? `De: ${result.from}`                          : null,
        result.to          ? `Para: ${result.to}`                          : null,
        result.messageId   ? `Message-ID: ${result.messageId}`             : null,
        result.response    ? `Resposta SMTP: ${result.response}`           : null,
        result.accepted    ? `Aceitos: ${result.accepted.join(', ')}`      : null,
        result.dica        ? `\n💡 ${result.dica}`                          : null,
      ].filter(Boolean);
      alert(linhas.join('\n'));
    } catch (err) {
      alert(`❌ Falha ao enviar e-mail de teste:\n\n${err.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  const handleSaveRouting = async () => {
    setSavingRouting(true);
    try {
      await apiClient.adminSaveNotificationRouting(routing);
      alert('Configuração de notificações salva!');
    } catch (_) {
      alert('Funcionalidade disponível em breve (backend pendente).');
    } finally {
      setSavingRouting(false);
    }
  };

  const updateManagers = (areaId, managers) =>
    setRouting(p => ({ ...p, [areaId]: { ...p[areaId], managers } }));

  const toggleEvent = (areaId, ev) =>
    setRouting(p => {
      const evs = p[areaId].events;
      return { ...p, [areaId]: { ...p[areaId], events: evs.includes(ev) ? evs.filter(e => e !== ev) : [...evs, ev] } };
    });

  const toggleChannel = (areaId, ch) =>
    setRouting(p => ({
      ...p,
      [areaId]: { ...p[areaId], channels: { ...p[areaId].channels, [ch]: !p[areaId].channels[ch] } },
    }));

  const handleAddTemplate = async (e) => {
    e.preventDefault();
    setSavingTpl(true);
    try {
      const saved = await apiClient.adminCreateMessageTemplate(newTpl);
      setTemplates(p => [...p, saved || { ...newTpl, id: Date.now() }]);
    } catch (_) {
      setTemplates(p => [...p, { ...newTpl, id: Date.now() }]);
    } finally {
      setNewTpl({ name: '', channel: 'whatsapp', content: '' });
      setSavingTpl(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Remover este template?')) return;
    try { await apiClient.adminDeleteMessageTemplate(id); } catch (_) {}
    setTemplates(p => p.filter(t => t.id !== id));
  };

  const CHANNEL_BADGE = { whatsapp: 'bg-green-100 text-green-700', email: 'bg-blue-100 text-blue-700', inapp: 'bg-purple-100 text-purple-700' };

  return (
    <div className="space-y-4">
      {/* Sub-tab pills */}
      <div className="flex gap-2 flex-wrap">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              subTab === t.id
                ? 'bg-gray-800 text-white shadow'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* WhatsApp */}
      {subTab === 'whatsapp' && <WhatsAppStatusPanel socket={socket} />}

      {/* E-mail SMTP */}
      {subTab === 'email' && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-5">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Mail size={18} className="text-blue-500" /> Configuração de E-mail (SMTP)
          </h3>

          <form onSubmit={handleSaveEmail} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Host SMTP</label>
                <input value={emailConfig.host} onChange={e => setEmail('host', e.target.value)} placeholder="smtp.gmail.com" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Porta</label>
                <input type="number" value={emailConfig.port} onChange={e => setEmail('port', Number(e.target.value))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuário SMTP</label>
                <input value={emailConfig.user} onChange={e => setEmail('user', e.target.value)} placeholder="usuario@empresa.com" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                <div className="relative">
                  <input type={showSmtpPass ? 'text' : 'password'} value={emailConfig.password} onChange={e => setEmail('password', e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none" />
                  <button type="button" onClick={() => setShowSmtpPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showSmtpPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço "De:"</label>
                <input value={emailConfig.fromAddress} onChange={e => setEmail('fromAddress', e.target.value)} placeholder="sistema@empresa.com" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Remetente</label>
                <input value={emailConfig.fromName} onChange={e => setEmail('fromName', e.target.value)} placeholder="MAK Frotas" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none" />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={emailConfig.tls} onChange={e => setEmail('tls', e.target.checked)} className="h-4 w-4 text-yellow-500 rounded border-gray-300 focus:ring-yellow-400" />
              <span className="text-sm text-gray-700">Usar TLS/SSL</span>
            </label>

            {emailMsg === 'ok' && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded px-3 py-2">Configuração salva com sucesso!</p>}
            {emailMsg && emailMsg !== 'ok' && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">Erro ao salvar: {emailMsg}</p>}

            <button type="submit" disabled={savingEmail} className="px-5 py-2 bg-yellow-400 hover:bg-[#fdf8f0]0 text-gray-900 font-bold rounded-lg text-sm disabled:opacity-50 transition-colors">
              {savingEmail ? 'Salvando...' : 'Salvar Configuração'}
            </button>
          </form>

          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Enviar E-mail de Teste</h4>
            <div className="flex gap-3">
              <input
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="destinatario@teste.com"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none"
              />
              <button
                onClick={handleTestEmail}
                disabled={sendingTest || !testEmail}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {sendingTest ? 'Enviando...' : 'Enviar Teste'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gestores de Área */}
      {subTab === 'gestores' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Users size={18} className="text-yellow-500" /> Roteamento de Notificações por Área
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Configure gestores, eventos e canais de notificação por área do sistema.</p>
            </div>
            <button
              onClick={handleSaveRouting}
              disabled={savingRouting}
              className="px-4 py-2 bg-yellow-400 hover:bg-[#fdf8f0]0 text-gray-900 font-bold rounded-lg text-sm disabled:opacity-50 transition-colors"
            >
              {savingRouting ? 'Salvando...' : 'Salvar Configuração'}
            </button>
          </div>

          {AREAS.map(area => (
            <div key={area.id} className="bg-white rounded-lg shadow border border-gray-200 p-4">
              <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">{area.label}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Gestor(es)</label>
                  <select
                    multiple
                    value={routing[area.id]?.managers || []}
                    onChange={e => updateManagers(area.id, Array.from(e.target.selectedOptions).map(o => o.value))}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-yellow-400 outline-none h-28"
                  >
                    {users.map(u => (
                      <option key={u.id} value={String(u.id)}>{u.name || u.email}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Ctrl+clique para múltiplos</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Eventos que notificam</label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {area.events.map(ev => (
                      <label key={ev} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={(routing[area.id]?.events || []).includes(ev)}
                          onChange={() => toggleEvent(area.id, ev)}
                          className="h-3.5 w-3.5 text-yellow-500 rounded border-gray-300 focus:ring-yellow-400"
                        />
                        <span className="text-xs text-gray-700">{ev}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Canais de envio</label>
                  <div className="space-y-2.5">
                    {CHANNELS.map(ch => (
                      <label key={ch.key} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={routing[area.id]?.channels?.[ch.key] || false}
                          onChange={() => toggleChannel(area.id, ch.key)}
                          className="h-4 w-4 text-yellow-500 rounded border-gray-300 focus:ring-yellow-400"
                        />
                        <span className={`text-sm font-medium ${ch.color}`}>{ch.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Templates de Mensagens */}
      {subTab === 'templates' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-5">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Plus size={16} className="text-yellow-500" /> Novo Template
            </h3>
            <form onSubmit={handleAddTemplate} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do template</label>
                  <input
                    value={newTpl.name}
                    onChange={e => setNewTpl(p => ({ ...p, name: e.target.value }))}
                    required
                    placeholder="Ex: Manutenção Vencida"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Canal</label>
                  <select
                    value={newTpl.channel}
                    onChange={e => setNewTpl(p => ({ ...p, channel: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-yellow-400 outline-none"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option>
                    <option value="inapp">In-app</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conteúdo</label>
                <textarea
                  value={newTpl.content}
                  onChange={e => setNewTpl(p => ({ ...p, content: e.target.value }))}
                  required
                  rows={3}
                  placeholder="Ex: Olá {{responsavel}}, o veículo {{veiculo}} está com manutenção vencida desde {{data}}."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Variáveis: <code className="bg-gray-100 px-1 rounded">{'{{veiculo}}'}</code>{' '}
                  <code className="bg-gray-100 px-1 rounded">{'{{obra}}'}</code>{' '}
                  <code className="bg-gray-100 px-1 rounded">{'{{data}}'}</code>{' '}
                  <code className="bg-gray-100 px-1 rounded">{'{{responsavel}}'}</code>{' '}
                  <code className="bg-gray-100 px-1 rounded">{'{{valor}}'}</code>
                </p>
              </div>
              <button type="submit" disabled={savingTpl} className="px-4 py-2 bg-yellow-400 hover:bg-[#fdf8f0]0 text-gray-900 font-bold rounded-lg text-sm disabled:opacity-50 transition-colors">
                {savingTpl ? 'Adicionando...' : 'Adicionar Template'}
              </button>
            </form>
          </div>

          {templates.length > 0 && (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-5">
              <h3 className="font-bold text-gray-800 mb-4">Templates Cadastrados ({templates.length})</h3>
              <div className="space-y-3">
                {templates.map(t => (
                  <div key={t.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-gray-800">{t.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${CHANNEL_BADGE[t.channel] || 'bg-gray-100 text-gray-600'}`}>
                          {t.channel}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{t.content}</p>
                    </div>
                    <button onClick={() => handleDeleteTemplate(t.id)} className="ml-3 p-1.5 rounded hover:bg-red-50 text-red-400 flex-shrink-0 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommunicationTab;

