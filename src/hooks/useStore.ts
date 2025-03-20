import { create } from 'zustand';
import { Vector3 } from 'three';

// 体素接口
interface Voxel {
  position: Vector3;
  color: string;
}

// 面接口
interface Face {
  normal: Vector3;
}

// 工具模式类型
type ToolMode = 'add' | 'remove' | 'pushpull';

// 存储状态接口
interface StoreState {
  voxels: Voxel[];
  hoveredVoxel: Voxel | null;
  selectedFace: Face | null;
  toolMode: ToolMode;
  
  // 操作方法
  setHoveredVoxel: (voxel: Voxel | null) => void;
  setSelectedFace: (face: Face | null) => void;
  setToolMode: (mode: ToolMode) => void;
  addVoxel: (voxel: Voxel) => void;
  removeVoxel: (position: Vector3) => void;
  pushPullFace: (normal: Vector3, distance: number) => void;
  resetWorld: () => void;
}

// 判断两个位置是否相同的辅助函数
const isSamePosition = (a: Vector3, b: Vector3): boolean => {
  return a.x === b.x && a.y === b.y && a.z === b.z;
};

// 创建状态存储
export const useStore = create<StoreState>((set) => ({
  voxels: [
    // 初始体素（可以看作是一个起始的平台）
    { position: new Vector3(0, 0, 0), color: '#1e88e5' },
    { position: new Vector3(0.3, 0, 0), color: '#1e88e5' },
    { position: new Vector3(0, 0, 0.3), color: '#1e88e5' },
    { position: new Vector3(0.3, 0, 0.3), color: '#1e88e5' },
  ],
  hoveredVoxel: null,
  selectedFace: null,
  toolMode: 'add',

  // 设置悬停的体素
  setHoveredVoxel: (voxel) => set({ hoveredVoxel: voxel }),
  
  // 设置选中的面
  setSelectedFace: (face) => set({ selectedFace: face }),
  
  // 设置工具模式
  setToolMode: (mode) => set({ toolMode: mode }),
  
  // 添加新体素
  addVoxel: (voxel) => set((state) => {
    // 检查该位置是否已存在体素
    const exists = state.voxels.some((v) => isSamePosition(v.position, voxel.position));
    
    if (!exists) {
      // 添加成功
      return { voxels: [...state.voxels, {
        position: new Vector3(voxel.position.x, voxel.position.y, voxel.position.z),
        color: voxel.color
      }] };
    }
    // 添加失败（位置已存在体素）
    return state;
  }),
  
  // 移除体素
  removeVoxel: (position) => set((state) => {
    const filteredVoxels = state.voxels.filter(
      (voxel) => !isSamePosition(voxel.position, position)
    );
    return { voxels: filteredVoxels };
  }),
  
  // 推拉面（将会复制整个面并移动）
  pushPullFace: (normal, distance) => set((state) => {
    // 正常化距离，确保是体素大小的整数倍
    const normalizedDistance = Math.round(distance / 0.3) * 0.3;
    
    // 如果距离为0，不做任何操作
    if (normalizedDistance === 0) return state;
    
    // 如果选中的面为空，无法执行推拉操作
    if (!state.selectedFace || !state.hoveredVoxel) return state;
    
    // 获取法向量和所选面的位置
    const faceNormal = state.selectedFace.normal;
    const facePosition = state.hoveredVoxel.position;
    
    // 计算平面方程：ax + by + cz + d = 0
    const a = faceNormal.x;
    const b = faceNormal.y;
    const c = faceNormal.z;
    const d = -(a * facePosition.x + b * facePosition.y + c * facePosition.z);
    
    // 找出同一平面上的所有体素
    const voxelsInPlane: Voxel[] = [];
    
    // 查找在同一平面上且没有被其他体素覆盖的表面体素
    state.voxels.forEach(voxel => {
      // 计算体素到平面的距离，判断是否在同一平面上
      const distToPlane = Math.abs(a * voxel.position.x + b * voxel.position.y + c * voxel.position.z + d);
      
      if (distToPlane < 0.01) {
        // 检查在法线方向上是否有其他体素覆盖
        const checkPos = new Vector3().copy(voxel.position).add(
          new Vector3().copy(faceNormal).multiplyScalar(0.3)
        );
        
        const hasNeighbor = state.voxels.some(v => 
          Math.abs(v.position.x - checkPos.x) < 0.01 && 
          Math.abs(v.position.y - checkPos.y) < 0.01 && 
          Math.abs(v.position.z - checkPos.z) < 0.01
        );
        
        // 如果没有邻居体素覆盖，则这个是表面体素
        if (!hasNeighbor) {
          voxelsInPlane.push(voxel);
        }
      }
    });
    
    // 如果未找到同平面体素，不进行操作
    if (voxelsInPlane.length === 0) return state;
    
    let updatedVoxels = [...state.voxels];
    
    // 根据推拉方向执行不同操作
    if (normalizedDistance > 0) {
      // 向外推 - 添加新体素
      
      // 创建新的体素列表
      const newVoxels: Voxel[] = [];
      
      // 计算推拉的层数
      const steps = Math.round(Math.abs(normalizedDistance) / 0.3);
      
      // 为每个面上的体素，向外推出steps层新体素
      voxelsInPlane.forEach(voxel => {
        for (let i = 1; i <= steps; i++) {
          const newPosition = new Vector3().copy(voxel.position).add(
            new Vector3().copy(faceNormal).multiplyScalar(i * 0.3)
          );
          
          // 检查新位置是否已有体素
          const exists = updatedVoxels.some(v => 
            Math.abs(v.position.x - newPosition.x) < 0.01 && 
            Math.abs(v.position.y - newPosition.y) < 0.01 && 
            Math.abs(v.position.z - newPosition.z) < 0.01
          );
          
          // 如果位置空闲，添加新体素
          if (!exists) {
            newVoxels.push({
              position: newPosition,
              color: voxel.color
            });
          }
        }
      });
      
      // 合并原始体素和新创建的体素
      updatedVoxels = [...updatedVoxels, ...newVoxels];
      
    } else if (normalizedDistance < 0) {
      // 向内拉 - 删除体素
      
      // 计算拉入的层数
      const steps = Math.round(Math.abs(normalizedDistance) / 0.3);
      
      // 记录要删除的体素位置
      const positionsToRemove = new Set<string>();
      
      // 对每个面上的体素，向内查找并标记要删除的体素
      voxelsInPlane.forEach(voxel => {
        for (let i = 1; i <= steps; i++) {
          const checkPosition = new Vector3().copy(voxel.position).add(
            new Vector3().copy(faceNormal).multiplyScalar(-i * 0.3)
          );
          
          // 检查该位置是否有体素，如果有则标记删除
          state.voxels.forEach(existingVoxel => {
            if (Math.abs(existingVoxel.position.x - checkPosition.x) < 0.01 && 
                Math.abs(existingVoxel.position.y - checkPosition.y) < 0.01 && 
                Math.abs(existingVoxel.position.z - checkPosition.z) < 0.01) {
              
              // 使用字符串表示位置，便于Set去重
              const posKey = `${existingVoxel.position.x},${existingVoxel.position.y},${existingVoxel.position.z}`;
              positionsToRemove.add(posKey);
            }
          });
        }
      });
      
      // 过滤掉需要删除的体素
      if (positionsToRemove.size > 0) {
        updatedVoxels = state.voxels.filter(voxel => {
          const posKey = `${voxel.position.x},${voxel.position.y},${voxel.position.z}`;
          return !positionsToRemove.has(posKey);
        });
      }
    }
    
    return { voxels: updatedVoxels };
  }),
  
  // 重置世界
  resetWorld: () => set({
    voxels: [
      { position: new Vector3(0, 0, 0), color: '#1e88e5' },
      { position: new Vector3(0.3, 0, 0), color: '#1e88e5' },
      { position: new Vector3(0, 0, 0.3), color: '#1e88e5' },
      { position: new Vector3(0.3, 0, 0.3), color: '#1e88e5' },
    ]
  })
})); 