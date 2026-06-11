import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';

const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    
    // Campos do registro
    const [registerName, setRegisterName] = useState('');
    const [registerEmail, setRegisterEmail] = useState('');
    const [registerPassword, setRegisterPassword] = useState(''); // Novo campo de senha
    const [registerMessage, setRegisterMessage] = useState('');
    const [notification, setNotification] = useState('');
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

    const { login, error: authError, loading: authLoading } = useAuth();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await login(email, password);
        } catch (err) {
            // O erro é tratado no contexto, mas podemos limpar o form se necessário
        }
    };

    const handleRegisterRequest = async (e) => {
        e.preventDefault();
        setRegisterMessage('');
        
        if (!registerName || !registerEmail || !registerPassword) {
            setRegisterMessage('Todos os campos são obrigatórios.');
            return;
        }

        if (registerPassword.length < 6) {
            setRegisterMessage('A senha deve ter no mínimo 6 caracteres.');
            return;
        }

        setIsSubmittingRequest(true);
        try {
            // Chama a rota /auth/register via apiClient
            await apiClient.createRegistrationRequest({
                name: registerName,
                email: registerEmail,
                password: registerPassword
            });
            setNotification('Solicitação enviada! Aguarde a aprovação do administrador.');
            setIsRegistering(false);
            setRegisterName('');
            setRegisterEmail('');
            setRegisterPassword('');
        } catch (err) {
            console.error("Erro cadastro:", err);
            setRegisterMessage(err.message || 'Erro ao enviar solicitação.');
        } finally {
            setIsSubmittingRequest(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen font-sans" style={{background:'#f5f3ef'}}>
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-lg">
                <div className="flex justify-center">
                    <img src="https://i.postimg.cc/pVnwyfRq/MAK-Servi-os-Logotipo.png" alt="Logo MAK" className="w-48"/>
                </div>
                <h2 className="text-2xl font-bold text-center text-gray-900">Sistema de Frotas</h2>
                
                <form className="space-y-6" onSubmit={handleLogin}>
                    <div>
                        <label className="text-sm font-medium text-gray-700">Email</label>
                        <input type="email" required className="w-full px-4 py-2 mt-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-yellow-500" 
                            value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700">Senha</label>
                        <input type="password" required className="w-full px-4 py-2 mt-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-yellow-500" 
                            value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    
                    {(error || authError) && <p className="text-sm text-red-600 text-center">{error || authError}</p>}
                    
                    <button type="submit" disabled={authLoading} className="w-full py-3 font-semibold text-gray-900 bg-yellow-400 rounded-lg hover:bg-[#fdf8f0]0 disabled:bg-yellow-200">
                        {authLoading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>

                <div className="text-center">
                    <button onClick={() => setIsRegistering(true)} className="text-sm hover:underline" style={{color:'#9E7A42'}}>
                        Solicitar Cadastro (Novo Usuário)
                    </button>
                </div>
                
                {notification && <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-lg text-center text-sm">{notification}</div>}
            </div>

            {/* Modal de Cadastro */}
            {isRegistering && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                     <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
                         <h3 className="text-xl font-bold mb-4">Solicitar Acesso</h3>
                         <form onSubmit={handleRegisterRequest}>
                             <div className="mb-4">
                                <label className="block text-gray-700 text-sm mb-1">Nome Completo</label>
                                <input type="text" value={registerName} onChange={(e) => setRegisterName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" required/>
                             </div>
                             <div className="mb-4">
                                <label className="block text-gray-700 text-sm mb-1">Email</label>
                                <input type="email" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} className="w-full px-3 py-2 border rounded-lg" required/>
                             </div>
                             <div className="mb-4">
                                <label className="block text-gray-700 text-sm mb-1">Crie uma Senha</label>
                                <input type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg" required placeholder="Mínimo 6 caracteres"/>
                             </div>
                             
                             {registerMessage && <p className="text-sm text-red-600 mb-4">{registerMessage}</p>}
                             
                             <div className="flex justify-end gap-3">
                                 <button type="button" onClick={() => setIsRegistering(false)} className="py-2 px-4 bg-gray-200 rounded-lg text-sm">Cancelar</button>
                                 <button type="submit" className="py-2 px-4 bg-yellow-400 rounded-lg text-sm font-semibold" disabled={isSubmittingRequest}>
                                     {isSubmittingRequest ? 'Enviando...' : 'Enviar'}
                                 </button>
                             </div>
                         </form>
                     </div>
                 </div>
            )}
        </div>
    );
};

export default LoginScreen;
