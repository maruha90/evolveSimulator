// src/App.tsx

import React, { useEffect, useState, useCallback } from 'react'; // useCallback を追加
import './index.css';
import Card from './components/Card';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

// --- サーバーと共有する型定義 ---
interface CardData {
  id: string;
  name: string;
  image: string;
  cost: number;
  attack?: number;
  defense?: number;
  currentDefense?: number;
  isActed?: boolean;
  instanceId: string; // ★ 追加
}

interface PlayerState {
  id: string;
  name: string;
  hand: CardData[];
  deck: CardData[];
  field: CardData[];
  handCount: number;
  currentPP: number;
  maxPP: number;
  leaderLife: number; // ★ 追加
}

interface GameState {
  players: { [key: string]: PlayerState };
  turnPlayerId: string | null;
  gameStarted: boolean; // ★ 追加
}
// --- 型定義ここまで ---


function App() {
  const [clientGameState, setClientGameState] = useState<GameState>({
    players: {},
    turnPlayerId: null,
    gameStarted: false,
  });
  const [message, setMessage] = useState<string>(''); // サーバーからのメッセージ表示用

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  // stateの定義
  const [selectedTarget, setSelectedTarget] = useState<{ type: 'follower' | 'leader', id: string } | null>(null);

  // 攻撃対象の選択状態を管理
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  const myPlayerId = socket.id; // Socket ID をプレイヤーIDとして使用
  // 現在のプレイヤーの状態、相手の状態、ターン情報などを取得
  const myPlayerState = clientGameState.players[myPlayerId] || null;
  const otherPlayerStates = Object.values(clientGameState.players).filter(p => p.id !== myPlayerId);
  const opponentPlayerState = otherPlayerStates[0] || null;
  const isMyTurn = myPlayerId === clientGameState.turnPlayerId;

  // 手札と場のカードリストを計算
  const myHandCards = myPlayerState?.hand || [];
  const myFieldCards = myPlayerState?.field || [];
  const opponentFieldCards = opponentPlayerState?.field || [];

  // 選択中のカードが手札にあるか、場にあるか、そのカードオブジェクトを取得
  const selectedHandCard = myHandCards.find(card => card.instanceId === selectedCardId);
  const selectedFieldCard = myFieldCards.find(card => card.instanceId === selectedCardId);



  // カードクリックハンドラー (カードの選択/選択解除用)
  const handleCardClick = useCallback((card: CardData) => {
    console.log("Card clicked:", card);

    if (!myPlayerState || !isMyTurn) {
        setMessage("自分のターンではありません。");
        return;
    }

    // --- 攻撃対象の選択フェーズ ---
    // selectedAttackerId がセットされている (つまり、攻撃するフォロワーが既に選択されている) 場合
    if (selectedAttackerId) {
        // クリックしたカードが攻撃対象になりうるかチェック
        // 自分の場のフォロワーは攻撃対象にならない
        if (myPlayerState.field.some(f => f.instanceId === card.instanceId)) {
            // 自分のフォロワーをもう一度クリックしたら攻撃をキャンセル
            if (selectedAttackerId === card.instanceId) {
                console.log("Attack cancelled: Deselected attacker.");
                setSelectedAttackerId(null);
                setSelectedTargetId(null);
                setSelectedCardId(null); // 他の選択も解除
            } else {
                // 自分の別のフォロワーをクリックしたら、攻撃者を変更
                console.log("Attacker changed:", card.instanceId);
                setSelectedAttackerId(card.instanceId);
                setSelectedTargetId(null);
                setSelectedCardId(card.instanceId); // UIの選択状態も更新
            }
            return; // 自分のフォロワーのクリックはここで処理終了
        }

        // 相手の場のフォロワーを選択した場合
        const isOpponentFollower = opponentPlayerState?.field.some(f => f.instanceId === card.instanceId);
        if (isOpponentFollower) {
            console.log("Target selected (opponent follower):", card.instanceId);
            setSelectedTargetId(card.instanceId); // 攻撃対象として選択
            setMessage("攻撃するフォロワーを選択しました。攻撃ボタンを押してください。"); // UIメッセージ
            return; // 攻撃対象の選択はここで処理終了
        }

        // ここに到達した場合、無効なターゲットがクリックされた
        setMessage("無効な攻撃対象です。相手のフォロワーかリーダーを選択してください。");
        setSelectedTargetId(null); // 無効なターゲットを選択解除
        return;
    }

    // --- 通常のカード選択フェーズ --- (selectedAttackerId が null の場合)

    // 手札のカードの場合 (プレイするために選択)
    const isInHand = myPlayerState.hand.some(c => c.instanceId === card.instanceId);
    if (isInHand) {
        console.log("Card is in hand for selection.");
        if (selectedCardId === card.instanceId) {
            setSelectedCardId(null); // 選択解除
        } else {
            setSelectedCardId(card.instanceId); // 選択
        }
        return; // 手札のカードのクリックはここで処理終了
    }

    // 場の自分のフォロワーの場合 (攻撃者として選択)
    const isInField = myPlayerState.field.some(c => c.instanceId === card.instanceId);
    if (isInField) {
        console.log("Card is in field for selection (potential attacker).");
        // フォロワーであり、かつ未行動の場合のみ攻撃者として選択可能にする
        if (card.attack !== undefined && card.defense !== undefined && !card.isActed) {
            if (selectedCardId === card.instanceId && selectedAttackerId === card.instanceId) {
                // 既に攻撃者として選択されている場合、選択解除
                console.log("Deselecting attacker:", card.instanceId);
                setSelectedAttackerId(null);
                setSelectedCardId(null);
            } else {
                // 新しい攻撃者として選択
                console.log("Selecting attacker:", card.instanceId);
                setSelectedAttackerId(card.instanceId); // 攻撃者としてセット
                setSelectedCardId(card.instanceId); // UIの選択状態も更新
                setSelectedTargetId(null); // ターゲットはリセット
                setMessage("攻撃対象を選択してください。");
            }
        } else {
            // フォロワーではない、または行動済みの場合
            if (selectedCardId === card.instanceId) {
                console.log("Deselecting non-attacker card in field:", card.instanceId);
                setSelectedCardId(null);
            } else {
                console.log("Cannot select for attack: Not a follower or already acted.", card.instanceId);
                setMessage("このフォロワーは攻撃できません（行動済みかフォロワーではありません）。");
                setSelectedCardId(card.instanceId); // とりあえず選択状態にはする
            }
        }
        return; // 場のカードのクリックはここで処理終了
    }

    // どの条件にも合致しないカードがクリックされた場合
    console.log("Unhandled card click:", card.instanceId);

}, [myPlayerState, isMyTurn, selectedCardId, selectedAttackerId, opponentPlayerState]);

  // 選択した手札のカードをプレイするハンドラー
  const handlePlaySelectedCard = useCallback(() => {
    if (!myPlayerState || !isMyTurn) {
      setMessage('自分のターンではありません。');
      return;
    }

    if (!selectedHandCard) {
      setMessage('プレイするカードを選択してください。');
      return;
    }

    if (selectedHandCard.cost > myPlayerState.currentPP) {
      setMessage('PPが足りません！');
      return;
    }

    // フォロワーでないカード（スペルなど）もこのボタンでプレイする場合の考慮
    // 現時点では、スペルカードの特別な処理はサーバー側で行うと仮定し、
    // ここでは単にサーバーにプレイ要求を送る
    socket.emit('playCard', selectedHandCard.instanceId);
    setSelectedCardId(null); // プレイしたら選択を解除
    setMessage(''); // プレイ成功時にメッセージをクリア
  }, [myPlayerState, isMyTurn, selectedHandCard]); // 依存配列に myPlayerState, isMyTurn, selectedHandCard を追加



  // 攻撃を実行するハンドラー
  const handleAttack = useCallback(() => {
    if (!myPlayerState || !isMyTurn) {
      setMessage('自分のターンではありません。');
      return;
    }
    if (!selectedAttackerId || !selectedTargetId) {
      setMessage('攻撃するフォロワーと対象を選択してください。');
      return;
    }

    const attacker = myFieldCards.find(f => f.instanceId === selectedAttackerId);
    const target = opponentFieldCards.find(f => f.instanceId === selectedTargetId); // 相手フォロワーの場合

    if (!attacker) {
      setMessage('選択された攻撃フォロワーが見つかりません。');
      return;
    }

    // ★ ここでリーダーへの攻撃とフォロワーへの攻撃を区別する必要がある
    // 現状では target が存在すれば相手フォロワー、なければリーダーと仮定する（要修正）
    // 例えば、target を { type: 'follower' | 'leader', id: string } のようなオブジェクトにするのが良い

    socket.emit('attack', {
      attackerId: selectedAttackerId,
      targetId: selectedTargetId // これは相手フォロワーのID
      // targetType: 'follower' // もしくは 'leader'
    });

    // 攻撃後は選択状態を解除
    setSelectedAttackerId(null);
    setSelectedTargetId(null);
    setSelectedCardId(null);
    setMessage('');

  }, [myPlayerState, isMyTurn, selectedAttackerId, selectedTargetId, myFieldCards, opponentFieldCards]); // 依存配列

  // handleLeaderClick の追加
  const handleLeaderClick = useCallback((playerType: 'opponent' | 'my') => {
      if (!myPlayerState || !isMyTurn || !selectedAttackerId) {
          setMessage('攻撃するフォロワーを選択してからリーダーをクリックしてください。');
          return;
      }
      if (playerType === 'my') {
          setMessage('自分のリーダーは攻撃できません。');
          return;
      }

      console.log("Target selected (opponent leader): Leader");
      setSelectedTarget({ type: 'leader', id: opponentPlayerState?.id || '' }); // 相手リーダーを選択
      setMessage("攻撃するフォロワーを選択しました。攻撃ボタンを押してください。");

  }, [myPlayerState, isMyTurn, selectedAttackerId, opponentPlayerState]);

  // handleAttack の修正 (targetType を含める)
  socket.emit('attack', {
      attackerId: selectedAttackerId,
      targetId: selectedTarget.id,
      targetType: selectedTarget.type
  });

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server! My Socket ID:', socket.id);
    });

    socket.on('gameStateUpdated', (state: GameState) => {
      console.log('Received game state update:', state);
      setClientGameState(state);
      setMessage(''); // 新しい状態が来たらメッセージをクリア
      // ここで setSelectedCardId をリセットしない！
    });

    socket.on('message', (msg) => {
      console.log('Message from server (general):', msg);
      setMessage(msg); // サーバーからのメッセージを表示
    });

    return () => {
      socket.off('connect');
      socket.off('gameStateUpdated');
      socket.off('message');
    };
  }, []);

  // デバッグ用に現在のゲーム状態を表示
  console.log("Client Side Game State:", clientGameState);


  return (
    <div className="min-h-screen bg-green-900 text-white flex flex-col items-center justify-between p-4 relative">
      {/* ターン表示 */}
      <div className="text-2xl font-bold mb-4">
        {clientGameState.gameStarted ? (isMyTurn ? "自分のターン" : "相手のターン") : "ゲーム開始待機中..."}
      </div>

      {/* サーバーからのメッセージ表示 */}
      {message && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600 p-3 rounded-md shadow-lg z-50 animate-bounce">
          {message}
        </div>
      )}

      {/* PP表示 (自分と相手) - 配置を調整 */}
      // 相手リーダーのライフ表示の div に onClick を追加
      <div
        className="absolute top-4 right-4 text-xl bg-gray-700 p-2 rounded-md shadow-md cursor-pointer"
        onClick={isMyTurn && selectedAttackerId ? () => handleLeaderClick('opponent') : undefined}
      >
        <p>相手のPP: {opponentPlayerState?.currentPP || 0}/{opponentPlayerState?.maxPP || 0}</p>
        <p>相手のライフ: {opponentPlayerState?.leaderLife || 0}</p>
      </div>
      <div className="absolute bottom-4 right-4 text-xl bg-gray-700 p-2 rounded-md shadow-md">
        <p>自分のPP: {myPlayerState?.currentPP || 0}/{myPlayerState?.maxPP || 0}</p>
        <p>自分のライフ: {myPlayerState?.leaderLife || 0}</p>
      </div>

      {/* ターン終了ボタン */}
      <button
        onClick={() => socket.emit('endTurn')}
        className={`bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow-lg ${!isMyTurn && 'opacity-50 cursor-not-allowed'}`}
        disabled={!isMyTurn}
      >
        ターン終了
      </button>

      {/* プレイボタン */}
      <button
        onClick={handlePlaySelectedCard}
        className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow-lg mt-4
          ${!isMyTurn || !selectedHandCard || (selectedHandCard.cost > (myPlayerState?.currentPP || 0)) ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={!isMyTurn || !selectedHandCard || (selectedHandCard.cost > (myPlayerState?.currentPP || 0))}
      >
        カードをプレイ
      </button>

      <button
        onClick={handleAttack} // 後で作成するハンドラー
        className={`bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded shadow-lg mt-2
          ${!isMyTurn || !selectedAttackerId || !selectedTargetId ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={!isMyTurn || !selectedAttackerId || !selectedTargetId}
      >
        攻撃！
      </button>

      {/* --- 相手のエリア --- */}
      <div className="w-full max-w-6xl bg-gray-800 rounded-lg shadow-xl p-4 flex flex-col items-center mb-4">
        <p className="text-xl font-bold mb-3">{opponentPlayerState ? `${opponentPlayerState.name}の場` : '相手の場'}</p>
        <div className="flex justify-center space-x-4 min-h-[200px] w-full border border-gray-700 rounded-md p-2 bg-gray-700 overflow-visible">
          {opponentFieldCards.length === 0 ? (
            <p className="text-gray-400 self-center">カードがありません</p>
          ) : (
            opponentFieldCards.map((card) => (
              <Card
                key={card.instanceId} // key を instanceId に修正
                imageSrc={card.image}
                altText={card.name}
                // 攻撃対象可能なら緑の枠線などを表示
                className={`
                  ${card.isActed ? 'rotate-90 transform origin-bottom-left' : ''}
                  ${isMyTurn && selectedAttackerId && card.attack !== undefined && card.defense !== undefined ? 'hover:border-2 hover:border-green-500' : ''}
                  ${selectedTarget?.id === card.instanceId && selectedTarget.type === 'follower' ? 'border-4 border-red-500' : ''} // ターゲット選択時のハイライト (任意)
                `}
                onClick={isMyTurn && selectedAttackerId ? () => handleCardClick(card) : undefined} // 攻撃者が選択されている時のみクリック可能
                isTargetable={isMyTurn && selectedAttackerId && card.attack !== undefined && card.defense !== undefined} // ★ 追加
                // ★ 攻撃力と体力を渡す
                attack={card.attack}
                currentDefense={card.currentDefense}
                maxDefense={card.defense}
                // isSelected は相手のカードには不要だが、型エラーを避けるため undefined または false
                isSelected={false}
              />
            ))
          )}
        </div>
        {/* ... 相手の手札表示は変更なし ... */}
      </div>

      {/* --- 自分のエリア --- */}
      <div className="w-full max-w-6xl bg-gray-800 rounded-lg shadow-xl p-4 flex flex-col items-center mt-4">
        <p className="text-xl font-bold mb-3">{myPlayerState ? `${myPlayerState.name}の場` : '自分の場'}</p>
        <div className="flex justify-center space-x-4 min-h-[200px] w-full border border-gray-700 rounded-md p-2 bg-gray-700 overflow-visible">
          {myFieldCards.length === 0 ? (
            <p className="text-gray-400 self-center">カードがありません</p>
          ) : (
            myFieldCards.map((card) => (
              <Card
                key={card.instanceId} // key を instanceId に修正
                imageSrc={card.image}
                altText={card.name}
                // 場のカードは常にクリック可能にする (後々攻撃対象選択などで使うため)
                onClick={isMyTurn ? () => handleCardClick(card) : undefined}
                isSelected={selectedCardId === card.instanceId} // instanceId で比較
                isAttackerSelected={selectedAttackerId === card.instanceId} // ★ 追加
                // 攻撃済みなら半透明にするなどのクラス
                className={`
                  ${card.isActed ? 'opacity-70 cursor-not-allowed' : ''}
                  ${selectedAttackerId === card.instanceId ? 'border-4 border-yellow-500' : ''}
                  ${selectedCardId === card.instanceId && !selectedAttackerId ? 'border-4 border-blue-500 shadow-blue-500/50' : ''} // 通常選択時
                `}
                // ★ 攻撃力と体力を渡す
                attack={card.attack}
                currentDefense={card.currentDefense}
                maxDefense={card.defense}
                instanceId={card.instanceId} // CardコンポーネントにもinstanceIdを渡す
              />
            ))
          )}
        </div>
        <p className="text-xl font-bold mt-5 mb-3">{myPlayerState ? `${myPlayerState.name}の手札` : '自分の手札'}</p>
        <div className="flex justify-center space-x-2 min-h-[160px] w-full border border-gray-700 rounded-md p-2 bg-gray-700">
          {myHandCards.length === 0 ? (
            <p className="text-gray-400 self-center">カードがありません</p>
          ) : (
            myHandCards.map((card) => (
              <Card
                key={card.instanceId} // key を instanceId に修正
                imageSrc={card.image}
                altText={card.name}
                className={
                    // 手札のカードは、自分のターンでPPが足りる場合のみアクティブな見た目にする
                    // クリックは常に可能にし、onClickで選択状態を切り替える
                    isMyTurn && myPlayerState && card.cost <= myPlayerState.currentPP
                        ? ''
                        : 'opacity-50' // PP不足でもクリックはできるが、見た目を暗く
                }
                onClick={isMyTurn ? () => handleCardClick(card) : undefined} // 自分のターンのみクリック可能
                isSelected={selectedCardId === card.instanceId} // 手札のカードも選択状態を反映
                // ★ 攻撃力と体力を渡す (手札のカードにも)
                attack={card.attack}
                currentDefense={card.currentDefense}
                maxDefense={card.defense}
                instanceId={card.instanceId} // CardコンポーネントにもinstanceIdを渡す
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;