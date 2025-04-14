// public/game/MonopolyGame.js
import React, { useState, useEffect } from 'react';

const MonopolyGame = () => {





    const MonopolyGame = () => {
      // 定義遊戲板的大小和格子尺寸，為iPad橫式調整
      const boardSize = 7;
      const cellSize = 90; // 增大格子尺寸
      const boardWidth = cellSize * boardSize;
      const boardHeight = cellSize * boardSize;
      
      // 定義路徑上的格子
      const [pathCells, setPathCells] = useState([]);
      // 玩家在路徑中的索引位置
      const [player1PathIndex, setPlayer1PathIndex] = useState(0);
      const [player2PathIndex, setPlayer2PathIndex] = useState(0);
      // 當前選擇的玩家
      const [selectedPlayer, setSelectedPlayer] = useState(1);
      // 彈窗狀態
      const [modalOpen, setModalOpen] = useState(false);
      const [modalContent, setModalContent] = useState({ title: '', description: '', color: '' });
      // 骰子狀態
      const [diceValue, setDiceValue] = useState(null);
      const [isRolling, setIsRolling] = useState(false);
      // 是否正在移動中
      const [isMoving, setIsMoving] = useState(false);
      // 當前高亮的格子
      const [highlightedCell, setHighlightedCell] = useState(null);
      // 玩家移動歷史，用於"回上一步"功能
      const [moveHistory, setMoveHistory] = useState([]);
      
      // 初始化遊戲板和路徑
      useEffect(() => {
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
      }, []);
      
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
        
        // 如果超過或剛好到終點，停在終點
        if (newIndex >= pathCells.length) {
          newIndex = 0; // 停在起點/終點
        }
        
        // 直接移動到新位置
        setCurrentPlayerPathIndex(newIndex);
        
        // 移動完成後顯示格子信息
        setTimeout(() => {
          setIsMoving(false);
          setHighlightedCell(newIndex); // 高亮當前格子
          
          // 顯示玩家到達的格子信息
          const arrivedCell = pathCells[newIndex];
          setModalContent({
            title: `玩家 ${selectedPlayer} 到達 ${arrivedCell.title}`,
            description: arrivedCell.description,
            color: arrivedCell.color
          });
          setModalOpen(true);
        }, 500);
      };
      
      // 獲取玩家實際位置
      const getPlayerPosition = (playerPathIndex) => {
        if (pathCells.length === 0) {
          return { x: boardSize - 1, y: boardSize - 1 }; // 預設在右下角
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
      };
      
      // 重置遊戲
      const resetGame = () => {
        setPlayer1PathIndex(0);
        setPlayer2PathIndex(0);
        setDiceValue(null);
        setHighlightedCell(null);
        setSelectedPlayer(1);
        setMoveHistory([]);
      };
      
      // 計算玩家坐標
      const player1Position = getPlayerPosition(player1PathIndex);
      const player2Position = getPlayerPosition(player2PathIndex);
      
      return (
        <div className="relative w-full h-full flex flex-row items-center justify-center p-4 bg-gray-100">
          {/* 左側遊戲面板 */}
          <div 
            className="relative" 
            style={{ 
              width: `${boardWidth}px`, 
              height: `${boardHeight}px`,
              backgroundColor: '#f0f0f0',
              border: '2px solid #333'
            }}
          >
            {/* 繪製路徑格子 */}
            {pathCells.map((cell, index) => (
              <div
                key={index}
                className="absolute cursor-pointer flex items-center justify-center border border-gray-400 text-xs font-bold overflow-hidden"
                style={{
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
                onClick={() => handleCellClick(cell)}
              >
                {cell.title}
              </div>
            ))}
            
            {/* 玩家1角色 */}
            <div
              className="absolute flex items-center justify-center rounded-full bg-red-500 border-2 border-white text-white font-bold z-10"
              style={{
                left: `${player1Position.x * cellSize + cellSize/2 - 15}px`,
                top: `${player1Position.y * cellSize + cellSize/2 - 15}px`,
                width: '30px',
                height: '30px',
                transition: 'left 0.3s, top 0.3s'
              }}
            >
              P1
            </div>
            
            {/* 玩家2角色 */}
            <div
              className="absolute flex items-center justify-center rounded-full bg-blue-500 border-2 border-white text-white font-bold z-10"
              style={{
                left: `${player2Position.x * cellSize + cellSize/2 - 15}px`,
                top: `${player2Position.y * cellSize + cellSize/2 - 15}px`,
                width: '30px',
                height: '30px',
                transition: 'left 0.3s, top 0.3s'
              }}
            >
              P2
            </div>
          </div>
          
          {/* 右側控制面板 */}
          <div className="ml-8 flex flex-col items-center">
            <h1 className="text-3xl font-bold mb-6">大富翁遊戲</h1>
            
            {/* 玩家選擇 */}
            <div className="mb-6 p-4 bg-white rounded-lg shadow-md text-center">
              <h2 className="text-xl font-bold mb-2">選擇玩家</h2>
              <div className="flex gap-4">
                <button
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${selectedPlayer === 1 ? 'bg-red-600' : 'bg-red-400'}`}
                  onClick={() => setSelectedPlayer(1)}
                >
                  P1
                </button>
                <button
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${selectedPlayer === 2 ? 'bg-blue-600' : 'bg-blue-400'}`}
                  onClick={() => setSelectedPlayer(2)}
                >
                  P2
                </button>
              </div>
            </div>
            
            {/* 骰子區域 */}
            <div className="mb-6 p-4 bg-white rounded-lg shadow-md flex flex-col items-center">
              <div 
                className="w-24 h-24 mb-4 flex items-center justify-center bg-white rounded-lg border-2 border-gray-400 text-5xl font-bold shadow-lg"
                style={{ transform: isRolling ? 'rotate(10deg)' : 'none', transition: 'transform 0.1s' }}
              >
                {diceValue || '?'}
              </div>
              
              <button
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-bold text-xl w-full"
                onClick={rollDice}
                disabled={isRolling || isMoving}
              >
                {isRolling ? '擲骰子中...' : '擲骰子'}
              </button>
            </div>
            
            {/* 控制按鈕 */}
            <div className="flex flex-col gap-3 w-full">
              <button
                className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-bold text-xl"
                onClick={undoMove}
                disabled={moveHistory.length === 0 || isRolling || isMoving}
              >
                回上一步
              </button>
              
              <button
                className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-bold text-xl"
                onClick={resetGame}
              >
                重新開始
              </button>
            </div>
          </div>
          
          {/* 彈窗 */}
          {modalOpen && (
            <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
              <div 
                className="bg-white p-6 rounded-lg w-96 max-w-lg border-t-8"
                style={{ borderTopColor: modalContent.color }}
              >
                <h2 className="text-xl font-bold mb-2">{modalContent.title}</h2>
                <p className="mb-4">{modalContent.description}</p>
                <button 
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  onClick={closeModal}
                >
                  關閉
                </button>
              </div>
            </div>
          )}
        </div>
      );
    };
    
}

export default MonopolyGame;