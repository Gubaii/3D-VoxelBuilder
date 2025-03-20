import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import reportWebVitals from './reportWebVitals'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 如果你想开始测量应用性能，可以传递一个函数
// 用于记录结果（例如：reportWebVitals(console.log)）
reportWebVitals(); 