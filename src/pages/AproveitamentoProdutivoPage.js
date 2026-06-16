import React from 'react';
import AproveitamentoProdutivo from '../components/analise/AproveitamentoProdutivo';

// Página da seção "Análise Gerencial → Aproveitamento Produtivo".
// Mantém o mesmo fundo das demais páginas da Análise Gerencial.
const AproveitamentoProdutivoPage = (props) => (
    <div className="h-full overflow-y-auto" style={{ background: '#f5f3ef' }}>
        <AproveitamentoProdutivo {...props} />
    </div>
);

export default AproveitamentoProdutivoPage;
