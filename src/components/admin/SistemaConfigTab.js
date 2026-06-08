import React, { useState } from 'react';
import { GitBranch, Clock, Calendar, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const WORKFLOW_MODULES = ['Despesas', 'Abastecimento', 'Ordens de Compra', 'Estoque', 'Outros'];
const REPORT_MODULES  = ['Abastecimento', 'Obras', 'Manutenções', 'Faturamento', 'Estoque', 'Pneus', 'Multas', 'Veículos'];
const FREQ_LABELS     = { daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal' };

const DEFAULT_HOLIDAYS = [
  { id: 1,  name: 'Ano Novo',                  date: '2026-01-01' },
  { id: 2,  name: 'Carnaval',                  date: '2026-03-03' },
  { id: 3,  name: 'Tiradentes',                date: '2026-04-21' },
  { id: 4,  name: 'Dia do Trabalho',           date: '2026-05-01' },
  { id: 5,  name: 'Corpus Christi',            date: '2026-06-04' },
  { id: 6,  name: 'Independência',             date: '2026-09-07' },
  { id: 7,  name: 'Nossa Sra. Aparecida',      date: '2026-10-12' },
  { id: 8,  name: 'Finados',                   date: '2026-11-02' },
  { id: 9,  name: 'Proclamação da República',  date: '2026-11-15' },
  { id: 10, name: 'Natal',                     date: '2026-12-25' },
];

const SectionHeader = ({ title, icon, open, onToggle }) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 rounded-t-lg transition-colors"
  >
    <div className="flex items-center gap-2 font-bold text-gray-800">{icon}{title}</div>
    {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
  </button>
);

const SistemaConfigTab = () => {
  const [open, setOpen] = useState({ workflows: true, reports: false, holidays: false });
  const toggle = key => setOpen(p => ({ ...p, [key]: !p[key] }));

  // Workflows
  const [workflows, setWorkflows] = useState([
    { id: 1, module: 'Despesas',      threshold: '500', description: 'Requer aprovação do diretor' },
    { id: 2, module: 'Abastecimento', threshold: '300', description: 'Requer 2ª aprovação de gestor' },
  ]);
  const [newWf, setNewWf] = useState({ module: 'Despesas', threshold: '', description: '' });

  const addWorkflow = () => {
    if (!newWf.threshold) return;
    setWorkflows(p => [...p, { ...newWf, id: Date.now() }]);
    setNewWf({ module: 'Despesas', threshold: '', description: '' });
  };

  // Relatórios
  const [reports, setReports] = useState([]);
  const [newRpt, setNewRpt] = useState({ name: '', module: 'Abastecimento', frequency: 'weekly', time: '08:00' });

  const addReport = () => {
    if (!newRpt.name) return;
    setReports(p => [...p, { ...newRpt, id: Date.now() }]);
    setNewRpt({ name: '', module: 'Abastecimento', frequency: 'weekly', time: '08:00' });
  };

  // Feriados
  const [holidays, setHolidays] = useState(DEFAULT_HOLIDAYS);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '' });

  const addHoliday = () => {
    if (!newHoliday.name || !newHoliday.date) return;
    setHolidays(p => [...p, { ...newHoliday, id: Date.now() }]);
    setNewHoliday({ name: '', date: '' });
  };

  return (
    <div className="space-y-4">

      {/* Workflows */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <SectionHeader
          title="Fluxos de Aprovação em Múltiplos Níveis"
          icon={<GitBranch size={18} className="text-blue-500" />}
          open={open.workflows}
          onToggle={() => toggle('workflows')}
        />
        {open.workflows && (
          <div className="p-5 border-t space-y-4">
            <p className="text-sm text-gray-500">
              Configure quando uma operação exige aprovação adicional de um segundo nível
              (ex: despesas acima de R$ 500).
            </p>
            <div className="space-y-2">
              {workflows.map(w => (
                <div key={w.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div>
                    <span className="font-medium text-sm text-gray-800">{w.module}</span>
                    <span className="text-gray-400 text-xs mx-2">—</span>
                    <span className="text-sm text-gray-600">{w.description || `Limite: ${w.threshold}`}</span>
                    {w.threshold && (
                      <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        Acima de {w.module === 'Abastecimento' ? `${w.threshold}L` : `R$ ${w.threshold}`}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setWorkflows(p => p.filter(x => x.id !== w.id))}
                    className="p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Módulo</label>
                <select
                  value={newWf.module}
                  onChange={e => setNewWf(p => ({ ...p, module: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-yellow-400 outline-none"
                >
                  {WORKFLOW_MODULES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Limite (R$ ou unidade)</label>
                <input
                  type="number"
                  value={newWf.threshold}
                  onChange={e => setNewWf(p => ({ ...p, threshold: e.target.value }))}
                  placeholder="Ex: 500"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
                <input
                  value={newWf.description}
                  onChange={e => setNewWf(p => ({ ...p, description: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none"
                />
              </div>
            </div>
            <button
              onClick={addWorkflow}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-sm transition-colors"
            >
              <Plus size={14} /> Adicionar Fluxo
            </button>
          </div>
        )}
      </div>

      {/* Relatórios Programados */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <SectionHeader
          title="Relatórios Programados"
          icon={<Clock size={18} className="text-purple-500" />}
          open={open.reports}
          onToggle={() => toggle('reports')}
        />
        {open.reports && (
          <div className="p-5 border-t space-y-4">
            <p className="text-sm text-gray-500">
              Configure relatórios automáticos enviados por WhatsApp ou e-mail nos horários definidos.
            </p>
            {reports.length > 0 && (
              <div className="space-y-2">
                {reports.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div>
                      <span className="font-medium text-sm text-gray-800">{r.name}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        ({r.module} — {FREQ_LABELS[r.frequency]} às {r.time})
                      </span>
                    </div>
                    <button
                      onClick={() => setReports(p => p.filter(x => x.id !== r.id))}
                      className="p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t pt-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                <input
                  value={newRpt.name}
                  onChange={e => setNewRpt(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Consumo semanal"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Módulo</label>
                <select
                  value={newRpt.module}
                  onChange={e => setNewRpt(p => ({ ...p, module: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-yellow-400 outline-none"
                >
                  {REPORT_MODULES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Frequência</label>
                <select
                  value={newRpt.frequency}
                  onChange={e => setNewRpt(p => ({ ...p, frequency: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-yellow-400 outline-none"
                >
                  <option value="daily">Diário</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Horário</label>
                <input
                  type="time"
                  value={newRpt.time}
                  onChange={e => setNewRpt(p => ({ ...p, time: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none"
                />
              </div>
            </div>
            <button
              onClick={addReport}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg text-sm transition-colors"
            >
              <Plus size={14} /> Adicionar Relatório
            </button>
          </div>
        )}
      </div>

      {/* Feriados */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <SectionHeader
          title="Feriados e Datas Especiais"
          icon={<Calendar size={18} className="text-red-500" />}
          open={open.holidays}
          onToggle={() => toggle('holidays')}
        />
        {open.holidays && (
          <div className="p-5 border-t space-y-4">
            <p className="text-sm text-gray-500">
              Feriados são considerados no cálculo de prazos, escalas e relatórios de dias úteis.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
              {holidays
                .sort((a, b) => a.date.localeCompare(b.date))
                .map(h => (
                  <div key={h.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <div>
                      <span className="text-sm font-medium text-gray-800">{h.name}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {new Date(h.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <button
                      onClick={() => setHolidays(p => p.filter(x => x.id !== h.id))}
                      className="p-1 rounded hover:bg-red-50 text-red-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
            </div>
            <div className="flex gap-3 border-t pt-3">
              <input
                value={newHoliday.name}
                onChange={e => setNewHoliday(p => ({ ...p, name: e.target.value }))}
                placeholder="Nome do feriado"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none"
              />
              <input
                type="date"
                value={newHoliday.date}
                onChange={e => setNewHoliday(p => ({ ...p, date: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none"
              />
              <button
                onClick={addHoliday}
                className="flex items-center gap-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg text-sm transition-colors"
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SistemaConfigTab;
