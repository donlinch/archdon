// public/game/MonopolyGame.js
// REMOVE: import React, { useState, useEffect } from 'react';

// 直接定義組件，移除外層的 const MonopolyGame = () => { ... };
const MonopolyGame = () => {
  // 從這裡開始是你原本內層 MonopolyGame 的所有代碼...
  // 定義遊戲板的大小和格子尺寸，為iPad橫式調整
  const boardSize = 7;
  const cellSize = 90; // 增大格子尺寸
  const boardWidth = cellSize * boardSize;
  const boardHeight = cellSize * boardSize;

  // 定義路徑上的格子
  const [pathCells, setPathCells] = React.useState([]); // 使用 React.useState
  // 玩家在路徑中的索引位置
  const [player1PathIndex, setPlayer1PathIndex] = React.useState(0); // 使用 React.useState
  const [player2PathIndex, setPlayer2PathIndex] = React.useState(0); // 使用 React.useState
  // 當前選擇的玩家
  const [selectedPlayer, setSelectedPlayer] = React.useState(1); // 使用 React.useState
  // 彈窗狀態
  const [modalOpen, setModalOpen] = React.useState(false); // 使用 React.useState
  const [modalContent, setModalContent] = React.useState({ title: '', description: '', color: '' }); // 使用 React.useState
  // 骰子狀態
  const [diceValue, setDiceValue] = React.useState(null); // 使用 React.useState
  const [isRolling, setIsRolling] = React.useState(false); // 使用 React.useState
  // 是否正在移動中
  const [isMoving, setIsMoving] = React.useState(false); // 使用 React.useState
  // 當前高亮的格子
  const [highlightedCell, setHighlightedCell] = React.useState(null); // 使用 React.useState
  // 玩家移動歷史，用於"回上一步"功能
  const [moveHistory, setMoveHistory] = React.useState([]); // 使用 React.useState

  // 初始化遊戲板和路徑
  React.useEffect(() => { // 使用 React.useEffect
    const createPathCells = () => {
      const path = [];

      // 首先添加起點/終點 (右下角)
      path.push({
        x: boardSize - 1,
        y: boardSize - 1,
        title: '起點/終點',
        description: '遊戲的起點和終點。',
        color: '#FFA500'
      });

      // 1. 右側從下到上 (第一步往上)
      for (let y = boardSize - 2; y >= 0; y--) {
        path.push({
          x: boardSize - 1,
          y,
          title: `右側 ${boardSize - y - 1}`,
          description: `這是右側第 ${boardSize - y - 1} 格。`,
          color: getRandomColor()
        });
      }

      // 2. 頂部從右到左 (右上到左上)
      for (let x = boardSize - 2; x >= 0; x--) {
        path.push({
          x,
          y: 0,
          title: `頂部 ${boardSize - x - 1}`,
          description: `這是頂部第 ${boardSize - x - 1} 格。`,
          color: getRandomColor()
        });
      }

      // 3. 左側從上到下 (左上到左下)
      for (let y = 1; y < boardSize; y++) {
        path.push({
          x: 0,
          y,
          title: `左側 ${y}`,
          description: `這是左側第 ${y} 格。`,
          color: getRandomColor()
        });
      }

      // 4. 底部從左到右 (左下到右下，不包括起點/終點)
      for (let x = 1; x < boardSize - 1; x++) {
        path.push({
          x,
          y: boardSize - 1,
          title: `底部 ${x}`,
          description: `這是底部第 ${x} 格。`,
          color: getRandomColor()
        });
      }

      return path;
    };

    const path = createPathCells();
    setPathCells(path);
  }, []); // 依賴項為空陣列，確保只執行一次

  // 生成隨機顏色
  const getRandomColor = () => {
    const colors = ['#FFD700', '#FF6347', '#4682B4', '#32CD32', '#9370DB', '#FF69B4', '#20B2AA'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // 處理格子點擊事件
  const handleCellClick = (cell) => {
    setModalContent({
      title: cell.title,
      description: cell.description,
      color: cell.color
    });
    setModalOpen(true);
  };

  // 擲骰子
  const rollDice = () => {
    if (isRolling || isMoving) return;

    setIsRolling(true);

    // 模擬骰子滾動的視覺效果
    let rollCount = 0;
    const maxRolls = 10; // 滾動次數

    const rollInterval = setInterval(() => {
      // 生成1-6的隨機數字
      const randomValue = Math.floor(Math.random() * 6) + 1;
      setDiceValue(randomValue);

      rollCount++;

      if (rollCount >= maxRolls) {
        clearInterval(rollInterval);
        setIsRolling(false);

        // 在移動前保存當前狀態到歷史記錄
        const currentState = {
          player1PathIndex,
          player2PathIndex,
          selectedPlayer
        };
        setMoveHistory(prev => [...prev, currentState]);

        // 擲骰子結束後，移動玩家
        movePlayer(randomValue);
      }
    }, 100);
  };

  // 處理玩家移動
  const movePlayer = (steps) => {
    if (isMoving) return;

    setIsMoving(true);
    setHighlightedCell(null); // 清除之前的高亮

    // 決定當前移動的玩家
    const currentPlayerPathIndex = selectedPlayer === 1 ? player1PathIndex : player2PathIndex;
    const setCurrentPlayerPathIndex = selectedPlayer === 1 ? setPlayer1PathIndex : setPlayer2PathIndex;

    // 計算新位置
    let newIndex = currentPlayerPathIndex + steps;

    // 如果超過或剛好到終點，停在終點 (大富翁通常是繞圈，回到起點附近)
    // newIndex %= pathCells.length; // 修正：使用取模運算來循環
     if (newIndex >= pathCells.length) {
        newIndex = 0; // 如果剛好或超過，回到起點
        // 在這裡可以添加 "經過起點" 的獎勵邏輯 (如果需要)
        console.log(`玩家 ${selectedPlayer} 回到起點!`);
     }


    // 直接移動到新位置
    setCurrentPlayerPathIndex(newIndex);

    // 移動完成後顯示格子信息
    setTimeout(() => {
      setIsMoving(false);
      setHighlightedCell(newIndex); // 高亮當前格子

      // 顯示玩家到達的格子信息 (確保 pathCells 有內容)
      if (pathCells.length > 0 && pathCells[newIndex]) {
        const arrivedCell = pathCells[newIndex];
        setModalContent({
          title: `玩家 ${selectedPlayer} 到達 ${arrivedCell.title}`,
          description: arrivedCell.description,
          color: arrivedCell.color
        });
        setModalOpen(true);
      } else {
        console.error("無法獲取到達格子的信息， pathCells:", pathCells, "newIndex:", newIndex);
      }
    }, 500); // 稍微延遲以看到移動效果
  };

  // 獲取玩家實際位置
  const getPlayerPosition = (playerPathIndex) => {
    // 確保 pathCells 已經加載且 playerPathIndex 有效
    if (!pathCells || pathCells.length === 0 || playerPathIndex < 0 || playerPathIndex >= pathCells.length) {
      // 提供一個安全的預設值或初始值
       // console.warn("路徑尚未加載或索引無效，返回預設位置");
      return { x: boardSize - 1, y: boardSize - 1 }; // 預設在右下角 (起點)
    }
    return {
      x: pathCells[playerPathIndex].x,
      y: pathCells[playerPathIndex].y
    };
  };

  // 關閉彈窗
  const closeModal = () => {
    setModalOpen(false);
  };

  // 回上一步
  const undoMove = () => {
    if (moveHistory.length === 0 || isRolling || isMoving) return;

    const prevState = moveHistory[moveHistory.length - 1];
    setPlayer1PathIndex(prevState.player1PathIndex);
    setPlayer2PathIndex(prevState.player2PathIndex);
    setSelectedPlayer(prevState.selectedPlayer);

    // 移除最近的歷史記錄
    setMoveHistory(prev => prev.slice(0, -1));
    setHighlightedCell(null); // 清除高亮
    setDiceValue(null); // 清除骰子數字
  };

  // 重置遊戲
  const resetGame = () => {
    setPlayer1PathIndex(0);
    setPlayer2PathIndex(0);
    setDiceValue(null);
    setHighlightedCell(null);
    setSelectedPlayer(1);
    setMoveHistory([]);
    setModalOpen(false); // 關閉可能打開的彈窗
  };

  // 計算玩家坐標 (確保在 pathCells 加載後再計算)
  const player1Position = getPlayerPosition(player1PathIndex);
  const player2Position = getPlayerPosition(player2PathIndex);

  // --- JSX 返回部分 ---
  // 注意：因為我們在瀏覽器直接使用 React，所以用 React.createElement 的語法或者依賴 Babel 轉換 JSX
  // 下面的 JSX 假設 Babel 會正確轉換
  return (
    // 使用 Tailwind CSS class (你需要確保 Tailwind 或等效 CSS 被加載)
    // 如果沒有使用 Tailwind，你需要用普通 CSS 或 style 屬性來實現佈局和樣式
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: '20px', backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
      {/* 左側遊戲面板 */}
      <div
        style={{
          position: 'relative',
          width: `${boardWidth}px`,
          height: `${boardHeight}px`,
          backgroundColor: '#e0e0e0', // Slightly different background for the board
          border: '2px solid #333'
        }}
      >
        {/* 繪製路徑格子 */}
        {pathCells.map((cell, index) => (
          <div
            key={index}
            onClick={() => handleCellClick(cell)}
            style={{
              position: 'absolute',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #aaa', // Lighter border
              fontSize: '11px', // Smaller font size for cell titles
              fontWeight: 'bold',
              overflow: 'hidden',
              textAlign: 'center',
              padding: '2px',
              left: `${cell.x * cellSize}px`,
              top: `${cell.y * cellSize}px`,
              width: `${cellSize}px`,
              height: `${cellSize}px`,
              backgroundColor: cell.color,
              transform: highlightedCell === index ? 'scale(1.05)' : 'scale(1)',
              zIndex: highlightedCell === index ? 2 : 1,
              boxShadow: highlightedCell === index ? '0 0 10px 5px rgba(255, 215, 0, 0.7)' : 'none',
              transition: 'transform 0.3s, box-shadow 0.3s'
            }}
          >
            {cell.title}
          </div>
        ))}

        {/* 玩家1角色 */}
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            backgroundColor: 'red',
            border: '2px solid white',
            color: 'white',
            fontWeight: 'bold',
            zIndex: 10,
            left: `${player1Position.x * cellSize + cellSize / 4}px`, // Offset slightly
            top: `${player1Position.y * cellSize + cellSize / 4}px`, // Offset slightly
            width: `${cellSize / 2}px`, // Smaller player token
            height: `${cellSize / 2}px`,
            fontSize: `${cellSize / 4}px`,
            transition: 'left 0.3s ease-out, top 0.3s ease-out' // Smoother transition
          }}
        >
          P1
        </div>

        {/* 玩家2角色 */}
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            backgroundColor: 'blue',
            border: '2px solid white',
            color: 'white',
            fontWeight: 'bold',
            zIndex: 10,
            left: `${player2Position.x * cellSize + cellSize / 2}px`, // Different offset
            top: `${player2Position.y * cellSize + cellSize / 2}px`, // Different offset
            width: `${cellSize / 2}px`,
            height: `${cellSize / 2}px`,
             fontSize: `${cellSize / 4}px`,
            transition: 'left 0.3s ease-out, top 0.3s ease-out'
          }}
        >
          P2
        </div>
      </div>

      {/* 右側控制面板 */}
      <div style={{ marginLeft: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1 style={{ fontSize: '2em', fontWeight: 'bold', marginBottom: '24px' }}>大富翁遊戲</h1>

        {/* 玩家選擇 */}
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25em', fontWeight: 'bold', marginBottom: '8px' }}>輪到玩家:</h2>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              style={{
                width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 'bold', fontSize: '1.25em', cursor: 'pointer', border: 'none',
                backgroundColor: selectedPlayer === 1 ? '#DC2626' : '#F87171' // Tailwind red-600 and red-400
              }}
              onClick={() => setSelectedPlayer(1)}
              disabled={isMoving || isRolling} // Disable during actions
            >
              P1
            </button>
            <button
              style={{
                width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 'bold', fontSize: '1.25em', cursor: 'pointer', border: 'none',
                backgroundColor: selectedPlayer === 2 ? '#2563EB' : '#60A5FA' // Tailwind blue-600 and blue-400
              }}
              onClick={() => setSelectedPlayer(2)}
              disabled={isMoving || isRolling} // Disable during actions
            >
              P2
            </button>
          </div>
           <p style={{ marginTop: '10px', fontSize: '1.1em', fontWeight: 'bold' }}>
             {selectedPlayer === 1 ? "玩家 1" : "玩家 2"} 的回合
           </p>
        </div>

        {/* 骰子區域 */}
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              width: '96px', height: '96px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'white', borderRadius: '8px', border: '2px solid #9CA3AF', // Tailwind gray-400
              fontSize: '3em', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              transform: isRolling ? 'rotate(15deg) scale(1.1)' : 'none', // Enhanced rolling effect
              transition: 'transform 0.1s'
            }}
          >
            {diceValue || '?'}
          </div>

          <button
            style={{
              padding: '12px 24px', backgroundColor: '#22C55E', color: 'white', borderRadius: '8px', // Tailwind green-500
              fontWeight: 'bold', fontSize: '1.25em', width: '100%', cursor: 'pointer', border: 'none',
              opacity: (isRolling || isMoving) ? 0.6 : 1 // Dim button when disabled
            }}
            onClick={rollDice}
            disabled={isRolling || isMoving}
          >
            {isRolling ? '擲骰子中...' : `擲骰子 (玩家 ${selectedPlayer})`}
          </button>
        </div>

        {/* 控制按鈕 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
          <button
            style={{
              padding: '12px 24px', backgroundColor: '#F59E0B', color: 'white', borderRadius: '8px', // Tailwind yellow-500
              fontWeight: 'bold', fontSize: '1.25em', cursor: 'pointer', border: 'none',
              opacity: (moveHistory.length === 0 || isRolling || isMoving) ? 0.6 : 1
            }}
            onClick={undoMove}
            disabled={moveHistory.length === 0 || isRolling || isMoving}
          >
            回上一步
          </button>

          <button
             style={{
              padding: '12px 24px', backgroundColor: '#EF4444', color: 'white', borderRadius: '8px', // Tailwind red-500
              fontWeight: 'bold', fontSize: '1.25em', cursor: 'pointer', border: 'none'
            }}
            onClick={resetGame}
          >
            重新開始
          </button>
        </div>
      </div>

      {/* 彈窗 */}
      {modalOpen && (
        <div style={{
            position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50, backgroundColor: 'rgba(0, 0, 0, 0.5)'
          }}>
          <div
            style={{
              backgroundColor: 'white', padding: '24px', borderRadius: '8px', width: '384px', maxWidth: '90%',
              borderTop: `8px solid ${modalContent.color || '#ccc'}` // Use modal color for top border
            }}
          >
            <h2 style={{ fontSize: '1.25em', fontWeight: 'bold', marginBottom: '8px', color: modalContent.color || '#333' }}>{modalContent.title}</h2>
            <p style={{ marginBottom: '16px' }}>{modalContent.description}</p>
            <button
              style={{
                padding: '8px 16px', backgroundColor: '#3B82F6', color: 'white', borderRadius: '6px', // Tailwind blue-500
                border: 'none', cursor: 'pointer'
              }}
              onClick={closeModal}
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );

}; // <--- 結束 MonopolyGame 組件的定義

// REMOVE: export default MonopolyGame;
// 組件現在是一個全局可訪問的常量 MonopolyGame