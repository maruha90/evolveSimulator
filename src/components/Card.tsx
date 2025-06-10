// src/components/Card.tsx

import React from 'react';

interface CardProps {
  imageSrc: string;
  altText: string;
  onClick?: () => void;
  className?: string;
  attack?: number;
  currentDefense?: number;
  maxDefense?: number;
  isSelected?: boolean;
  instanceId?: string; // ★ ここに追加
  isAttackerSelected?: boolean; // 自分が攻撃者として選択されたか
  isTargetable?: boolean;       // 攻撃対象として選択可能か
}

const Card: React.FC<CardProps> = ({
  imageSrc,
  altText,
  onClick,
  className,
  attack,
  currentDefense,
  maxDefense,
  isSelected,
  instanceId, // ★ ここにも追加
  isAttackerSelected,
  isTargetable
}) => {
  // フォロワー判定を厳密にする (attack/defenseが両方undefinedでない場合)
  const isFollower = attack !== undefined && currentDefense !== undefined && maxDefense !== undefined;

  // isSelected に基づいて条件付きでクラスを追加
  const cardClasses = `
    relative
    w-32 h-44 // カードのサイズ
    bg-gray-800 // カードの背景色
    rounded-lg
    shadow-lg
    overflow-hidden
    cursor-pointer
    transform transition-transform duration-100 ease-out
    hover:scale-105
    ${isSelected ? 'border-4 border-blue-500 shadow-blue-500/50' : ''} // 選択されたら青い枠線と影
    ${isAttackerSelected ? 'border-4 border-yellow-500' : ''} // 攻撃者として選択されたら黄色い枠線
    ${isTargetable ? 'hover:border-4 hover:border-green-500' : ''} // 攻撃対象可能ならホバーで緑の枠線
    ${className || ''}
  `;

  const displayDefense = currentDefense !== undefined ? currentDefense : maxDefense;

  return (
    <div
      className={`
        w-28 h-40
        bg-gray-600 rounded-md shadow-md
        overflow-visible
        flex-shrink-0
        relative
        ${onClick ? 'cursor-pointer transform hover:scale-105 transition-transform duration-200 ease-in-out' : ''}
        ${className || ''}
        ${isSelected ? 'border-4 border-blue-500 ring-4 ring-blue-500' : ''} // isSelected を使用
      `}
      onClick={onClick}
    >
      <img src={imageSrc} alt={altText} className="w-full h-full object-cover" />
      {isFollower && (
        <>
          <div className="absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-lg font-bold px-2 rounded z-10">
            {attack}/{displayDefense}
          </div>
        </>
      )}
    </div>
  );
};

export default Card;