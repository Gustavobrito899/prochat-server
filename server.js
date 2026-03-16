const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);

// --- CONEXÃO COM O MONGODB ATLAS (FORMATO UNIVERSAL) ---
// Este link aponta direto para os servidores, evitando erros de DNS na sua rede.
const mongoURI = 'mongodb://Gustavo:Noronha%402008@gustavo-shard-00-00.xvwmeod.mongodb.net:27017,gustavo-shard-00-01.xvwmeod.mongodb.net:27017,gustavo-shard-00-02.xvwmeod.mongodb.net:27017/?ssl=true&replicaSet=atlas-xvwmeod-shard-0&authSource=admin&retryWrites=true&w=majority';

mongoose.connect(mongoURI)
  .then(() => console.log('✅ Conectado ao MongoDB Atlas com sucesso!'))
  .catch(err => {
    console.error('❌ Erro de conexão com o Banco de Dados:');
    console.error(err.message);
  });

// --- MODELO DE DADOS ---
const Mensagem = mongoose.model('Mensagem', {
    nome: String,
    texto: String,
    hora: String,
    dataEnvio: { type: Date, default: Date.now }
});

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', async (socket) => {
    console.log('🟢 Usuário conectado! ID:', socket.id);

    // Busca histórico ao conectar
    try {
        const historico = await Mensagem.find().sort({ dataEnvio: 1 }).limit(50);
        socket.emit('historico_mensagens', historico);
    } catch (err) {
        console.error('Erro ao buscar histórico:', err);
    }

    // Recebe e salva nova mensagem
    socket.on('enviar_mensagem', async (dados) => {
        try {
            const novaMensagem = new Mensagem({
                nome: dados.nome,
                texto: dados.texto,
                hora: dados.hora
            });

            await novaMensagem.save();
            io.emit('receber_mensagem', dados); // Envia para todos
        } catch (err) {
            console.error('Erro ao salvar no banco:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('🔴 Usuário desconectou.');
    });
});

const PORTA = process.env.PORT || 3000;
server.listen(PORTA, () => {
    console.log(`🚀 Servidor do ProChat rodando na porta ${PORTA}`);
});