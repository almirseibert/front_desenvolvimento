import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/pt-br';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import apiClient from '../../services/apiClient';
import { X, Clock, CheckCircle, Trash2, Plus, Calendar as CalendarIcon, Bell } from 'lucide-react';

moment.locale('pt-br');
const localizer = momentLocalizer(moment);

export default function AgendaModal({ isOpen, onClose, onEventUpdate }) {
    const [eventos, setEventos] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventTime, setEventTime] = useState('08:00');
    const [colorHex, setColorHex] = useState('#22C55E'); 

    // NOVOS ESTADOS PARA O SISTEMA DE LEMBRETES INTELIGENTE
    const [reminderUnit, setReminderUnit] = useState('minutos');
    const [reminderValue, setReminderValue] = useState(15);
    const [remindersList, setRemindersList] = useState([]); 

    useEffect(() => {
        if (isOpen) carregarEventos();
    }, [isOpen]);

    const carregarEventos = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/agenda');
            if (Array.isArray(response)) {
                const formattedEvents = response.map(evento => ({
                    ...evento,
                    start: new Date(evento.event_datetime),
                    end: new Date(evento.event_datetime), 
                    title: evento.title
                }));
                setEventos(formattedEvents);
            } else {
                setEventos([]);
            }
        } catch (error) {
            console.error("Erro ao buscar agenda:", error);
            setEventos([]); 
        } finally {
            setLoading(false);
        }
    };
      
    // Lógica Dinâmica de Limites dos Inputs
    const getMaxLimit = () => {
        switch(reminderUnit) {
            case 'meses': return 12;
            case 'dias': return 31;
            case 'horas': return 24;
            case 'minutos': return 60;
            default: return 60;
        }
    };

    const handleAddReminder = () => {
        if (reminderUnit === 'na_hora') {
            setRemindersList([...remindersList, { unit: 'na_hora', value: 0, minutes: 0, label: 'Exatamente na hora do evento' }]);
            return;
        }

        const val = parseInt(reminderValue, 10);
        if (isNaN(val) || val <= 0) return;

        let mins = 0;
        if (reminderUnit === 'meses') mins = val * 30 * 24 * 60;
        else if (reminderUnit === 'dias') mins = val * 24 * 60;
        else if (reminderUnit === 'horas') mins = val * 60;
        else mins = val;

        const label = `${val} ${reminderUnit} antes`;
        setRemindersList([...remindersList, { unit: reminderUnit, value: val, minutes: mins, label }]);
        setReminderValue(1); 
    };

    const removeReminder = (index) => {
        setRemindersList(remindersList.filter((_, i) => i !== index));
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        try {
            // CORREÇÃO DO FUSO HORÁRIO: Formata como string exata (ex: 2026-04-10 08:00:00)
            // Isso impede que o servidor adicione 3 horas de fuso.
            const datetime = moment(`${eventDate} ${eventTime}`, 'YYYY-MM-DD HH:mm').format('YYYY-MM-DD HH:mm:ss');
            
            await apiClient.post('/agenda', {
                title,
                description,
                event_datetime: datetime,
                reminders: remindersList, 
                color_hex: colorHex
            });
            
            setShowAddModal(false);
            carregarEventos();
            if (onEventUpdate) onEventUpdate(); 
            
            setTitle(''); setDescription(''); setEventDate(''); setEventTime('08:00'); setRemindersList([]);
        } catch (error) {
            console.error('Erro ao adicionar evento:', error);
            alert('Erro ao criar evento. Verifique sua conexão.');
        }
    };

    const excluirEvento = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir este evento?')) return;
        try {
            await apiClient.delete(`/agenda/${id}`);
            setShowDetailModal(false);
            carregarEventos();
            if (onEventUpdate) onEventUpdate();
        } catch (error) {
            console.error('Erro ao excluir:', error);
        }
    };

    const toggleConcluido = async (id, isCompleted) => {
        try {
            await apiClient.put(`/agenda/${id}/concluir`, { is_completed: !isCompleted });
            setShowDetailModal(false);
            carregarEventos();
            if (onEventUpdate) onEventUpdate();
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
        }
    };

    const eventStyleGetter = (event) => ({
        style: {
            backgroundColor: event.color_hex || '#3B82F6',
            borderRadius: '5px',
            opacity: event.is_completed ? 0.6 : 1,
            color: 'white',
            border: '0px',
            display: 'block',
            textDecoration: event.is_completed ? 'line-through' : 'none'
        }
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="mak-modal max-w-5xl">
                
                <div className="bg-blue-900 p-4 flex justify-between items-center text-white shrink-0">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="w-6 h-6 text-blue-300" />
                        <h2 className="text-xl font-bold">Agenda & Lembretes</h2>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-500 transition-colors px-4 py-2 rounded-lg text-sm font-semibold shadow flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Novo Evento
                        </button>
                        <button onClick={onClose} className="text-blue-200 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                    </div>
                </div>

                <div className="flex-1 p-4 bg-gray-50 overflow-hidden">
                    {loading ? (
                        <div className="w-full h-full flex justify-center items-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
                        </div>
                    ) : (
                        <div className="bg-white p-4 rounded-lg shadow h-full">
                            <Calendar
                                localizer={localizer}
                                events={eventos}
                                startAccessor="start"
                                endAccessor="end"
                                style={{ height: '100%' }}
                                messages={{ next: "Próximo", previous: "Anterior", today: "Hoje", month: "Mês", week: "Semana", day: "Dia", agenda: "Lista", noEventsInRange: "Nenhum evento neste período." }}
                                eventPropGetter={eventStyleGetter}
                                onSelectEvent={(event) => { setSelectedEvent(event); setShowDetailModal(true); }}
                            />
                        </div>
                    )}
                </div>

                {/* MODAL CRIAR EVENTO */}
                {showAddModal && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-40 p-4">
                        <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-center p-4 border-b shrink-0">
                                <h3 className="mak-modal-title">Criar Novo Evento</h3>
                                <button onClick={() => setShowAddModal(false)}><X className="text-gray-500 hover:text-red-500" /></button>
                            </div>
                            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                                <form id="agendaForm" onSubmit={onSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                                        <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" placeholder="Ex: Reunião Operacional" />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                                            <input type="date" required value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                                            <input type="time" required value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                    </div>

                                    {/* PAINEL INTELIGENTE DE LEMBRETES */}
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                        <label className="block text-sm font-bold text-blue-900 mb-2 flex items-center gap-2"><Bell size={16}/> Configurar Alertas</label>
                                        
                                        <div className="flex flex-col sm:flex-row gap-2 items-end">
                                            <div className="flex-1">
                                                <select value={reminderUnit} onChange={(e) => { setReminderUnit(e.target.value); setReminderValue(1); }} className="w-full border border-gray-300 rounded-lg p-2">
                                                    <option value="minutos">Minutos</option>
                                                    <option value="horas">Horas</option>
                                                    <option value="dias">Dias</option>
                                                    <option value="meses">Meses</option>
                                                    <option value="na_hora">Na hora exata do evento</option>
                                                </select>
                                            </div>
                                            
                                            {reminderUnit !== 'na_hora' && (
                                                <div className="w-24">
                                                    <input type="number" min="1" max={getMaxLimit()} value={reminderValue} onChange={(e) => setReminderValue(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 text-center" />
                                                </div>
                                            )}

                                            <button type="button" onClick={handleAddReminder} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 whitespace-nowrap">
                                                + Adicionar
                                            </button>
                                        </div>

                                        {remindersList.length > 0 && (
                                            <ul className="mt-3 space-y-2">
                                                {remindersList.map((rem, idx) => (
                                                    <li key={idx} className="flex justify-between items-center bg-white p-2 rounded border border-gray-200 text-sm">
                                                        <span className="font-medium text-gray-700">🔔 Avisar: {rem.label}</span>
                                                        <button type="button" onClick={() => removeReminder(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Descrição / Detalhes</label>
                                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="2" className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"></textarea>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Cor de Destaque</label>
                                        <div className="flex gap-3">
                                            {['#22C55E', '#3B82F6', '#EAB308', '#EF4444', '#8B5CF6', '#1F2937'].map(color => (
                                                <button key={color} type="button" onClick={() => setColorHex(color)} className={`w-8 h-8 rounded-full border-2 ${colorHex === color ? 'border-gray-900 scale-110' : 'border-transparent'}`} style={{ backgroundColor: color }} />
                                            ))}
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <div className="p-4 border-t flex justify-end gap-3 shrink-0 bg-gray-50">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">Cancelar</button>
                                <button type="submit" form="agendaForm" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow">Salvar Evento</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL DETALHES */}
                {showDetailModal && selectedEvent && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-40 p-4">
                        <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
                            <div className="p-4 border-b flex justify-between items-start" style={{ borderTop: `4px solid ${selectedEvent.color_hex || '#3B82F6'}` }}>
                                <div>
                                    <h3 className={`font-bold text-xl ${selectedEvent.is_completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                        {selectedEvent.title}
                                    </h3>
                                    <div className="flex items-center text-sm text-gray-500 mt-1 gap-1">
                                        <Clock className="w-4 h-4" />
                                        {moment(selectedEvent.start).format('DD/MM/YYYY [às] HH:mm')}
                                    </div>
                                </div>
                                <button onClick={() => setShowDetailModal(false)}><X className="text-gray-400 hover:text-gray-700" /></button>
                            </div>
                            
                            <div className="p-4">
                                {selectedEvent.description ? (
                                    <p className="text-gray-700 text-sm whitespace-pre-wrap">{selectedEvent.description}</p>
                                ) : (
                                    <p className="text-gray-400 text-sm italic">Nenhuma descrição informada.</p>
                                )}
                            </div>

                            <div className="bg-gray-50 p-4 border-t">
                                <div className="flex justify-between items-center">
                                    <button onClick={() => excluirEvento(selectedEvent.id)} className="text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm font-medium">
                                        <Trash2 className="w-4 h-4" /> Excluir
                                    </button>
                                    <button onClick={() => toggleConcluido(selectedEvent.id, selectedEvent.is_completed)} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${selectedEvent.is_completed ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-green-500 text-white hover:bg-green-600'}`}>
                                        <CheckCircle className="w-4 h-4" /> {selectedEvent.is_completed ? 'Desmarcar' : 'Concluir'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
