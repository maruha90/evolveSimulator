// src/index.ts
import { Server } from 'socket.io';
import { Game } from './game.js'; // ★ Gameクラスと型定義をインポート
const io = new Server(3000, {
    cors: {
        origin: '*', // すべてのオリジンからの接続を許可（開発用）
        methods: ['GET', 'POST'],
    },
});
console.log('Server running on port 3000');
console.log('Open http://localhost:3000 in your browser.');
// 接続中のプレイヤーとゲームインスタンスを管理する
// Key: Socket ID (プレイヤーID)
const connectedPlayers = {}; // socketId -> playerId (今は同じ)
const games = {}; // playerId -> Gameインスタンス
io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);
    connectedPlayers[socket.id] = socket.id; // 仮にsocket.idをそのままplayerIdとして使う
    // 現在接続しているプレイヤー数を確認
    const playerIds = Object.keys(connectedPlayers);
    console.log('Current connected players:', playerIds);
    // 2人のプレイヤーが接続したらゲームを開始
    if (playerIds.length === 2) {
        const player1Id = playerIds[0];
        const player2Id = playerIds[1];
        // 既にゲームが存在する場合は何もしないか、新しいゲームを開始するか
        if (!games[player1Id] && !games[player2Id]) {
            const newGame = new Game(player1Id, player2Id);
            games[player1Id] = newGame;
            games[player2Id] = newGame; // 両方のプレイヤーIDで同じゲームインスタンスを参照
            console.log('Both players connected. Game ready to start!');
            // 両プレイヤーに初期ゲーム状態を送信
            io.to(player1Id).emit('gameStateUpdated', newGame.getGameState(player1Id));
            io.to(player2Id).emit('gameStateUpdated', newGame.getGameState(player2Id));
            console.log('Initial game state sent to all clients.');
        }
    }
    socket.on('endTurn', () => {
        const game = games[socket.id];
        if (!game) {
            socket.emit('message', 'ゲームが見つかりません。');
            return;
        }
        try {
            game.endTurn(socket.id); // ゲームインスタンスのendTurnメソッドを呼び出す
            // ターン終了後、両プレイヤーに最新のゲーム状態を送信
            io.to(game.player1Id).emit('gameStateUpdated', game.getGameState(game.player1Id));
            io.to(game.player2Id).emit('gameStateUpdated', game.getGameState(game.player2Id));
        }
        catch (error) {
            socket.emit('message', error.message);
            console.error('End turn error:', error);
        }
    });
    socket.on('playCard', (cardInstanceId) => {
        const game = games[socket.id];
        if (!game) {
            socket.emit('message', 'ゲームが見つかりません。');
            return;
        }
        try {
            game.playCard(socket.id, cardInstanceId); // ゲームインスタンスのplayCardメソッドを呼び出す
            // カードプレイ後、両プレイヤーに最新のゲーム状態を送信
            io.to(game.player1Id).emit('gameStateUpdated', game.getGameState(game.player1Id));
            io.to(game.player2Id).emit('gameStateUpdated', game.getGameState(game.player2Id));
        }
        catch (error) {
            socket.emit('message', error.message);
            console.error('Play card error:', error);
        }
    });
    // ★ 攻撃イベントのリスナーを追加
    socket.on('attack', (payload) => {
        const game = games[socket.id];
        if (!game) {
            socket.emit('message', 'ゲームが見つかりません。');
            return;
        }
        try {
            game.handleAttack(socket.id, payload.attackerId, payload.targetId, payload.targetType);
            // 攻撃後、両プレイヤーに最新のゲーム状態を送信
            io.to(game.player1Id).emit('gameStateUpdated', game.getGameState(game.player1Id));
            io.to(game.player2Id).emit('gameStateUpdated', game.getGameState(game.player2Id));
        }
        catch (error) {
            socket.emit('message', error.message);
            console.error('Attack error:', error);
        }
    });
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        const game = games[socket.id]; // 接続が切れたプレイヤーが属するゲームを取得
        if (game) {
            // 相手プレイヤーにも接続切断を通知する
            const opponentId = game.getOpponentPlayerId(socket.id);
            if (opponentId && connectedPlayers[opponentId]) {
                io.to(opponentId).emit('message', '相手プレイヤーが切断しました。');
            }
            // ゲームインスタンスと接続中のプレイヤー情報をクリーンアップ
            delete games[game.player1Id];
            delete games[game.player2Id];
        }
        delete connectedPlayers[socket.id];
        console.log('Current connected players:', Object.keys(connectedPlayers));
    });
});
