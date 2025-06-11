// src/game.ts
import { v4 as uuidv4 } from "uuid"; // インスタンスID生成のためにuuidをインポート
// --- 型定義ここまで ---
export class Game {
    player1Id;
    player2Id;
    players;
    turnPlayerId;
    turn;
    gameStarted;
    constructor(player1Id, player2Id) {
        this.player1Id = player1Id;
        this.player2Id = player2Id;
        this.turnPlayerId = null; // ゲーム開始時に設定
        this.turn = 0; // ターン数
        this.gameStarted = false;
        // 各プレイヤーの初期状態を設定
        this.players = {
            [player1Id]: this.createInitialPlayerState(player1Id, "Player A"),
            [player2Id]: this.createInitialPlayerState(player2Id, "Player B"),
        };
        this.initializeGame();
    }
    // プレイヤーの初期状態を作成
    createInitialPlayerState(id, name) {
        // ここで各プレイヤーの初期デッキをロードまたは生成します
        // 例としてダミーのカードデータを使用します
        const dummyDeck = Array.from({ length: 20 }, (_, i) => {
            // カード番号 (1から20) を取得し、3桁でゼロ埋めします
            const cardNumber = String(i + 1).padStart(3, '0');
            return {
                id: `SD01-${cardNumber}`,
                instanceId: uuidv4(),
                name: `Dummy Card ${i + 1}`,
                image: `/cards/SD01-${cardNumber}.png`, // ★ この行を修正
                cost: Math.floor(Math.random() * 5) + 1,
                attack: i % 2 === 0 ? Math.floor(Math.random() * 5) + 1 : undefined,
                defense: i % 2 === 0 ? Math.floor(Math.random() * 5) + 1 : undefined,
                currentDefense: undefined,
                isActed: undefined,
            };
        }).sort(() => Math.random() - 0.5);
        return {
            id: id,
            name: name,
            hand: [],
            deck: dummyDeck, // 初期デッキ
            field: [],
            handCount: 0,
            currentPP: 0,
            maxPP: 0,
            leaderLife: 20, // 初期ライフ
        };
    }
    // ゲームの初期化処理
    initializeGame() {
        // 最初のターンプレイヤーをランダムに決定
        const playerIds = Object.keys(this.players);
        this.turnPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)];
        this.gameStarted = true;
        this.turn = 1;
        // 初期手札を配る
        this.drawInitialHands();
        console.log(`Setting ${this.turnPlayerId} as the first turn player.`);
    }
    // 初期手札を配る
    drawInitialHands() {
        Object.values(this.players).forEach((player) => {
            for (let i = 0; i < 4; i++) {
                // 各プレイヤーに4枚ドローさせる
                if (player.deck.length > 0) {
                    const card = player.deck.shift();
                    if (card) {
                        player.hand.push(card);
                        console.log(`Player ${player.name} initial hand:`, player.hand.map(c => c.name)); // ★ 追加
                    }
                }
            }
            player.handCount = player.hand.length;
        });
    }
    // プレイヤーの状態をクライアントに送信するために整形
    getGameState(viewerId) {
        const myPlayer = this.players[viewerId];
        const opponentPlayer = this.players[this.getOpponentPlayerId(viewerId)];
        if (!myPlayer || !opponentPlayer) {
            throw new Error("ゲーム状態の取得中にプレイヤーが見つかりません。");
        }
        return {
            players: this.players,
            myPlayerState: myPlayer,
            opponentPlayerState: {
                id: opponentPlayer.id,
                name: opponentPlayer.name,
                handCount: opponentPlayer.hand.length, // 相手の手札枚数のみ
                field: opponentPlayer.field,
                currentPP: opponentPlayer.currentPP,
                maxPP: opponentPlayer.maxPP,
                leaderLife: opponentPlayer.leaderLife,
            },
            isMyTurn: this.turnPlayerId === viewerId,
            turn: this.turn,
            gameStarted: this.gameStarted,
        };
    }
    // 相手プレイヤーのIDを取得
    getOpponentPlayerId(playerId) {
        return playerId === this.player1Id ? this.player2Id : this.player1Id;
    }
    // PPの回復とドロー、行動済み状態のリセット
    endTurn(playerId) {
        if (this.turnPlayerId !== playerId) {
            throw new Error("自分のターンではありません。");
        }
        const currentPlayer = this.players[playerId];
        const opponentPlayer = this.players[this.getOpponentPlayerId(playerId)];
        // 現在のプレイヤーの行動済みフォロワーをリセット
        currentPlayer.field.forEach((card) => {
            if (card.isActed !== undefined) {
                card.isActed = false; // 行動済みフラグをリセット
            }
        });
        // ターンプレイヤーを交代
        this.turnPlayerId = opponentPlayer.id;
        this.turn++;
        // 次のターンプレイヤーのPPを回復し、ドローさせる
        opponentPlayer.maxPP = Math.min(opponentPlayer.maxPP + 1, 10); // 最大10PP
        opponentPlayer.currentPP = opponentPlayer.maxPP;
        // ドロー処理
        if (opponentPlayer.deck.length > 0) {
            const drawnCard = opponentPlayer.deck.shift();
            if (drawnCard) {
                opponentPlayer.hand.push(drawnCard);
                opponentPlayer.handCount = opponentPlayer.hand.length; // 手札枚数を更新
                console.log(`${opponentPlayer.name} drew a card for their turn.`);
            }
        }
        else {
            console.log(`${opponentPlayer.name}'s deck is empty.`);
        }
        console.log(`Player ${playerId} ended their turn. It's now ${this.turnPlayerId}'s turn.`);
        console.log(`${this.turnPlayerId}'s turn. PP: ${opponentPlayer.currentPP}/${opponentPlayer.maxPP}`);
    }
    // カードプレイ処理
    playCard(playerId, cardInstanceId) {
        const player = this.players[playerId];
        if (!player || this.turnPlayerId !== playerId) {
            throw new Error("自分のターンではありません。");
        }
        const cardIndex = player.hand.findIndex((c) => c.instanceId === cardInstanceId);
        if (cardIndex === -1) {
            throw new Error("手札にそのカードはありません。");
        }
        const cardToPlay = player.hand[cardIndex];
        if (cardToPlay.cost > player.currentPP) {
            throw new Error("PPが足りません！");
        }
        player.currentPP -= cardToPlay.cost;
        player.hand.splice(cardIndex, 1); // 手札から削除
        player.handCount = player.hand.length; // 手札枚数を更新
        // ここでカードの種類に応じた処理を分岐させます
        if (cardToPlay.attack !== undefined && cardToPlay.defense !== undefined) {
            // フォロワーカードの場合
            cardToPlay.currentDefense = cardToPlay.defense; // 現在の体力を初期化
            cardToPlay.isActed = true; // 場に出たターンは基本行動済み
            player.field.push(cardToPlay);
            console.log(`Player ${playerId} played follower: ${cardToPlay.name}. Remaining PP: ${player.currentPP}/${player.maxPP}`);
        }
        else {
            // スペルカードの場合 (現時点では何もしないか、単純に捨てる)
            console.log(`Player ${playerId} played spell: ${cardToPlay.name}. Remaining PP: ${player.currentPP}/${player.maxPP}`);
            // スペルの効果処理をここに追加
        }
        console.log(`--- Field after playCard ---`);
        console.log(JSON.stringify(player.field, null, 2));
        console.log(`---------------------------`);
    }
    // ★ 攻撃処理のメインロジック (前回の回答で提示したもの)
    handleAttack(playerId, attackerInstanceId, targetId, targetType) {
        const currentPlayer = this.players[playerId];
        const opponentPlayer = this.players[this.getOpponentPlayerId(playerId)];
        if (!currentPlayer || !opponentPlayer) {
            throw new Error("プレイヤーの状態が不正です。");
        }
        if (this.turnPlayerId !== playerId) {
            throw new Error("自分のターンではありません。");
        }
        const attacker = currentPlayer.field.find((card) => card.instanceId === attackerInstanceId);
        if (!attacker ||
            attacker.attack === undefined ||
            attacker.defense === undefined) {
            throw new Error("選択されたフォロワーは攻撃者として無効です。");
        }
        if (attacker.isActed) {
            throw new Error("このフォロワーは既に行動済みです。");
        }
        // 攻撃対象の取得と処理
        if (targetType === "follower") {
            const targetFollower = opponentPlayer.field.find((card) => card.instanceId === targetId);
            if (!targetFollower || targetFollower.currentDefense === undefined) {
                throw new Error("選択されたターゲットフォロワーが見つかりません。");
            }
            console.log(`[ATTACK] ${attacker.name} (${attacker.attack}/${attacker.currentDefense}) attacks ${targetFollower.name} (${targetFollower.attack}/${targetFollower.currentDefense})`);
            // ダメージ計算
            targetFollower.currentDefense -= attacker.attack;
            attacker.currentDefense -= targetFollower.attack; // 相打ちの場合を考慮 (フォロワーもダメージを受ける)
            // 戦闘後の処理（破壊）
            this.checkAndRemoveDestroyedFollowers(currentPlayer);
            this.checkAndRemoveDestroyedFollowers(opponentPlayer);
            // 攻撃したフォロワーを行動済みにする
            attacker.isActed = true;
        }
        else if (targetType === "leader") {
            console.log(`[ATTACK] ${attacker.name} (${attacker.attack}/${attacker.currentDefense}) attacks opponent leader.`);
            opponentPlayer.leaderLife -= attacker.attack; // リーダーライフを減らす
            // 攻撃したフォロワーを行動済みにする
            attacker.isActed = true;
        }
        else {
            throw new Error("無効な攻撃対象タイプです。");
        }
        console.log(`[ATTACK_RESULT] Current player field:`, currentPlayer.field.map((c) => ({ name: c.name, hp: c.currentDefense })));
        console.log(`[ATTACK_RESULT] Opponent player field:`, opponentPlayer.field.map((c) => ({ name: c.name, hp: c.currentDefense })));
        console.log(`[ATTACK_RESULT] Opponent Leader Life: ${opponentPlayer.leaderLife}`);
        // リーダーライフが0以下になった場合のゲーム終了処理などを追加
        if (opponentPlayer.leaderLife <= 0) {
            this.endGame(playerId); // 攻撃側が勝利
            console.log(`Game Over! Player ${playerId} wins!`);
        }
    }
    // 破壊されたフォロワーを場から取り除くヘルパーメソッド
    checkAndRemoveDestroyedFollowers(player) {
        player.field = player.field.filter((card) => {
            if (card.currentDefense !== undefined && card.currentDefense <= 0) {
                console.log(`${card.name} (${card.instanceId}) was destroyed.`);
                return false; // 破壊されたカードはフィルターで除外
            }
            return true;
        });
    }
    // ゲーム終了処理 (必要に応じて実装)
    endGame(winnerId) {
        this.gameStarted = false;
        this.turnPlayerId = null;
        console.log(`Game has ended. Winner: ${winnerId}`);
        // ここで勝者情報をクライアントに送信したり、ゲームをリセットするなどの処理
    }
}
