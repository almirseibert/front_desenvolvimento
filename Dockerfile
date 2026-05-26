# --- Estágio 1: Build (Construção) ---
# Usamos uma imagem Node.js para construir o aplicativo React
FROM node:18-alpine AS builder

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia os arquivos de definição de pacotes
COPY package.json ./
COPY package-lock.json ./
# (Se você usar yarn, copie yarn.lock em vez de package-lock.json)

# Instala as dependências do projeto
RUN npm install

# Copia todo o restante do código-fonte do frontend
COPY . .

# --- Configuração da Variável de Ambiente da API ---
# Declara um argumento que pode ser passado durante o build
# O Easypanel vai injetar a variável de ambiente aqui
ARG REACT_APP_API_URL
# Define a variável de ambiente para o processo de build
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Executa o comando de build de produção
# O React vai inserir o valor de $REACT_APP_API_URL no código
RUN npm run build

# --- Estágio 2: Production (Servidor) ---
# Usamos uma imagem Nginx leve para servir os arquivos estáticos
FROM nginx:1.25-alpine

# Copia os arquivos de build do estágio 'builder' para a pasta padrão do Nginx
COPY --from=builder /app/build /usr/share/nginx/html

# Copia o arquivo de configuração personalizado do Nginx
# Isso é crucial para o roteamento da SPA funcionar
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expõe a porta 80 (porta padrão do Nginx)
EXPOSE 80

# Comando para iniciar o servidor Nginx
CMD ["nginx", "-g", "daemon off;"]
