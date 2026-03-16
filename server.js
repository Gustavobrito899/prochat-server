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
    console.error('❌ Erro de conexão com o Banco de Dados:', err.message);
  });

// --- MODELO DE DADOS ---
const Mensagem = mongoose.model('Mensagem', {
    nome: String,
    destinatario: { type: String, default: 'Geral' },
    texto: String,
    hora: String,
    dataEnvio: { type: Date, default: Date.now }
});

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const usuariosOnline = new Map();

io.on('connection', (socket) => {
    console.log('🟢 Usuário conectado! ID:', socket.id);

    socket.on('registrar_usuario', (nome) => {
        usuariosOnline.set(socket.id, nome);
        io.emit('lista_usuarios', Array.from(usuariosOnline.values())); 
    });

    socket.on('pedir_historico_geral', async () => {
        try {
            const historico = await Mensagem.find({ destinatario: 'Geral' }).sort({ dataEnvio: 1 }).limit(50);
            socket.emit('historico_mensagens', historico || []);
        } catch (err) { console.error('Erro geral:', err); }
    });

    socket.on('pedir_historico_privado', async (dados) => {
        try {
            if (!dados.meuNome || !dados.contato) return;
            
            // Busca Inteligente: Ignora se a letra é maiúscula ou minúscula
            const historico = await Mensagem.find({
                $or: [
                    { nome: new RegExp(`^${dados.meuNome}$`, 'i'), destinatario: new RegExp(`^${dados.contato}$`, 'i') },
                    { nome: new RegExp(`^${dados.contato}$`, 'i'), destinatario: new RegExp(`^${dados.meuNome}$`, 'i') }
                ]
            }).sort({ dataEnvio: 1 }).limit(50);
            
            socket.emit('historico_privado_resposta', { contato: dados.contato, historico: historico || [] });
        } catch(err) { 
            console.error('Erro privado:', err); 
            socket.emit('historico_privado_resposta', { contato: dados.contato, historico: [] });
        }
    });

    socket.on('enviar_mensagem', async (dados) => {
        try {
            const novaMensagem = new Mensagem({
                nome: dados.nome,
                destinatario: 'Geral',
                texto: dados.texto,
                hora: dados.hora
            });
            await novaMensagem.save();
            io.emit('receber_mensagem', dados); 
        } catch (err) { console.error(err); }
    });

    socket.on('enviar_mensagem_privada', async (dados) => {
        try {
            const novaMensagem = new Mensagem({
                nome: dados.de,
                destinatario: dados.para,
                texto: dados.texto,
                hora: dados.hora
            });
            await novaMensagem.save();

            let socketDestinatario = null;
            for (let [id, nome] of usuariosOnline.entries()) {
                if (nome.toLowerCase() === dados.para.toLowerCase()) {
                    socketDestinatario = id;
                    break;
                }
            }

            if (socketDestinatario) {
                io.to(socketDestinatario).emit('receber_mensagem_privada', { nome: dados.de, texto: dados.texto, hora: dados.hora, contatoOriginal: dados.de });
            }
            socket.emit('receber_mensagem_privada', { nome: dados.de, texto: dados.texto, hora: dados.hora, contatoOriginal: dados.para });

        } catch (err) { console.error('Erro msg privada:', err); }
    });

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
    console.log(`🚀 Servidor rodando na porta ${PORTA}`);
});