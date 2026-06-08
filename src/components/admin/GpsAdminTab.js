import React, { useState } from 'react';
import { Satellite, Eye, EyeOff } from 'lucide-react';

const GPS_PROVIDERS = ['', 'Sascar', 'Onixsat', 'Autotrac', 'Omnilink', 'Custom API'];

const GpsAdminTab = () => {
  const [gpsConfig, setGpsConfig] = useState({ provider: '', apiKey: '', baseUrl: '', enabled: false });
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-5 space-y-4">
      <div>
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Satellite size={18} className="text-green-500" />
          Integração GPS / Rastreamento
        </h3>
        <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
          Configure a integração com plataformas de rastreamento GPS para sincronização automática de
          posição e histórico de viagens dos veículos.
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Provedor</label>
          <select
            value={gpsConfig.provider}
            onChange={e => setGpsConfig(p => ({ ...p, provider: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-yellow-400 outline-none"
          >
            {GPS_PROVIDERS.map(p => (
              <option key={p} value={p}>{p || 'Selecione o provedor'}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Chave de API</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={gpsConfig.apiKey}
              onChange={e => setGpsConfig(p => ({ ...p, apiKey: e.target.value }))}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        {gpsConfig.provider === 'Custom API' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">URL Base da API</label>
            <input
              value={gpsConfig.baseUrl}
              onChange={e => setGpsConfig(p => ({ ...p, baseUrl: e.target.value }))}
              placeholder="https://api.seuservicogps.com/v1"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none"
            />
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={gpsConfig.enabled}
          onChange={e => setGpsConfig(p => ({ ...p, enabled: e.target.checked }))}
          className="h-4 w-4 text-yellow-500 rounded border-gray-300 focus:ring-yellow-400"
        />
        <span className="text-sm font-medium text-gray-700">Habilitar integração GPS</span>
      </label>
      <div className="flex gap-3">
        <button
          onClick={() => alert('Disponível em breve (backend pendente).')}
          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold rounded-lg text-sm transition-colors"
        >
          Salvar Configuração
        </button>
        <button
          onClick={() => alert('Disponível em breve.')}
          className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 font-medium rounded-lg text-sm transition-colors"
        >
          Testar Conexão
        </button>
      </div>
    </div>
  );
};

export default GpsAdminTab;
