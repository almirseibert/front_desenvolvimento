import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import apiClient from '../../services/apiClient';

const ALERT_FIELDS = [
  { key: 'revisionKmLimit',  label: 'Intervalo de Revisão (Km)',        unit: 'km',   default: 10000 },
  { key: 'revisionHrLimit',  label: 'Intervalo de Revisão (Hr)',        unit: 'hr',   default: 250   },
  { key: 'tireKmLimit',      label: 'Rodízio de Pneus (Km)',            unit: 'km',   default: 40000 },
  { key: 'crlvDaysAlert',    label: 'Alerta CRLV (dias antes)',         unit: 'dias', default: 30    },
  { key: 'seguroDaysAlert',  label: 'Alerta Seguro (dias antes)',       unit: 'dias', default: 30    },
  { key: 'cnhDaysAlert',     label: 'Alerta CNH (dias antes)',          unit: 'dias', default: 60    },
  { key: 'asoDaysAlert',     label: 'Alerta ASO/Exame (dias antes)',    unit: 'dias', default: 30    },
  { key: 'inactivityKmDays', label: 'Km sem atualização (dias)',        unit: 'dias', default: 15    },
  { key: 'inactivityHrDays', label: 'Hr sem atualização (dias)',        unit: 'dias', default: 15    },
  { key: 'maxFuelLiters',    label: 'Abast. acima de (litros) → alerta', unit: 'L',  default: 300   },
  { key: 'maxExpenseValue',  label: 'Despesa acima de (R$) → alerta',  unit: 'R$',   default: 1000  },
];

const AlertasAdminTab = () => {
  const [alertConfig, setAlertConfig] = useState(
    ALERT_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: f.default }), {})
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.adminSaveAlertConfig(alertConfig);
      alert('Configurações de alertas salvas!');
    } catch {
      alert('Disponível em breve (backend pendente).');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-5 space-y-4">
      <div>
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Bell size={18} className="text-yellow-500" />
          Limites de Alertas Automáticos
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Define os thresholds para geração automática de alertas de manutenção, documentos e inatividade.
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {ALERT_FIELDS.map(f => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={alertConfig[f.key]}
                onChange={e => setAlertConfig(p => ({ ...p, [f.key]: Number(e.target.value) }))}
                className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none"
                min={0}
              />
              <span className="text-xs text-gray-400 whitespace-nowrap">{f.unit}</span>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold rounded-lg text-sm disabled:opacity-50 transition-colors"
      >
        {saving ? 'Salvando...' : 'Salvar Limites'}
      </button>
    </div>
  );
};

export default AlertasAdminTab;
