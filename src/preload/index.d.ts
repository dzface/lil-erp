import { ElectronAPI } from '@electron-toolkit/preload'
import type { RawMaterial, PackingMaterial, RawMaterialMaster } from '../shared/types'

export interface InventoryAPI {
  rawMaterials: {
    getAll: () => Promise<RawMaterial[]>
    getById: (id: number) => Promise<RawMaterial | null>
    create: (material: Omit<RawMaterial, 'id' | 'created_at' | 'updated_at'>) => Promise<RawMaterial>
    update: (id: number, material: Partial<Omit<RawMaterial, 'id' | 'created_at' | 'updated_at'>>) => Promise<RawMaterial | null>
    delete: (id: number) => Promise<boolean>
    generateTestNumber: () => Promise<string>
    checkTestNumberExists: (testNumber: string, excludeId?: number) => Promise<boolean>
    findLatestByName: (name: string) => Promise<RawMaterial | null>
  }
  packingMaterials: {
    getAll: () => Promise<PackingMaterial[]>
    getById: (id: number) => Promise<PackingMaterial | null>
    create: (material: Omit<PackingMaterial, 'id' | 'created_at' | 'updated_at'>) => Promise<PackingMaterial>
    update: (id: number, material: Partial<Omit<PackingMaterial, 'id' | 'created_at' | 'updated_at'>>) => Promise<PackingMaterial | null>
    delete: (id: number) => Promise<boolean>
    generateTestNumber: () => Promise<string>
    checkTestNumberExists: (testNumber: string, excludeId?: number) => Promise<boolean>
  }
  rawMaterialMasters: {
    getAll: () => Promise<RawMaterialMaster[]>
    getById: (id: number) => Promise<RawMaterialMaster | null>
    getByName: (name: string) => Promise<RawMaterialMaster | null>
    search: (query: string) => Promise<RawMaterialMaster[]>
    create: (master: Omit<RawMaterialMaster, 'id' | 'created_at' | 'updated_at'>) => Promise<RawMaterialMaster>
    update: (id: number, master: Partial<Omit<RawMaterialMaster, 'id' | 'created_at' | 'updated_at'>>) => Promise<RawMaterialMaster | null>
    delete: (id: number) => Promise<boolean>
    convertToRawMaterial: (masterId: number, manufacturingDate: string, receivingQuantity: number, quantity: number) => Promise<Omit<RawMaterial, 'id' | 'testNumber' | 'created_at' | 'updated_at'> | null>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: InventoryAPI
  }
}
