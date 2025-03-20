import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import { VoxelWorld } from './VoxelWorld';
import { ToolPanel } from './UI/ToolPanel';
import { Suspense, useEffect, useState, useRef } from 'react';
import * as THREE from 'three';

export const Scene = () => {
  const [showStats, setShowStats] = useState(false);
  const orbitControlsRef = useRef(null);

  // 按下'~'键显示性能监视器
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`') {
        setShowStats(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 添加Shift+右键平移支持
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.shiftKey && e.button === 2 && orbitControlsRef.current) {
        // 禁用旋转，启用平移
        const controls = orbitControlsRef.current as any;
        if (controls.mouseButtons) {
          // 保存原始配置
          const originalRight = controls.mouseButtons.RIGHT;
          // 设置为平移
          controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
          
          // 鼠标释放时恢复
          const handleMouseUp = () => {
            controls.mouseButtons.RIGHT = originalRight;
            window.removeEventListener('mouseup', handleMouseUp);
          };
          
          window.addEventListener('mouseup', handleMouseUp);
        }
      }
    };
    
    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <ToolPanel />
      
      <Canvas
        gl={{ 
          antialias: true,
          alpha: false, // 禁用透明背景
          logarithmicDepthBuffer: true, // 提高深度精度
          precision: 'highp', // 高精度渲染
          powerPreference: 'high-performance' // 偏好高性能模式
        }}
        camera={{ position: [5, 5, 5], fov: 45 }}
        shadows={{ enabled: true, type: THREE.PCFSoftShadowMap }}
        dpr={[1, 2]} // 限制最高DPR为2，提高性能
        performance={{ min: 0.5 }} // 当性能不足时，最多降级到50%分辨率
        linear // 使用线性色彩空间，更稳定和更好的性能
        flat // 禁用色调映射，提高性能，更符合像素风格
      >
        <color attach="background" args={['#DBF2F5']} /> {/* 浅蓝绿色背景 */}
        
        <Suspense fallback={null}>
          {/* 主要光源 - 半球光 */}
          <hemisphereLight 
            intensity={1.0} 
            color="#ffffff" 
            groundColor="#8888ff" 
          />
          
          {/* 定向光带阴影 */}
          <directionalLight
            position={[10, 10, 5]}
            intensity={1.0}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-far={50}
            shadow-camera-left={-10}
            shadow-camera-right={10}
            shadow-camera-top={10}
            shadow-camera-bottom={-10}
          />
          
          {/* 环境光 */}
          <ambientLight intensity={0.5} />
          
          {/* 体素世界 */}
          <VoxelWorld />
          
          {/* 控制器 */}
          <OrbitControls 
            ref={orbitControlsRef}
            makeDefault 
            minDistance={2} 
            maxDistance={20} 
            enableDamping={true}
            dampingFactor={0.05}
            mouseButtons={{
              LEFT: undefined,  // 左键不做任何操作
              MIDDLE: THREE.MOUSE.PAN,  // 中键平移
              RIGHT: THREE.MOUSE.ROTATE // 右键旋转
            }}
            // 键盘修饰键配置
            keyEvents={true}
            keys={{
              LEFT: 'ArrowLeft', // 向左箭头
              UP: 'ArrowUp', // 向上箭头
              RIGHT: 'ArrowRight', // 向右箭头
              BOTTOM: 'ArrowDown' // 向下箭头
            }}
            // 修饰键配置
            touches={{
              ONE: THREE.TOUCH.ROTATE,
              TWO: THREE.TOUCH.DOLLY_PAN
            }}
          />
          
          {/* 地面网格 - 提供参考点 */}
          <gridHelper args={[30, 30, '#DCDCDC', '#DCDCDC']} position={[0, -0.01, 0]} />
        </Suspense>
        
        {/* 性能监视器 */}
        {showStats && <Stats />}
      </Canvas>
    </div>
  );
}; 