import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'

// 개발 배포 DB 저장경로 분리
const isDev = !app.isPackaged
// DB 파일 경로 설정 (사용자 데이터 디렉토리)
const dbPath = isDev
  ? join(app.getAppPath(), 'inventory.db')       // 개발용
  : join(app.getPath('userData'), 'inventory.db') // 배포용
  
export function initDatabase(): Database.Database {
  const db = new Database(dbPath)
  
  // 원재료 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS raw_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_number TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      receiving_quantity REAL NOT NULL DEFAULT 0,
      net_weight REAL NOT NULL DEFAULT 0,
      weight_unit TEXT NOT NULL CHECK(weight_unit IN ('kg', 'g', 'mg')),
      quantity INTEGER NOT NULL DEFAULT 0,
      manufacturing_date TEXT NOT NULL,
      expire_date TEXT NOT NULL,
      vendor TEXT NOT NULL,
      country TEXT NOT NULL,
      storage_conditions TEXT NOT NULL CHECK(storage_conditions IN ('Room Temperature', 'Freezing Temperature', 'Refrigerating Temperature')),
      food_type TEXT,
      memo TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 부자재 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS packing_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_number TEXT NOT NULL UNIQUE,
      product_name TEXT NOT NULL,
      material_name TEXT NOT NULL,
      receiving_quantity INTEGER NOT NULL DEFAULT 0,
      lot_number TEXT NOT NULL,
      expire_date TEXT NOT NULL,
      result INTEGER NOT NULL DEFAULT 1 CHECK(result IN (0, 1)),
      category TEXT NOT NULL,
      vendor TEXT NOT NULL,
      memo TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 원료 마스터 테이블 (신규 원료 등록용)
  db.exec(`
    CREATE TABLE IF NOT EXISTS raw_material_masters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      shelf_life_days INTEGER NOT NULL,
      net_weight REAL NOT NULL DEFAULT 0,
      weight_unit TEXT NOT NULL CHECK(weight_unit IN ('kg', 'g', 'mg')),
      vendor TEXT NOT NULL,
      country TEXT NOT NULL,
      storage_conditions TEXT NOT NULL CHECK(storage_conditions IN ('Room Temperature', 'Freezing Temperature', 'Refrigerating Temperature')),
      food_type TEXT,
      memo TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // updated_at 자동 업데이트 트리거
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_raw_materials_timestamp 
    AFTER UPDATE ON raw_materials
    BEGIN
      UPDATE raw_materials SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `)

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_packing_materials_timestamp 
    AFTER UPDATE ON packing_materials
    BEGIN
      UPDATE packing_materials SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `)

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_raw_material_masters_timestamp 
    AFTER UPDATE ON raw_material_masters
    BEGIN
      UPDATE raw_material_masters SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `)

  return db
}
