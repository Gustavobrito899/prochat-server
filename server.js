const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);

// --- CONEXÃO COM O MONGODB ATLAS ---
const mongoURI = 'mongodb://Gustavo:Noronha%402008@gustavo-shard-00-00.xvwmeod.mongodb.net:27017,gustavo-shard-00-01.xvwmeod.mongodb.net:27017,gustavo-shard-00-02.xvwmeod.mongodb.net:27017/?ssl=true&replicaSet=atlas-xvwmeod-shard-0&authSource=admin&retryWrites=true&w=majority';

mongoose.connect(mongoURI)
  .then(() => console.log('✅ Conectado ao MongoDB Atlas com sucesso!'))
  .catch(err => {
    console.error('❌ Erro de conexão com o Banco de Dados:');
    console.error(err.message);
  });

// --- MODELO DE DADOS ATUALIZADO ---
const Mensagem = mongoose.model('Mensagem', {
    nome: String,
    destinatario: { type: String, default: 'Geral' }, // NOVO: Define quem recebe a mensagem
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

// MAPA PARA RASTREAR QUEM ESTÁ ONLINE (ID do Socket -> Nome)
const usuariosOnline = new Map();

io.on('connection', async (socket) => {
    console.log('🟢 Usuário conectado! ID:', socket.id);

    // REGISTRAR USUÁRIO NOVO E AVISAR TODOS
    socket.on('registrar_usuario', (nome) => {
        usuariosOnline.set(socket.id, nome);
        // Envia a lista atualizada de nomes para todo mundo
        io.emit('lista_usuarios', Array.from(usuariosOnline.values())); 
    });

    // BUSCAR HISTÓRICO DO GRUPO GERAL
    socket.on('pedir_historico_geral', async () => {
        try {
            const historico = await Mensagem.find({ destinatario: 'Geral' }).sort({ dataEnvio: 1 }).limit(50);
            socket.emit('historico_mensagens', historico);
        } catch (err) { console.error(err); }
    });

    // BUSCAR HISTÓRICO PRIVADO (1 A 1)
    socket.on('pedir_historico_privado', async (contato) => {
        const meuNome = usuariosOnline.get(socket.id);
        if(!meuNome) return;
        try {
            const historico = await Mensagem.find({
                $or: [
                    { nome: meuNome, destinatario: contato },
                    { nome: contato, destinatario: meuNome }
                ]
            }).sort({ dataEnvio: 1 }).limit(50);
            socket.emit('historico_privado_resposta', { contato, historico });
        } catch(err) { console.error(err); }
    });

    // RECEBER E SALVAR MENSAGEM DO GRUPO
    socket.on('enviar_mensagem', async (dados) => {
        try {
            const novaMensagem = new Mensagem({
                nome: dados.nome,
                destinatario: 'Geral',
                texto: dados.texto,
                hora: dados.hora
            });
            await novaMensagem.save();
            io.emit('receber_mensagem', dados); // Envia para todos
        } catch (err) { console.error(err); }
    });

    // RECEBER E SALVAR MENSAGEM PRIVADA
    socket.on('enviar_mensagem_privada', async (dados) => {
        try {
            const novaMensagem = new Mensagem({
                nome: dados.de,
                destinatario: dados.para,
                texto: dados.texto,
                hora: dados.hora
            });
            await novaMensagem.save();

            // Procura o ID de quem vai receber
            let socketDestinatario = null;
            for (let [id, nome] of usuariosOnline.entries()) {
                if (nome === dados.para) {
                    socketDestinatario = id;
                    break;
                }
            }

            // Entrega a mensagem para a pessoa (se online)
            if (socketDestinatario) {
                io.to(socketDestinatario).emit('receber_mensagem_privada', { nome: dados.de, texto: dados.texto, hora: dados.hora, contatoOriginal: dados.de });
            }
            // Retorna para quem enviou ver na tela
            socket.emit('receber_mensagem_privada', { nome: dados.de, texto: dados.texto, hora: dados.hora, contatoOriginal: dados.para });

        } catch (err) { console.error('Erro msg privada:', err); }
    });

    // DESCONECTAR E ATUALIZAR LISTA
    socket.on('disconnect', () => {
        const nome = usuariosOnline.get(socket.id);
        usuariosOnline.delete(socket.id);
        if (nome) {
            io.emit('lista_usuarios', Array.from(usuariosOnline.values()));
        }
        console.log('🔴 Usuário desconectou:', nome || socket.id);
    });
});

const PORTA = process.env.PORT || 3000;
server.listen(PORTA, () => {
    console.log(`🚀 Servidor do ProChat rodando na porta ${PORTA}`);
});