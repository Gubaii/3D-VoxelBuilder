import { useEffect } from 'react'
import { Scene } from './components/Scene'
import { useStore } from './hooks/useStore'
import './App.css'

function App() {
  const { setToolMode } = useStore()
  
  // 键盘快捷键处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 按键切换工具
      if (e.key === 'a' || e.key === 'A') {
        setToolMode('add')
      } else if (e.key === 'd' || e.key === 'D') {
        setToolMode('remove')
      } else if (e.key === 'p' || e.key === 'P') {
        setToolMode('pushpull')
      }
      
      // Alt/Option键临时切换到删除模式
      if (e.altKey) {
        setToolMode('remove')
      }
    }
    
    const handleKeyUp = (e: KeyboardEvent) => {
      // Alt/Option键释放后恢复到之前的模式
      if (e.key === 'Alt') {
        setToolMode('add')
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [setToolMode])
  
  return (
    <div className="app">
      <Scene />
    </div>
  )
}

export default App
