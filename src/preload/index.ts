import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { RawMaterial, PackingMaterial, RawMaterialMaster } from '../shared/types'
import pkg from "../../package.json"
// Custom APIs for renderer
const api = {
  // 원재료 API
  rawMaterials: {
    getAll: (): Promise<RawMaterial[]> => ipcRenderer.invoke('raw-materials:getAll'),
    getById: (id: number): Promise<RawMaterial | null> => ipcRenderer.invoke('raw-materials:getById', id),
    create: (material: Omit<RawMaterial, 'id' | 'created_at' | 'updated_at'>): Promise<RawMaterial> =>
      ipcRenderer.invoke('raw-materials:create', material),
    update: (id: number, material: Partial<Omit<RawMaterial, 'id' | 'created_at' | 'updated_at'>>): Promise<RawMaterial | null> =>
      ipcRenderer.invoke('raw-materials:update', id, material),
    delete: (id: number): Promise<boolean> => ipcRenderer.invoke('raw-materials:delete', id),
    generateTestNumber: (): Promise<string> => ipcRenderer.invoke('raw-materials:generateTestNumber'),
    checkTestNumberExists: (testNumber: string, excludeId?: number): Promise<boolean> =>
      ipcRenderer.invoke('raw-materials:checkTestNumberExists', testNumber, excludeId),
    findLatestByName: (name: string): Promise<RawMaterial | null> =>
      ipcRenderer.invoke('raw-materials:findLatestByName', name)
  },
  // 부자재 API
  packingMaterials: {
    getAll: (): Promise<PackingMaterial[]> => ipcRenderer.invoke('packing-materials:getAll'),
    getById: (id: number): Promise<PackingMaterial | null> => ipcRenderer.invoke('packing-materials:getById', id),
    create: (material: Omit<PackingMaterial, 'id' | 'created_at' | 'updated_at'>): Promise<PackingMaterial> =>
      ipcRenderer.invoke('packing-materials:create', material),
    update: (id: number, material: Partial<Omit<PackingMaterial, 'id' | 'created_at' | 'updated_at'>>): Promise<PackingMaterial | null> =>
      ipcRenderer.invoke('packing-materials:update', id, material),
    delete: (id: number): Promise<boolean> => ipcRenderer.invoke('packing-materials:delete', id),
    generateTestNumber: (): Promise<string> => ipcRenderer.invoke('packing-materials:generateTestNumber'),
    checkTestNumberExists: (testNumber: string, excludeId?: number): Promise<boolean> =>
      ipcRenderer.invoke('packing-materials:checkTestNumberExists', testNumber, excludeId)
  },
  // 원료 마스터 API
  rawMaterialMasters: {
    getAll: (): Promise<RawMaterialMaster[]> => ipcRenderer.invoke('raw-material-masters:getAll'),
    getById: (id: number): Promise<RawMaterialMaster | null> => ipcRenderer.invoke('raw-material-masters:getById', id),
    getByName: (name: string): Promise<RawMaterialMaster | null> => ipcRenderer.invoke('raw-material-masters:getByName', name),
    search: (query: string): Promise<RawMaterialMaster[]> => ipcRenderer.invoke('raw-material-masters:search', query),
    create: (master: Omit<RawMaterialMaster, 'id' | 'created_at' | 'updated_at'>): Promise<RawMaterialMaster> =>
      ipcRenderer.invoke('raw-material-masters:create', master),
    update: (id: number, master: Partial<Omit<RawMaterialMaster, 'id' | 'created_at' | 'updated_at'>>): Promise<RawMaterialMaster | null> =>
      ipcRenderer.invoke('raw-material-masters:update', id, master),
    delete: (id: number): Promise<boolean> => ipcRenderer.invoke('raw-material-masters:delete', id),
    convertToRawMaterial: (masterId: number, manufacturingDate: string, receivingQuantity: number, quantity: number): Promise<Omit<RawMaterial, 'id' | 'testNumber' | 'created_at' | 'updated_at'> | null> =>
      ipcRenderer.invoke('raw-material-masters:convertToRawMaterial', masterId, manufacturingDate, receivingQuantity, quantity)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld("appInfo", {
      version: pkg.version,
      name: pkg.name,
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
