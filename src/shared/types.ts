export type WeightUnit = 'kg' | 'g' | 'mg'
export type StorageCondition = 'Room Temperature' | 'Freezing Temperature' | 'Refrigerating Temperature'

export interface RawMaterial {
  id?: number
  testNumber: string // AR + YYMMDD + XX
  name: string
  receivingQuantity: number // 총 입고량
  netWeight: number // 패킹량
  weightUnit: WeightUnit
  quantity: number // 수량
  manufacturingDate: string // ISO date string
  expireDate: string // ISO date string
  vendor: string // 공급업체
  country: string // 원산지
  storageConditions: StorageCondition
  foodType?: string // 식품유형
  memo?: string // 비고
  created_at?: string
  updated_at?: string
}

export interface PackingMaterial {
  id?: number
  testNumber: string // AP + YYMMDD + XX
  productName: string // 제품명
  materialName: string // 자재명
  receivingQuantity: number // 입고량
  lotNumber: string // 제조번호
  expireDate: string // ISO date string
  result: boolean // 적합(true) / 부적합(false)
  category: string // 종류
  vendor: string // 납품처
  memo?: string // 비고
  created_at?: string
  updated_at?: string
}

// 원료 마스터 (신규 원료 등록용)
export interface RawMaterialMaster {
  id?: number
  name: string // 원료명
  shelfLifeDays: number // 소비기한 (일수)
  netWeight: number // 패킹량
  weightUnit: WeightUnit // 단위
  vendor: string // 공급업체
  country: string // 원산지
  storageConditions: StorageCondition // 보관조건
  foodType?: string // 식품유형
  memo?: string // 비고
  created_at?: string
  updated_at?: string
}

