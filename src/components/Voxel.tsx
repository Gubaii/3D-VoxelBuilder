import { useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '../hooks/useStore';
import * as THREE from 'three';

interface VoxelProps {
  position: THREE.Vector3;
  color: string;
  opacity?: number;
  isPreview?: boolean;
}

export const Voxel = ({ position, color, opacity = 1, isPreview = false }: VoxelProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [currentColor, setCurrentColor] = useState(color);
  const [currentOpacity, setCurrentOpacity] = useState(opacity);
  const { setHoveredVoxel, setSelectedFace, removeVoxel, toolMode } = useStore();
  
  // 定义平滑过渡系数 - 降低动画速率以提高稳定性
  const lerpFactor = 0.05; // 从0.1降低到0.05，更平滑的过渡

  // 根据悬停状态更新颜色 - 使用useCallback优化
  useEffect(() => {
    let newColor = color;
    if (isHovered) {
      if (toolMode === 'add') {
        newColor = '#00ff00'; // 添加模式时高亮绿色
      } else if (toolMode === 'remove') {
        newColor = '#ff0000'; // 删除模式时高亮红色
      } else {
        newColor = '#ffff00'; // 默认高亮黄色
      }
    }
    
    // 只有当颜色确实变化时才更新状态
    if (newColor !== currentColor) {
      setCurrentColor(newColor);
    }
  }, [isHovered, color, toolMode, currentColor]);

  // 更新材质透明度 - 使用useCallback优化
  useEffect(() => {
    if (opacity !== currentOpacity) {
      setCurrentOpacity(opacity);
    }
  }, [opacity, currentOpacity]);

  // 优化体素初始化效果 - 使用useRef避免不必要的重渲染
  useEffect(() => {
    if (meshRef.current && isPreview) {
      // 对于预览体素，直接设置初始缩放
      meshRef.current.scale.set(0.8, 0.8, 0.8);
      // 使用定时器平滑过渡到正常尺寸
      const timer = setTimeout(() => {
        if (meshRef.current) {
          meshRef.current.scale.set(1, 1, 1);
        }
      }, 150);
      
      return () => clearTimeout(timer);
    }
  }, [isPreview]);

  // 处理指针进入事件 - 使用useCallback优化
  const handlePointerEnter = useCallback((e: any) => {
    e.stopPropagation();
    setIsHovered(true);
    
    // 设置悬停的体素和选中的面
    if (meshRef.current) {
      // 计算交点，确定悬停的确切位置
      const intersection = e.intersections[0];
      // 检查是否有有效的交点和法向量
      if (intersection && intersection.face) {
        // 获取面的法向量，并正确转换到世界坐标系
        const faceNormal = intersection.face.normal.clone();
        
        // 使用mesh的世界矩阵转换法向量
        const worldNormal = faceNormal.transformDirection(meshRef.current.matrixWorld);
        
        // 将法向量量化为主轴方向（x, y或z轴），以确保对齐网格
        const absX = Math.abs(worldNormal.x);
        const absY = Math.abs(worldNormal.y);
        const absZ = Math.abs(worldNormal.z);
        
        // 确定主方向
        const normalizedNormal = new THREE.Vector3();
        if (absX > absY && absX > absZ) {
          // x轴为主方向
          normalizedNormal.set(worldNormal.x > 0 ? 1 : -1, 0, 0);
        } else if (absY > absX && absY > absZ) {
          // y轴为主方向
          normalizedNormal.set(0, worldNormal.y > 0 ? 1 : -1, 0);
        } else {
          // z轴为主方向
          normalizedNormal.set(0, 0, worldNormal.z > 0 ? 1 : -1);
        }
        
        // 设置全局状态 - 使用try-catch避免因状态更新错误导致整个应用崩溃
        try {
          setHoveredVoxel({ 
            position: position.clone(),
            color: color 
          });
          setSelectedFace({ normal: normalizedNormal });
        } catch (error) {
          console.error("设置悬停状态出错:", error);
        }
      }
    }
  }, [setHoveredVoxel, setSelectedFace, position, color]);

  // 处理指针离开事件 - 使用useCallback优化
  const handlePointerLeave = useCallback((e: any) => {
    e.stopPropagation();
    setIsHovered(false);
    
    // 清除全局悬停状态（只有当前体素是悬停的才清除）
    try {
      setHoveredVoxel(null);
      setSelectedFace(null);
    } catch (error) {
      console.error("清除悬停状态出错:", error);
    }
  }, [setHoveredVoxel, setSelectedFace]);

  // 处理点击事件 - 使用useCallback优化
  const handleClick = useCallback((e: any) => {
    // 删除模式时停止传播，阻止事件冒泡
    if (toolMode === 'remove' && !isPreview) {
      e.stopPropagation();
      // 移除当前体素
      try {
        removeVoxel(position);
      } catch (error) {
        console.error("移除体素出错:", error);
      }
    }
    
    // 添加模式下不阻止事件冒泡，让事件传递到VoxelWorld
  }, [toolMode, isPreview, removeVoxel, position]);

  // 每帧更新材质和颜色
  useEffect(() => {
    // 更新函数
    const updateMaterialAndScale = () => {
      if (meshRef.current && materialRef.current) {
        try {
          // 平滑过渡颜色和不透明度
          const currentMeshColor = new THREE.Color(materialRef.current.color.getHex());
          const targetColor = new THREE.Color(currentColor);
          currentMeshColor.lerp(targetColor, lerpFactor);
          materialRef.current.color = currentMeshColor;
          
          // 平滑过渡不透明度
          materialRef.current.opacity += (currentOpacity - materialRef.current.opacity) * lerpFactor;
          
          // 对于预览体素，禁用深度写入以防止Z冲突
          if (isPreview) {
            materialRef.current.depthWrite = false;
            materialRef.current.needsUpdate = true;
          }
        } catch (error) {
          console.error("更新材质出错:", error);
        }
      }
    };
    
    // 设置动画帧
    const animationId = requestAnimationFrame(updateMaterialAndScale);
    return () => cancelAnimationFrame(animationId);
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      castShadow={!isPreview}
      receiveShadow={!isPreview}
      userData={{ type: 'voxel', isPreview: isPreview }}
    >
      <boxGeometry args={[0.301, 0.301, 0.301]} />
      <meshStandardMaterial
        ref={materialRef}
        color={currentColor}
        transparent={true}
        opacity={currentOpacity}
        roughness={0.3}
        metalness={0.2}
      />
    </mesh>
  );
}; 