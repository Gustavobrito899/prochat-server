const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Configurando o servidor
const app = express();
const server = http.createServer(app);

// Configurando o WebSockets (Socket.io) para comunicação em tempo real
const io = new Server(server, {
    cors: {
        origin: "*", // Permite que o seu HTML se conecte ao servidor de qualquer lugar
        methods: ["GET", "POST"]
    }
});

// Evento disparado toda vez que um usuário abre o app
io.on('connection', (socket) => {
    console.log('🟢 Novo usuário conectado! ID:', socket.id);

    // O servidor fica "ouvindo" as mensagens enviadas pelo chat
    socket.on('enviar_mensagem', (dados) => {
        console.log('Mensagem recebida no servidor:', dados);
        
        // Pega a mensagem recebida e retransmite para TODOS os usuários conectados
        io.emit('receber_mensagem', dados);
    });

    // Evento disparado quando o usuário fecha o app
    socket.on('disconnect', () => {
        console.log('🔴 Usuário desconectou. ID:', socket.id);
    });
});

// Define a porta do servidor (usa a porta da nuvem ou a 3000 no PC local)
const PORTA = process.env.PORT || 3000;
server.listen(PORTA, () => {
    console.log(`🚀 Servidor do ProChat rodando na porta ${PORTA}`);
});