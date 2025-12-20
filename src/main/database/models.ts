import Database from 'better-sqlite3'
import type { RawMaterial, PackingMaterial, RawMaterialMaster } from '../../shared/types'

export type { RawMaterial, PackingMaterial, RawMaterialMaster }

export class InventoryDB {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  // 원재료 CRUD
  getAllRawMaterials(): RawMaterial[] {
    const stmt = this.db.prepare('SELECT * FROM raw_materials ORDER BY created_at DESC')
    const results = stmt.all() as any[]
    return results.map(this.mapRawMaterialFromDB)
  }

  getRawMaterialById(id: number): RawMaterial | null {
    const stmt = this.db.prepare('SELECT * FROM raw_materials WHERE id = ?')
    const result = stmt.get(id) as any
    return result ? this.mapRawMaterialFromDB(result) : null
  }

  createRawMaterial(material: Omit<RawMaterial, 'id' | 'created_at' | 'updated_at'>): RawMaterial {
    const stmt = this.db.prepare(`
      INSERT INTO raw_materials (
        test_number, name, receiving_quantity, net_weight, weight_unit, quantity,
        manufacturing_date, expire_date, vendor, country, storage_conditions, food_type, memo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      material.testNumber,
      material.name,
      material.receivingQuantity,
      material.netWeight,
      material.weightUnit,
      material.quantity,
      material.manufacturingDate,
      material.expireDate,
      material.vendor,
      material.country,
      material.storageConditions,
      material.foodType || null,
      material.memo || null
    )
    return this.getRawMaterialById(result.lastInsertRowid as number)!
  }

  updateRawMaterial(id: number, material: Partial<Omit<RawMaterial, 'id' | 'created_at' | 'updated_at'>>): RawMaterial | null {
    const existing = this.getRawMaterialById(id)
    if (!existing) return null

    const updates: string[] = []
    const values: any[] = []

    const fieldMap: Record<string, string> = {
      testNumber: 'test_number',
      receivingQuantity: 'receiving_quantity',
      netWeight: 'net_weight',
      weightUnit: 'weight_unit',
      manufacturingDate: 'manufacturing_date',
      expireDate: 'expire_date',
      storageConditions: 'storage_conditions',
      foodType: 'food_type'
    }

    Object.entries(material).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = fieldMap[key] || key
        updates.push(`${dbField} = ?`)
        values.push(value)
      }
    })

    if (updates.length === 0) return existing

    values.push(id)
    const stmt = this.db.prepare(`UPDATE raw_materials SET ${updates.join(', ')} WHERE id = ?`)
    stmt.run(...values)
    return this.getRawMaterialById(id)
  }

  deleteRawMaterial(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM raw_materials WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  // 시험번호 자동 생성 (원재료: AR + YYMMDD + XX)
  generateRawMaterialTestNumber(): string {
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2)
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const prefix = `AR${year}${month}${day}`

    // 해당 날짜로 시작하는 시험번호 중 가장 큰 번호 찾기
    const stmt = this.db.prepare('SELECT test_number FROM raw_materials WHERE test_number LIKE ? ORDER BY test_number DESC LIMIT 1')
    const result = stmt.get(`${prefix}%`) as { test_number: string } | undefined

    if (result) {
      const lastNumber = parseInt(result.test_number.slice(-2))
      const nextNumber = String(lastNumber + 1).padStart(2, '0')
      return `${prefix}${nextNumber}`
    }

    return `${prefix}01`
  }

  // 시험번호 중복 체크 (원재료)
  checkRawMaterialTestNumberExists(testNumber: string, excludeId?: number): boolean {
    if (excludeId) {
      const stmt = this.db.prepare('SELECT id FROM raw_materials WHERE test_number = ? AND id != ?')
      const result = stmt.get(testNumber, excludeId)
      return !!result
    } else {
      const stmt = this.db.prepare('SELECT id FROM raw_materials WHERE test_number = ?')
      const result = stmt.get(testNumber)
      return !!result
    }
  }

  // 원료명으로 최근 원재료 찾기
  findLatestRawMaterialByName(name: string): RawMaterial | null {
    const stmt = this.db.prepare('SELECT * FROM raw_materials WHERE name = ? ORDER BY created_at DESC LIMIT 1')
    const result = stmt.get(name) as any
    return result ? this.mapRawMaterialFromDB(result) : null
  }

  // 부자재 CRUD
  getAllPackingMaterials(): PackingMaterial[] {
    const stmt = this.db.prepare('SELECT * FROM packing_materials ORDER BY created_at DESC')
    const results = stmt.all() as any[]
    return results.map(this.mapPackingMaterialFromDB)
  }

  getPackingMaterialById(id: number): PackingMaterial | null {
    const stmt = this.db.prepare('SELECT * FROM packing_materials WHERE id = ?')
    const result = stmt.get(id) as any
    return result ? this.mapPackingMaterialFromDB(result) : null
  }

  createPackingMaterial(material: Omit<PackingMaterial, 'id' | 'created_at' | 'updated_at'>): PackingMaterial {
    const stmt = this.db.prepare(`
      INSERT INTO packing_materials (
        test_number, product_name, material_name, receiving_quantity,
        lot_number, expire_date, result, category, vendor, memo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      material.testNumber,
      material.productName,
      material.materialName,
      material.receivingQuantity,
      material.lotNumber,
      material.expireDate,
      material.result ? 1 : 0,
      material.category,
      material.vendor,
      material.memo || null
    )
    return this.getPackingMaterialById(result.lastInsertRowid as number)!
  }

  updatePackingMaterial(id: number, material: Partial<Omit<PackingMaterial, 'id' | 'created_at' | 'updated_at'>>): PackingMaterial | null {
    const existing = this.getPackingMaterialById(id)
    if (!existing) return null

    const updates: string[] = []
    const values: any[] = []

    const fieldMap: Record<string, string> = {
      testNumber: 'test_number',
      productName: 'product_name',
      materialName: 'material_name',
      receivingQuantity: 'receiving_quantity',
      lotNumber: 'lot_number',
      expireDate: 'expire_date'
    }

    Object.entries(material).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'result') {
          updates.push('result = ?')
          values.push(value ? 1 : 0)
        } else {
          const dbField = fieldMap[key] || key
          updates.push(`${dbField} = ?`)
          values.push(value)
        }
      }
    })

    if (updates.length === 0) return existing

    values.push(id)
    const stmt = this.db.prepare(`UPDATE packing_materials SET ${updates.join(', ')} WHERE id = ?`)
    stmt.run(...values)
    return this.getPackingMaterialById(id)
  }

  deletePackingMaterial(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM packing_materials WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  // 시험번호 자동 생성 (부자재: AP + YYMMDD + XX)
  generatePackingMaterialTestNumber(): string {
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2)
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const prefix = `AP${year}${month}${day}`

    // 해당 날짜로 시작하는 시험번호 중 가장 큰 번호 찾기
    const stmt = this.db.prepare('SELECT test_number FROM packing_materials WHERE test_number LIKE ? ORDER BY test_number DESC LIMIT 1')
    const result = stmt.get(`${prefix}%`) as { test_number: string } | undefined

    if (result) {
      const lastNumber = parseInt(result.test_number.slice(-2))
      const nextNumber = String(lastNumber + 1).padStart(2, '0')
      return `${prefix}${nextNumber}`
    }

    return `${prefix}01`
  }

  // 시험번호 중복 체크 (부자재)
  checkPackingMaterialTestNumberExists(testNumber: string, excludeId?: number): boolean {
    if (excludeId) {
      const stmt = this.db.prepare('SELECT id FROM packing_materials WHERE test_number = ? AND id != ?')
      const result = stmt.get(testNumber, excludeId)
      return !!result
    } else {
      const stmt = this.db.prepare('SELECT id FROM packing_materials WHERE test_number = ?')
      const result = stmt.get(testNumber)
      return !!result
    }
  }

  // 원료 마스터 CRUD
  getAllRawMaterialMasters(): RawMaterialMaster[] {
    const stmt = this.db.prepare('SELECT * FROM raw_material_masters ORDER BY name ASC')
    const results = stmt.all() as any[]
    return results.map(this.mapRawMaterialMasterFromDB)
  }

  getRawMaterialMasterById(id: number): RawMaterialMaster | null {
    const stmt = this.db.prepare('SELECT * FROM raw_material_masters WHERE id = ?')
    const result = stmt.get(id) as any
    return result ? this.mapRawMaterialMasterFromDB(result) : null
  }

  getRawMaterialMasterByName(name: string): RawMaterialMaster | null {
    const stmt = this.db.prepare('SELECT * FROM raw_material_masters WHERE name = ?')
    const result = stmt.get(name) as any
    return result ? this.mapRawMaterialMasterFromDB(result) : null
  }

  searchRawMaterialMasters(query: string): RawMaterialMaster[] {
    const stmt = this.db.prepare('SELECT * FROM raw_material_masters WHERE name LIKE ? ORDER BY name ASC LIMIT 10')
    const results = stmt.all(`%${query}%`) as any[]
    return results.map(this.mapRawMaterialMasterFromDB)
  }

  createRawMaterialMaster(master: Omit<RawMaterialMaster, 'id' | 'created_at' | 'updated_at'>): RawMaterialMaster {
    const stmt = this.db.prepare(`
      INSERT INTO raw_material_masters (
        name, shelf_life_days, net_weight, weight_unit, vendor, country, storage_conditions, food_type, memo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      master.name,
      master.shelfLifeDays,
      master.netWeight,
      master.weightUnit,
      master.vendor,
      master.country,
      master.storageConditions,
      master.foodType || null,
      master.memo || null
    )
    return this.getRawMaterialMasterById(result.lastInsertRowid as number)!
  }

  updateRawMaterialMaster(id: number, master: Partial<Omit<RawMaterialMaster, 'id' | 'created_at' | 'updated_at'>>): RawMaterialMaster | null {
    const existing = this.getRawMaterialMasterById(id)
    if (!existing) return null

    const updates: string[] = []
    const values: any[] = []

    const fieldMap: Record<string, string> = {
      shelfLifeDays: 'shelf_life_days',
      netWeight: 'net_weight',
      weightUnit: 'weight_unit',
      storageConditions: 'storage_conditions',
      foodType: 'food_type'
    }

    Object.entries(master).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = fieldMap[key] || key
        updates.push(`${dbField} = ?`)
        values.push(value)
      }
    })

    if (updates.length === 0) return existing

    values.push(id)
    const stmt = this.db.prepare(`UPDATE raw_material_masters SET ${updates.join(', ')} WHERE id = ?`)
    stmt.run(...values)
    return this.getRawMaterialMasterById(id)
  }

  deleteRawMaterialMaster(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM raw_material_masters WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  // 원료 마스터를 RawMaterial로 변환 (입고 등록 시 사용)
  convertMasterToRawMaterial(master: RawMaterialMaster, manufacturingDate: string, receivingQuantity: number, quantity: number): Omit<RawMaterial, 'id' | 'testNumber' | 'created_at' | 'updated_at'> {
    const mfgDate = new Date(manufacturingDate)
    const expireDate = new Date(mfgDate)
    expireDate.setDate(expireDate.getDate() + master.shelfLifeDays)

    return {
      name: master.name,
      receivingQuantity,
      netWeight: master.netWeight,
      weightUnit: master.weightUnit,
      quantity,
      manufacturingDate: mfgDate.toISOString(),
      expireDate: expireDate.toISOString(),
      vendor: master.vendor,
      country: master.country,
      storageConditions: master.storageConditions,
      foodType: master.foodType,
      memo: master.memo
    }
  }

  // DB 결과를 모델로 변환
  private mapRawMaterialFromDB(row: any): RawMaterial {
    return {
      id: row.id,
      testNumber: row.test_number,
      name: row.name,
      receivingQuantity: row.receiving_quantity,
      netWeight: row.net_weight,
      weightUnit: row.weight_unit,
      quantity: row.quantity,
      manufacturingDate: row.manufacturing_date,
      expireDate: row.expire_date,
      vendor: row.vendor,
      country: row.country,
      storageConditions: row.storage_conditions,
      foodType: row.food_type,
      memo: row.memo,
      created_at: row.created_at,
      updated_at: row.updated_at
    }
  }

  private mapPackingMaterialFromDB(row: any): PackingMaterial {
    return {
      id: row.id,
      testNumber: row.test_number,
      productName: row.product_name,
      materialName: row.material_name,
      receivingQuantity: row.receiving_quantity,
      lotNumber: row.lot_number,
      expireDate: row.expire_date,
      result: row.result === 1,
      category: row.category,
      vendor: row.vendor,
      memo: row.memo,
      created_at: row.created_at,
      updated_at: row.updated_at
    }
  }

  private mapRawMaterialMasterFromDB(row: any): RawMaterialMaster {
    return {
      id: row.id,
      name: row.name,
      shelfLifeDays: row.shelf_life_days,
      netWeight: row.net_weight,
      weightUnit: row.weight_unit,
      vendor: row.vendor,
      country: row.country,
      storageConditions: row.storage_conditions,
      foodType: row.food_type,
      memo: row.memo,
      created_at: row.created_at,
      updated_at: row.updated_at
    }
  }
}
