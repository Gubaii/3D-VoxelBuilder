import { useStore } from '../../hooks/useStore';
import { CubeIcon, MinusIcon, ArrowsUpDownIcon, RefreshIcon } from './Icons';
import './ToolPanel.css';

export const ToolPanel = () => {
  const { toolMode, setToolMode, resetWorld } = useStore();
  
  return (
    <div className="tool-panel">
      <div className="tool-group">
        <button 
          className={`tool-button ${toolMode === 'add' ? 'active' : ''}`}
          onClick={() => setToolMode('add')}
          title="添加方块 (A)"
        >
          <CubeIcon />
          <span>添加</span>
        </button>
        
        <button 
          className={`tool-button ${toolMode === 'remove' ? 'active' : ''}`}
          onClick={() => setToolMode('remove')}
          title="删除方块 (D)"
        >
          <MinusIcon />
          <span>删除</span>
        </button>
        
        <button 
          className={`tool-button ${toolMode === 'pushpull' ? 'active' : ''}`}
          onClick={() => setToolMode('pushpull')}
          title="推拉 (P)"
        >
          <ArrowsUpDownIcon />
          <span>推拉</span>
        </button>
      </div>
      
      <div className="tool-group">
        <button 
          className="tool-button"
          onClick={resetWorld}
          title="重置"
        >
          <RefreshIcon />
          <span>重置</span>
        </button>
      </div>
      
      <div className="tool-info">
        <p>提示: 使用鼠标右键旋转视图</p>
        <p>使用鼠标中键或Shift+右键平移视图</p>
        <p>按住 Alt/Option 键可临时切换到删除模式</p>
        <p>格点大小: 3mm</p>
        <p>捕捉精度: 1.5mm</p>
      </div>
    </div>
  );
}; 