import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
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
  const lastDistance = useRef(distance);
  
  // 复用向量对象以减少GC压力
  const tempVector = useMemo(() => new THREE.Vector3(), []);
  const handlePosition = useMemo(() => new THREE.Vector3(), []);
  const normalClone = useMemo(() => new THREE.Vector3(), []);
  
  // 计算控制杆的旋转 - 确保它对齐到法线方向
  const handleRotation = useMemo(() => {
    // 创建一个四元数从 +Y 方向（圆柱体默认方向）旋转到目标法线方向
    const quaternion = new THREE.Quaternion();
    const upVector = new THREE.Vector3(0, 1, 0);
    
    // 检查法线是否与Y轴平行
    if (Math.abs(normal.y) > 0.999) {
      // 如果法线是 +Y 或 -Y，使用特殊处理
      if (normal.y > 0) {
        // 正Y轴，不需要旋转
        quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0);
      } else {
        // 负Y轴，旋转180度
        quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
      }
    } else {
      // 计算旋转轴（法线和Y轴的叉积）
      const rotationAxis = new THREE.Vector3().crossVectors(upVector, normal).normalize();
      
      // 计算旋转角度
      const angle = Math.acos(upVector.dot(normal));
      
      // 设置四元数
      quaternion.setFromAxisAngle(rotationAxis, angle);
    }
    
    // 将四元数转换为欧拉角
    const euler = new THREE.Euler().setFromQuaternion(quaternion);
    
    return [euler.x, euler.y, euler.z] as [number, number, number];
  }, [normal]);
  
  // 预计算控制杆位置 - 确保每次渲染时位置都是最新的
  useEffect(() => {
    if (distance !== lastDistance.current) {
      lastDistance.current = distance;
    }
    
    // 计算推拉杆的位置 - 始终保持在所选面的中心
    handlePosition.copy(position);
    
    // 如果groupRef已经存在，直接更新位置
    if (groupRef.current) {
      groupRef.current.position.copy(handlePosition);
    }
  }, [position, distance, handlePosition]);
  
  // 添加鼠标状态追踪
  const [isHovered, setIsHovered] = useState(false);
  
  // 控制杆拖动处理 - 提高响应灵敏度
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
    
    // 使用射线投射来确定拖动方向
    const { raycaster, camera } = useThree();
    
    // 创建一个射线，从相机指向鼠标位置
    raycaster.setFromCamera(
      new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      ), 
      camera
    );
    
    // 计算射线方向与法线的点积，确定移动方向
    const directionDot = raycaster.ray.direction.dot(normal);
    
    // 获取当前鼠标位置和上一个鼠标位置之间的距离
    const mouseDelta = new THREE.Vector2(
      e.clientX - startPosition.current.x,
      e.clientY - startPosition.current.y
    );
    
    // 计算鼠标移动距离
    const mouseMoveDistance = mouseDelta.length();
    
    // 根据相机距离调整灵敏度
    const sensitivity = 0.01 * camera.position.distanceTo(position);
    
    // 计算拖动距离，考虑方向
    const dragDistance = mouseMoveDistance * sensitivity * (directionDot > 0 ? -1 : 1);
    
    // 更新推拉距离，正负号取决于鼠标移动方向与当前拖动方向的一致性
    const moveDirectionY = Math.sign(mouseDelta.y);
    const dragDirectionSign = moveDirectionY * Math.sign(dragDistance);
    
    // 计算新的距离
    const newDistance = lastDistance.current + (dragDirectionSign * Math.abs(dragDistance));
    
    // 量化距离到体素大小的倍数
    const quantizedDistance = Math.round(newDistance / 0.3) * 0.3;
    
    // 只有当距离发生实质性变化时才更新
    if (quantizedDistance !== lastDistance.current) {
      lastDistance.current = quantizedDistance;
      onUpdate(quantizedDistance);
    }
    
    // 更新起始位置
    startPosition.current.set(e.clientX, e.clientY, 0);
  }, [normal, onUpdate, position]);
  
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
  
  // 控制杆高亮颜色 - 增加视觉反馈
  const baseColor = isHovered ? "#ffaa44" : "#ff9900";
  const lineColor = isHovered ? "#ff7744" : "#ff6600";
  const arrowColor = isHovered ? "#ff5500" : "#ff3300";
  
  // 控制杆样式根据距离调整
  const cylinderLength = Math.max(0.5, Math.abs(distance) + 0.3);
  
  return (
    <group ref={groupRef}>
      <group rotation={handleRotation}>
        {/* 控制杆箭头 - 始终显示在杆的前端 */}
        <mesh 
          position={[0, distance === 0 ? 0.6 : distance + 0.3, 0]}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerMove={handlePointerMove}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <coneGeometry args={[0.1, 0.2]} />
          <meshStandardMaterial color={arrowColor} />
        </mesh>
        
        {/* 控制杆柄 - 长度随距离变化 */}
        <mesh 
          position={[0, distance === 0 ? 0.3 : distance / 2 + 0.15, 0]}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerMove={handlePointerMove}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <cylinderGeometry args={[0.05, 0.05, cylinderLength]} />
          <meshStandardMaterial color={lineColor} />
        </mesh>
        
        {/* 控制杆基座 - 始终在面中心 */}
        <mesh
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerMove={handlePointerMove}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color={baseColor} transparent opacity={0.8} />
        </mesh>
        
        {/* 增加一个大型但不可见的碰撞区域，使拖动更容易 */}
        <mesh 
          position={[0, distance === 0 ? 0.3 : distance / 2, 0]}
          scale={[2, Math.max(2, Math.abs(distance) * 2), 2]}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerMove={handlePointerMove}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
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
  // 确定要渲染的面的旋转，使用四元数计算
  const rotation = useMemo(() => {
    // 创建一个四元数从 Z 方向（平面默认法线）旋转到目标法线方向
    const quaternion = new THREE.Quaternion();
    const zAxis = new THREE.Vector3(0, 0, 1);
    
    // 检查法线是否与Z轴平行
    if (Math.abs(normal.z) > 0.999) {
      if (normal.z > 0) {
        // 正Z轴，不需要旋转
        quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0);
      } else {
        // 负Z轴，旋转180度
        quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
      }
    } else {
      // 计算旋转轴（法线和Z轴的叉积）
      const rotationAxis = new THREE.Vector3().crossVectors(zAxis, normal).normalize();
      
      // 如果旋转轴接近零向量（法线与Z轴平行），使用X轴作为旋转轴
      if (rotationAxis.lengthSq() < 0.001) {
        rotationAxis.set(1, 0, 0);
      }
      
      // 计算旋转角度
      const angle = Math.acos(zAxis.dot(normal));
      
      // 设置四元数
      quaternion.setFromAxisAngle(rotationAxis, angle);
    }
    
    // 将四元数转换为欧拉角
    const euler = new THREE.Euler().setFromQuaternion(quaternion);
    
    return [euler.x, euler.y, euler.z] as [number, number, number];
  }, [normal]);
  
  // 偏移距离，确保高亮面在体块表面的外侧一点点
  const offset = 0.002;
  
  // 面的位置，基于体块位置和法向量方向
  const facePosition = position.clone().add(
    normal.clone().multiplyScalar(0.15 + offset)
  );
  
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
  const { voxels, hoveredVoxel: storeHoveredVoxel, selectedFace, toolMode, 
    pushPullFace: _storePushPullFace, 
    addVoxel, setHoveredVoxel, setSelectedFace, removeVoxel } = useStore();
  const { camera, raycaster, mouse, scene } = useThree();
  
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

  // 已确认使用的捕捉到网格的状态
  const [_gridSnapped, setGridSnapped] = useState(false);
  
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
    setPushPullState(prev => {
      // 确保距离是3mm的整数倍
      const adjustedDistance = Math.round(newDistance / 0.3) * 0.3;
      
      // 如果距离没有变化，不更新状态
      if (adjustedDistance === prev.distance) {
        return prev;
      }
      
      return {
        ...prev,
        distance: adjustedDistance
      };
    });
  }, []);

  // 实现推拉操作，添加或删除体素
  const pushPullFace = useCallback((normal: THREE.Vector3, distance: number) => {
    if (Math.abs(distance) < 0.01) return; // 如果距离太小，不执行操作
    
    // 距离应该是3mm的整数倍
    const steps = Math.round(Math.abs(distance) / 0.3);
    
    // 记录操作起始时间，用于性能测量
    const startTime = performance.now();
    
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
          
          // 优化：使用集合记录要删除的位置，最后一次性删除
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
    
    // 记录操作耗时，如果太长应该做性能优化
    const endTime = performance.now();
    console.log(`推拉操作完成，耗时: ${endTime - startTime}ms`);
    
    // 操作完成后，短暂延迟重置状态，让用户有视觉反馈
    setTimeout(() => {
      setPushPullState(prev => ({
        ...prev,
        distance: 0 // 重置距离，但保持激活状态和选中的面
      }));
    }, 100);
  }, [pushPullState.selectedVoxels, voxels, addVoxel, removeVoxel]);

  // 监听悬停体素变化，更新基于体素面的预览
  useEffect(() => {
    if (toolMode === 'add') {
      // 添加模式下更新网格捕捉预览
      checkGridSnapping();
    } else if (toolMode === 'pushpull' && storeHoveredVoxel && selectedFace && !pushPullState.active) {
      // 推拉模式下且没有激活推拉操作时，更新本地悬停状态
      setLocalHovered({
        position: storeHoveredVoxel.position.clone(),
        normal: selectedFace.normal.clone()
      });
    } else if (toolMode === 'pushpull' && !storeHoveredVoxel && !pushPullState.active) {
      // 清除本地悬停状态（但不影响已激活的推拉操作）
      setLocalHovered(null);
    }
  }, [storeHoveredVoxel, selectedFace, toolMode, checkGridSnapping, pushPullState.active]);
  
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
    if (toolMode === 'pushpull' && localHovered && localHovered.normal) {
      e.preventDefault();
      
      // 如果推拉状态已经激活，不要重复激活
      if (pushPullState.active) {
        return;
      }
    
      // 获取当前悬停的法向量和位置
      const normal = localHovered.normal.clone();
      const position = localHovered.position.clone();
      
      // 查找同一平面上的所有体素
      const { voxels: selectedVoxels, center, faces } = findVoxelsInSamePlane(
        position, 
        normal
      );
      
      // 只有找到有效体素才激活推拉操作
      if (selectedVoxels.length > 0) {
        // 激活推拉操作
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
        
        // 播放激活音效或视觉提示
        if (selectedVoxels.length > 1) {
          console.log(`已选中${selectedVoxels.length}个面进行推拉操作`);
        }
      }
    }
  }, [toolMode, localHovered, findVoxelsInSamePlane, pushPullState]);
  
  // 处理鼠标释放事件，执行推拉操作
  const handleMouseUp = useCallback((e: MouseEvent) => {
    // 只有当推拉距离不为0时才执行推拉操作
    if (pushPullState.active && Math.abs(pushPullState.distance) > 0.01) {
      e.preventDefault();
      
      // 执行推拉操作
      pushPullFace(pushPullState.normal, pushPullState.distance);
      
      // 不要马上重置推拉状态，保持激活以便用户继续操作
      // 只有当用户点击其他地方或按下ESC键时才完全重置
    } else if (pushPullState.active && Math.abs(pushPullState.distance) <= 0.01) {
      // 如果距离接近0，可以考虑重置状态
      setPushPullState(prev => ({
        ...prev,
        distance: 0
      }));
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

  // 添加键盘事件处理 - 支持ESC键取消推拉操作
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pushPullState.active) {
        // 取消推拉操作，完全重置状态
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
    };
    
    // 添加点击空白区域结束推拉的功能
    const handleClickOutside = (e: MouseEvent) => {
      // 检查是否点击在3D场景之外
      if (pushPullState.active && e.target && !(e.target as HTMLElement).closest('canvas')) {
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
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClickOutside);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [pushPullState]);
  
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