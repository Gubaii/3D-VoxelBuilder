import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '../hooks/useStore';
import { Voxel } from './Voxel';
import * as THREE from 'three';

// 定义体素类型
interface VoxelType {
  position: THREE.Vector3;
  color: string;
}

// 定义推拉状态类型
type PushPullStateType = {
  active: boolean;
  startPosition: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  faceCenter: THREE.Vector3;
  selectedVoxels: { position: THREE.Vector3, color: string }[];
  highlightedFaces: { position: THREE.Vector3, normal: THREE.Vector3, color: string }[];
};

// 控制杆组件 - 优化性能，减少对象创建
const PushPullHandle = ({ 
  position, 
  normal, 
  distance, 
  onUpdate 
}: { 
  position: THREE.Vector3, 
  normal: THREE.Vector3, 
  distance: number, 
  onUpdate: (newDistance: number) => void 
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const isDragging = useRef(false);
  const startPosition = useRef(new THREE.Vector3());
  
  // 复用向量对象以减少GC压力
  const tempVector = useMemo(() => new THREE.Vector3(), []);
  const handlePosition = useMemo(() => new THREE.Vector3(), []);
  const normalClone = useMemo(() => new THREE.Vector3(), []);
  
  // 预计算控制杆位置
  useEffect(() => {
    normalClone.copy(normal);
    handlePosition.copy(position).add(normalClone.clone().multiplyScalar(distance));
  }, [position, normal, distance, handlePosition, normalClone]);
  
  // 添加鼠标状态追踪
  const [isHovered, setIsHovered] = useState(false);
  
  // 控制杆拖动处理
  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation();
    isDragging.current = true;
    startPosition.current.set(e.point.x, e.point.y, e.point.z);
    document.body.style.cursor = 'grabbing';
    // 捕获鼠标事件
    if (e.target) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, []);
  
  const handlePointerUp = useCallback((e: any) => {
    if (isDragging.current) {
      e.stopPropagation();
      isDragging.current = false;
      document.body.style.cursor = isHovered ? 'pointer' : 'auto';
      // 释放鼠标捕获
      if (e.target) {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      }
    }
  }, [isHovered]);
  
  const handlePointerMove = useCallback((e: any) => {
    if (!isDragging.current) return;
    
    e.stopPropagation();
    tempVector.set(e.point.x, e.point.y, e.point.z).sub(startPosition.current);
    
    // 计算沿法线方向的移动距离
    const dot = tempVector.dot(normal);
    const newDistance = Math.round(dot / 0.3) * 0.3;
    
    onUpdate(newDistance);
  }, [normal, onUpdate, tempVector]);
  
  // 处理鼠标悬停
  const handlePointerOver = useCallback(() => {
    setIsHovered(true);
    document.body.style.cursor = 'pointer';
  }, []);
  
  const handlePointerOut = useCallback(() => {
    if (!isDragging.current) {
      setIsHovered(false);
      document.body.style.cursor = 'auto';
    }
  }, []);
  
  useEffect(() => {
    // 清理函数，确保没有残留的状态
    return () => {
      document.body.style.cursor = 'auto';
      isDragging.current = false;
    };
  }, []);
  
  // 计算面的尺寸，用于控制杆显示
  const faceSize = 0.3;
  
  // 控制杆高亮颜色
  const baseColor = isHovered ? "#ffdd44" : "#ffcc00";
  const lineColor = isHovered ? "#ffaa44" : "#ff9900";
  const arrowColor = isHovered ? "#ff7744" : "#ff6600";
  
  return (
    <group position={handlePosition} ref={groupRef}>
      {/* 控制杆基座 */}
      <mesh
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerUp}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry args={[faceSize, faceSize, faceSize]} />
        <meshStandardMaterial color={baseColor} transparent opacity={0.7} />
      </mesh>
      
      {/* 控制杆柄 */}
      <mesh 
        position={normalClone.clone().multiplyScalar(0.5)}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerUp}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <cylinderGeometry args={[0.05, 0.05, 0.7]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>
      
      {/* 控制杆箭头 */}
      <mesh 
        position={normal.clone().multiplyScalar(0.9)}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerUp}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <coneGeometry args={[0.1, 0.2]} />
        <meshStandardMaterial color={arrowColor} />
      </mesh>
      
      {/* 添加一个不可见的平面，用于增强拖动区域 */}
      <mesh 
        position={normal.clone().multiplyScalar(0.45)}
        rotation={[normal.x ? 0 : Math.PI/2, normal.y ? Math.PI/2 : 0, normal.z ? 0 : 0]}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerUp}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial transparent opacity={0} visible={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// 修改FaceHighlight组件，确保它准确高亮面的整个区域
const FaceHighlight = ({ 
  position, 
  normal, 
  color = "#ffff00", 
  opacity = 0.3 
}: { 
  position: THREE.Vector3;
  normal: THREE.Vector3;
  color?: string;
  opacity?: number;
}) => {
  // 确定要渲染的面
  const faceIndex = Math.abs(normal.x) > 0.5 ? 0 : // x轴面
                    Math.abs(normal.y) > 0.5 ? 1 : // y轴面
                    2; // z轴面
  
  // 偏移距离，确保高亮面在体块表面的外侧一点点
  const offset = 0.002;
  
  // 面的位置，基于体块位置和法向量方向
  const facePosition = position.clone().add(
    normal.clone().multiplyScalar(0.15 + offset)
  );
  
  // 确定面的旋转, 明确指定为元组类型
  const rotation = useMemo(() => {
    if (faceIndex === 0) { // x轴面
      return [0, normal.x > 0 ? Math.PI / 2 : -Math.PI / 2, 0] as [number, number, number];
    } else if (faceIndex === 1) { // y轴面
      return [normal.y > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0] as [number, number, number];
    } else { // z轴面
      return [0, 0, normal.z > 0 ? 0 : Math.PI] as [number, number, number];
    }
  }, [faceIndex, normal]);
  
  return (
    <mesh
      position={facePosition}
      rotation={rotation}
    >
      <planeGeometry args={[0.301, 0.301]} />
      <meshBasicMaterial 
        color={color} 
        transparent={true} 
        opacity={opacity} 
        side={THREE.DoubleSide}
        depthTest={false}
      />
    </mesh>
  );
};

export const VoxelWorld = () => {
  const groupRef = useRef<THREE.Group>(null);
  const { voxels, hoveredVoxel: storeHoveredVoxel, selectedFace, toolMode, pushPullFace: storePushPullFace, addVoxel, setHoveredVoxel, setSelectedFace, removeVoxel } = useStore();
  const { camera, raycaster, mouse, scene } = useThree();
  
  // 临时向量对象，避免频繁创建新对象
  const tempVector = useMemo(() => new THREE.Vector3(), []);
  const tempNormal = useMemo(() => new THREE.Vector3(), []);
  
  // 创建临时的体素预览
  const [tempVoxel, setTempVoxel] = useState<{
    position: THREE.Vector3;
    color: string;
  } | null>(null);
  
  // 本地保存当前悬停的体素和法线
  const [localHovered, setLocalHovered] = useState<{
    position: THREE.Vector3;
    normal: THREE.Vector3;
  } | null>(null);
  
  // 修改推拉状态，使用正确的类型
  const [pushPullState, setPushPullState] = useState<PushPullStateType>({
    active: false,
    startPosition: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    distance: 0,
    faceCenter: new THREE.Vector3(),
    selectedVoxels: [],
    highlightedFaces: []
  });

  // 创建网格检测平面的引用
  const gridHelperRef = useRef<THREE.GridHelper>(null);
  
  // 创建捕捉到网格的状态
  const [gridSnapped, setGridSnapped] = useState(false);
  
  // 添加鼠标状态跟踪
  const [mouseState, setMouseState] = useState({
    isDragging: false,
    startX: 0,
    startY: 0,
    startTime: 0
  });
  
  // 添加网格捕捉功能，改进空隙检测
  const checkGridSnapping = useCallback(() => {
    if (toolMode !== 'add') return false;
    
    try {
      // 设置射线从相机位置发射，方向通过鼠标位置计算
      raycaster.setFromCamera(mouse, camera);
      
      // 创建一个临时数组，包含所有非预览的体素物体用于射线检测
      const voxelMeshes: THREE.Object3D[] = [];
      scene.traverse((object) => {
        if (object.userData?.type === 'voxel' && !object.userData?.isPreview) {
          voxelMeshes.push(object);
        }
      });
      
      // 检查是否需要清除预览
      let shouldClearPreview = true;
      
      // 使用射线与体素相交检测
      const intersects = raycaster.intersectObjects(voxelMeshes, false);
      
      // 如果有相交点
      if (intersects.length > 0) {
        const intersection = intersects[0]; // 获取第一个相交点（最近的）
        const voxelMesh = intersection.object as THREE.Mesh;
        const face = intersection.face;
        
        if (face && voxelMesh) {
          // 获取接触点的世界坐标
          const point = intersection.point.clone();
          
          // 获取面的法向量并转换为世界坐标
          const faceNormal = face.normal.clone();
          faceNormal.transformDirection(voxelMesh.matrixWorld);
          
          // 量化为主轴方向
          const absX = Math.abs(faceNormal.x);
          const absY = Math.abs(faceNormal.y);
          const absZ = Math.abs(faceNormal.z);
          
          const normalizedNormal = new THREE.Vector3();
          if (absX > absY && absX > absZ) {
            normalizedNormal.set(faceNormal.x > 0 ? 1 : -1, 0, 0);
          } else if (absY > absX && absY > absZ) {
            normalizedNormal.set(0, faceNormal.y > 0 ? 1 : -1, 0);
          } else {
            normalizedNormal.set(0, 0, faceNormal.z > 0 ? 1 : -1);
          }
          
          // 获取相交体素的位置
          const voxelPosition = new THREE.Vector3();
          voxelMesh.getWorldPosition(voxelPosition);
          voxelPosition.x = Math.round(voxelPosition.x / 0.3) * 0.3;
          voxelPosition.y = Math.round(voxelPosition.y / 0.3) * 0.3;
          voxelPosition.z = Math.round(voxelPosition.z / 0.3) * 0.3;
          
          // 计算新体素的位置 = 当前体素位置 + 法向量 * 体素尺寸
          const newPosition = voxelPosition.clone().add(
            normalizedNormal.clone().multiplyScalar(0.3)
          );
          
          // 检查新位置是否已有体素
          const exists = voxels.some(voxel => 
            Math.abs(voxel.position.x - newPosition.x) < 0.01 && 
            Math.abs(voxel.position.y - newPosition.y) < 0.01 && 
            Math.abs(voxel.position.z - newPosition.z) < 0.01
          );
          
          // 如果位置空闲，创建预览体素
          if (!exists) {
            // 找到了有效的预览位置，不需要清除
            shouldClearPreview = false;
            
            // 如果位置或法线与当前预览不同，则更新预览
            const shouldUpdatePreview = !tempVoxel || 
              !tempVoxel.position.equals(newPosition) || 
              (localHovered && !localHovered.normal.equals(normalizedNormal));
            
            if (shouldUpdatePreview) {
              setTempVoxel({
                position: newPosition,
                color: '#00ff00' // 绿色预览
              });
              
              // 更新本地悬停状态
              setLocalHovered({
                position: voxelPosition,
                normal: normalizedNormal
              });
              
              // 同步到全局状态
              setHoveredVoxel({ 
                position: voxelPosition.clone(),
                color: voxelMesh.material instanceof THREE.MeshStandardMaterial ? 
                    '#' + voxelMesh.material.color.getHexString() : 
                    '#1e88e5'
              });
              setSelectedFace({ normal: normalizedNormal });
              
              setGridSnapped(true);
              return true;
            }
          }
        }
      }
      
      // 如果没有找到有效的预览位置，且应该清除预览
      if (shouldClearPreview) {
        // 没有相交的体素，清除本地悬停状态
        if (localHovered !== null) setLocalHovered(null);
        if (storeHoveredVoxel !== null) setHoveredVoxel(null);
        if (selectedFace !== null) setSelectedFace(null);
        
        // 清除临时体素
        if (tempVoxel) {
          setTempVoxel(null);
          setGridSnapped(false);
        }
      }
    } catch (error) {
      console.error("检测网格捕捉时发生错误:", error);
    }
    
    return false;
  }, [raycaster, mouse, camera, scene, voxels, tempVoxel, localHovered, storeHoveredVoxel, selectedFace, setHoveredVoxel, setSelectedFace]);

  // 处理鼠标移动，增加网格捕捉检测
  useEffect(() => {
    let animationFrameId: number;
    let isProcessing = false;
    
    const handleMouseMove = () => {
      // 如果处于添加模式，检测网格捕捉
      // 使用防抖动和requestAnimationFrame来限制调用频率
      if (toolMode === 'add' && !isProcessing) {
        isProcessing = true;
        animationFrameId = requestAnimationFrame(() => {
          try {
            checkGridSnapping();
          } catch (error) {
            console.error("网格捕捉检测出错:", error);
          } finally {
            isProcessing = false;
          }
        });
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [toolMode, checkGridSnapping]);
  
  // 找出同一平面的所有体素面 - 移动到组件内部
  const findVoxelsInSamePlane = useCallback((position: THREE.Vector3, normal: THREE.Vector3) => {
    // 计算平面方程以找到同一平面上的所有体素面
    // 平面方程: ax + by + cz + d = 0
    const a = normal.x;
    const b = normal.y;
    const c = normal.z;
    const d = -(a * position.x + b * position.y + c * position.z);
    
    // 找出在同一平面上的所有体素
    const voxelsInPlane: VoxelType[] = [];
    const facesInPlane: {position: THREE.Vector3, normal: THREE.Vector3, color: string}[] = [];
    
    // 使用Set来跟踪已处理过的位置，避免重复
    const processedPositions = new Set<string>();
    
    voxels.forEach(voxel => {
      // 计算体素中心到平面的距离
      const distToPlane = Math.abs(a * voxel.position.x + b * voxel.position.y + c * voxel.position.z + d);
      
      // 如果体素与平面距离足够近
      if (distToPlane < 0.01) {
        // 确定要检查的面法向量
        const faceNormal = normal.clone();
        
        // 计算面的中心位置
        const facePosition = voxel.position.clone();
        
        // 格式化位置为字符串用于检查重复
        const posKey = `${facePosition.x.toFixed(2)},${facePosition.y.toFixed(2)},${facePosition.z.toFixed(2)},${faceNormal.x.toFixed(1)},${faceNormal.y.toFixed(1)},${faceNormal.z.toFixed(1)}`;
        
        // 检查是否已处理过此位置
        if (processedPositions.has(posKey)) {
          return;
        }
        
        // 检查是否有另一个体素紧贴在此面的外侧
        // 如果没有相邻体素，则这个面是可见的，应该高亮
        const checkPos = facePosition.clone().add(faceNormal.clone().multiplyScalar(0.3));
        const hasNeighbor = voxels.some(v => 
          Math.abs(v.position.x - checkPos.x) < 0.01 &&
          Math.abs(v.position.y - checkPos.y) < 0.01 &&
          Math.abs(v.position.z - checkPos.z) < 0.01
        );
        
        if (!hasNeighbor) {
          // 添加这个体素到同平面列表
          voxelsInPlane.push(voxel);
          
          // 添加这个面到高亮列表
          facesInPlane.push({
            position: facePosition.clone(),
            normal: faceNormal.clone(),
            color: voxel.color
          });
          
          // 记录此位置已处理
          processedPositions.add(posKey);
        }
      }
    });
    
    // 计算面的几何中心
    const center = new THREE.Vector3();
    if (facesInPlane.length > 0) {
      facesInPlane.forEach(face => {
        center.add(face.position);
      });
      center.divideScalar(facesInPlane.length);
    }
    
    return { voxels: voxelsInPlane, center, faces: facesInPlane };
  }, [voxels]);

  // 更新推拉距离 - 移动到组件内部
  const updatePushPullDistance = useCallback((newDistance: number) => {
    setPushPullState(prev => ({
      ...prev,
      distance: Math.round(newDistance / 0.3) * 0.3 // 确保距离是3mm的整数倍
    }));
  }, []);

  // 实现推拉操作，添加或删除体素 - 移动到组件内部
  const pushPullFace = useCallback((normal: THREE.Vector3, distance: number) => {
    // 距离应该是3mm的整数倍
    const steps = Math.round(Math.abs(distance) / 0.3);
    
    if (distance > 0) {
      // 向外推拉 - 添加新体素
      pushPullState.selectedVoxels.forEach(voxel => {
        for (let i = 1; i <= steps; i++) {
          const newPos = voxel.position.clone().add(
            normal.clone().multiplyScalar(i * 0.3)
          );
          
          // 检查这个位置是否已有体素
          const hasVoxel = voxels.some(v => 
            Math.abs(v.position.x - newPos.x) < 0.01 &&
            Math.abs(v.position.y - newPos.y) < 0.01 &&
            Math.abs(v.position.z - newPos.z) < 0.01
          );
          
          if (!hasVoxel) {
            addVoxel({
              position: newPos,
              color: voxel.color
            });
          }
        }
      });
    } else if (distance < 0) {
      // 向内推拉 - 删除体素
      pushPullState.selectedVoxels.forEach(voxel => {
        for (let i = 1; i <= steps; i++) {
          const checkPos = voxel.position.clone().add(
            normal.clone().multiplyScalar(-i * 0.3)
          );
          
          // 循环检查这个位置是否有体素并删除
          voxels.forEach(existingVoxel => {
            if (Math.abs(existingVoxel.position.x - checkPos.x) < 0.01 &&
                Math.abs(existingVoxel.position.y - checkPos.y) < 0.01 &&
                Math.abs(existingVoxel.position.z - checkPos.z) < 0.01) {
              // 删除这个体素
              removeVoxel(existingVoxel.position);
            }
          });
        }
      });
    }
  }, [pushPullState.selectedVoxels, voxels, addVoxel, removeVoxel]);

  // 优化空隙检测功能
  const findEmptyCellNearRay = useCallback(() => {
    if (!raycaster || voxels.length === 0) return null;
    
    // 获取射线
    const ray = raycaster.ray.clone();
    
    // 创建一个立方体网格来检测空的网格单元
    const cellSize = 0.3; // 3mm
    const maxDistance = 20; // 最大检测距离
    const origin = ray.origin.clone();
    const direction = ray.direction.normalize();
    
    // 存储候选位置
    const candidates = [];
    
    // 沿射线检查多个点 
    for (let dist = 0.3; dist <= maxDistance; dist += 0.3) {
      // 计算射线上的点
      const point = origin.clone().add(direction.clone().multiplyScalar(dist));
      
      // 将点量化到网格
      const gridX = Math.round(point.x / cellSize) * cellSize;
      const gridY = Math.round(point.y / cellSize) * cellSize;
      const gridZ = Math.round(point.z / cellSize) * cellSize;
      
      // 检查这个位置是否已经有体素
      const occupied = voxels.some(voxel => 
        Math.abs(voxel.position.x - gridX) < 0.01 && 
        Math.abs(voxel.position.y - gridY) < 0.01 && 
        Math.abs(voxel.position.z - gridZ) < 0.01
      );
      
      // 如果位置没有被占用
      if (!occupied) {
        // 检查是否有相邻的体素(至少一个)，确保不会在孤立位置添加
        const hasNeighbor = voxels.some(voxel => {
          const dx = Math.abs(voxel.position.x - gridX);
          const dy = Math.abs(voxel.position.y - gridY);
          const dz = Math.abs(voxel.position.z - gridZ);
          
          // 检查是否是正好相邻(相差一个单位)
          return (
            (dx < 0.01 && dy < 0.01 && Math.abs(dz - cellSize) < 0.01) || // 前后相邻
            (dx < 0.01 && Math.abs(dy - cellSize) < 0.01 && dz < 0.01) || // 上下相邻
            (Math.abs(dx - cellSize) < 0.01 && dy < 0.01 && dz < 0.01)    // 左右相邻
          );
        });
        
        if (hasNeighbor) {
          candidates.push({
            position: new THREE.Vector3(gridX, gridY, gridZ),
            distance: dist
          });
        }
      }
    }
    
    // 按距离排序，返回最近的有效位置
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.distance - b.distance);
      return candidates[0].position;
    }
    
    return null;
  }, [raycaster, voxels]);
  
  // 监听悬停体素变化，更新基于体素面的预览
  useEffect(() => {
    if (toolMode === 'add') {
      // 添加模式下更新网格捕捉预览
      checkGridSnapping();
    } else if (toolMode === 'pushpull' && storeHoveredVoxel && selectedFace) {
      // 推拉模式下，更新本地悬停状态
      setLocalHovered({
        position: storeHoveredVoxel.position.clone(),
        normal: selectedFace.normal.clone()
      });
      
      // 记录调试信息
      console.log('设置推拉悬停状态:', 
        '位置:', storeHoveredVoxel.position.toArray(), 
        '法线:', selectedFace.normal.toArray()
      );
    } else if (toolMode === 'pushpull' && !storeHoveredVoxel) {
      // 清除本地悬停状态
      setLocalHovered(null);
    }
  }, [storeHoveredVoxel, selectedFace, toolMode, checkGridSnapping]);
  
  // 添加场景点击处理函数 - 添加体素
  const handleSceneClick = useCallback((e: any) => {
    // 防止事件冒泡
    e.stopPropagation();

    // 添加模式下，如果有临时体素，则添加它
    if (toolMode === 'add' && tempVoxel) {
      // 检查是否已存在体素（二次验证）
      const exists = voxels.some(voxel => 
        Math.abs(voxel.position.x - tempVoxel.position.x) < 0.01 && 
        Math.abs(voxel.position.y - tempVoxel.position.y) < 0.01 && 
        Math.abs(voxel.position.z - tempVoxel.position.z) < 0.01
      );
      
      if (!exists) {
        // 执行添加
        addVoxel({
          position: tempVoxel.position.clone(),
          color: '#1e88e5' // 使用默认颜色
        });
      }
      
      // 添加后短暂清除临时体素，给用户视觉反馈
      setTempVoxel(null);
      setTimeout(() => {
        // 重新检测捕捉位置
        checkGridSnapping();
      }, 50);
    }
  }, [toolMode, tempVoxel, addVoxel, checkGridSnapping, voxels]);
  
  // 处理鼠标按下事件 - 激活推拉工具
  const handleMouseDown = useCallback((e: MouseEvent) => {
    // 记录鼠标按下时的工具模式和悬停状态
    console.log('鼠标按下:', 
      '工具模式:', toolMode, 
      '本地悬停:', localHovered ? true : false
    );
    
    if (toolMode === 'pushpull' && localHovered && localHovered.normal) {
      e.preventDefault();
      
      // 如果推拉状态已经激活，不要重复激活
      if (pushPullState.active) {
        return;
      }
    
      // 获取当前悬停的法向量和位置
      const normal = localHovered.normal.clone();
      const position = localHovered.position.clone();
      
      console.log('推拉激活: 位置', position.toArray(), '法线', normal.toArray());
      
      // 查找同一平面上的所有体素
      const { voxels: selectedVoxels, center, faces } = findVoxelsInSamePlane(
        position, 
        normal
      );
      
      console.log('找到同平面体素:', selectedVoxels.length, '面中心:', center.toArray());
      
      // 只有找到有效体素才激活推拉操作
      if (selectedVoxels.length > 0) {
        // 一次点击就激活推拉操作，不需要持续按住鼠标
        setPushPullState({
          active: true,
          startPosition: new THREE.Vector3(e.clientX, e.clientY, 0),
          normal: normal,
          distance: 0,
          faceCenter: center,
          selectedVoxels: selectedVoxels.map(v => ({
            position: v.position.clone(),
            color: v.color
          })),
          highlightedFaces: faces
        });
      } else {
        console.log('没有找到有效体素面，无法激活推拉');
      }
    }
  }, [toolMode, localHovered, findVoxelsInSamePlane, pushPullState]);

  // 处理鼠标释放事件，执行推拉操作
  const handleMouseUp = useCallback((e: MouseEvent) => {
    // 只有当推拉距离不为0时才执行推拉操作
    if (pushPullState.active && pushPullState.distance !== 0) {
      e.preventDefault();
      
      // 执行推拉操作
      pushPullFace(pushPullState.normal, pushPullState.distance);
      
      // 执行完推拉后，重置推拉状态准备下一次操作
      setPushPullState({
        active: false,
        startPosition: new THREE.Vector3(),
        normal: new THREE.Vector3(),
        distance: 0,
        faceCenter: new THREE.Vector3(),
        selectedVoxels: [],
        highlightedFaces: []
      });
    }
  }, [pushPullState, pushPullFace]);
  
  // 添加鼠标事件监听
  useEffect(() => {
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseUp]);
  
  // 推拉预览渲染 - 移动到组件内部
  const renderedPushPullPreview = useMemo(() => {
    const previewElements: React.ReactElement[] = [];
    
    // 推拉操作激活时的预览
    if (pushPullState.active) {
      const normal = pushPullState.normal;
      const distance = pushPullState.distance;
      
      // 添加控制杆
      previewElements.push(
        <PushPullHandle 
          key="pullhandle"
          position={pushPullState.faceCenter}
          normal={normal}
          distance={distance}
          onUpdate={updatePushPullDistance}
        />
      );
      
      // 根据推拉方向显示预览
      if (distance !== 0) {
        const steps = Math.round(Math.abs(distance) / 0.3);
        const previewColor = distance > 0 ? '#00ff00' : '#ff0000';
        const previewOpacity = 0.5;
        
        pushPullState.selectedVoxels.forEach((voxel, vIndex) => {
          for (let i = 1; i <= steps; i++) {
            // 向外推拉时创建预览体素
            if (distance > 0) {
              const previewPos = voxel.position.clone().add(
                normal.clone().multiplyScalar(i * 0.3)
              );
              
              // 检查这个位置是否已有体素
              const hasVoxel = voxels.some(v => 
                Math.abs(v.position.x - previewPos.x) < 0.01 &&
                Math.abs(v.position.y - previewPos.y) < 0.01 &&
                Math.abs(v.position.z - previewPos.z) < 0.01
              );
              
              if (!hasVoxel) {
                previewElements.push(
                  <Voxel
                    key={`preview-${vIndex}-${i}`}
                    position={previewPos}
                    color={previewColor}
                    opacity={previewOpacity}
                    isPreview
                  />
                );
              }
            } 
            // 向内推拉时高亮将被删除的体素
            else if (distance < 0) {
              const checkPos = voxel.position.clone().add(
                normal.clone().multiplyScalar(-i * 0.3)
              );
              
              // 找出这个位置是否有体素并高亮显示
              voxels.forEach((existingVoxel, eIndex) => {
                if (Math.abs(existingVoxel.position.x - checkPos.x) < 0.01 &&
                    Math.abs(existingVoxel.position.y - checkPos.y) < 0.01 &&
                    Math.abs(existingVoxel.position.z - checkPos.z) < 0.01) {
                  previewElements.push(
                    <mesh
                      key={`delete-preview-${eIndex}-${i}`}
                      position={existingVoxel.position.clone()}
                      scale={[1.02, 1.02, 1.02]}
                    >
                      <boxGeometry args={[0.301, 0.301, 0.301]} />
                      <meshBasicMaterial color={previewColor} wireframe transparent opacity={previewOpacity} />
                    </mesh>
                  );
                }
              });
            }
          }
        });
      }
      
      // 高亮当前选中的面
      pushPullState.highlightedFaces.forEach((face, index) => {
        previewElements.push(
          <FaceHighlight
            key={`active-face-${index}`}
            position={face.position}
            normal={face.normal}
            color="#ffcc00"
            opacity={0.5}
          />
        );
      });
    } 
    // 非激活状态下，高亮显示悬停时的同平面体素面
    else if (toolMode === 'pushpull' && localHovered && localHovered.normal) {
      // 查找同一平面的所有体素面
      const { faces } = findVoxelsInSamePlane(
        localHovered.position,
        localHovered.normal
      );
      
      // 为同一平面的所有体素面添加高亮效果
      faces.forEach((face, index) => {
        previewElements.push(
          <FaceHighlight
            key={`hover-face-${index}`}
            position={face.position}
            normal={face.normal}
            color="#ffff00"
            opacity={0.3}
          />
        );
      });
    }
    
    return <>{previewElements}</>;
  }, [pushPullState, toolMode, updatePushPullDistance, voxels, localHovered, findVoxelsInSamePlane]);
  
  return (
    <group 
      ref={groupRef}
      onClick={handleSceneClick}
    >
      {/* 渲染所有已放置的体素 */}
      {voxels.map((voxel) => (
        <Voxel
          key={`voxel-${voxel.position.x}-${voxel.position.y}-${voxel.position.z}`}
          position={voxel.position}
          color={voxel.color}
        />
      ))}
      
      {/* 渲染临时预览体素 */}
      {tempVoxel && (
        <Voxel
          position={tempVoxel.position}
          color={tempVoxel.color}
          opacity={0.5}
          isPreview
        />
      )}
      
      {/* 渲染推拉预览 */}
      {renderedPushPullPreview}
    </group>
  );
}; 