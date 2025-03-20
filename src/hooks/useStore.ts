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
    // 这是一个简化版的推拉操作，完整实现会更复杂
    // 需要检测哪些体素在同一平面
    // 这里简单实现：复制所有体素并沿法线方向移动
    
    const normalizedDistance = Math.round(distance / 0.3) * 0.3; // 量化到3mm
    
    if (normalizedDistance === 0) return state;
    
    // 创建新体素
    const newVoxels = state.voxels.map(voxel => ({
      position: new Vector3().copy(voxel.position).add(
        new Vector3().copy(normal).multiplyScalar(normalizedDistance)
      ),
      color: voxel.color
    }));
    
    // 将新体素添加到现有体素中（确保没有重复）
    let combinedVoxels = [...state.voxels];
    
    newVoxels.forEach(newVoxel => {
      const exists = combinedVoxels.some(v => 
        isSamePosition(v.position, newVoxel.position)
      );
      
      if (!exists) {
        combinedVoxels.push(newVoxel);
      }
    });
    
    return { voxels: combinedVoxels };
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