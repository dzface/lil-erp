import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initDatabase } from './database/schema'
import { InventoryDB } from './database/models'
import type { RawMaterial, PackingMaterial, RawMaterialMaster } from '../shared/types'

// DB 인스턴스
let inventoryDB: InventoryDB | null = null

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    // Set icon for Windows and Linux (dev mode and packaged). macOS uses .icns in the bundle.
    ...(process.platform === 'linux' || process.platform === 'win32' ? { icon } : {}),
    // Set a default window title (can be overridden by renderer)
    title: app.name || 'lil-erp',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // DB 초기화
  const db = initDatabase()
  inventoryDB = new InventoryDB(db)

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC 핸들러 설정
  setupIpcHandlers()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

function setupIpcHandlers(): void {
  if (!inventoryDB) return

  // 원재료 IPC 핸들러
  ipcMain.handle('raw-materials:getAll', () => {
    return inventoryDB!.getAllRawMaterials()
  })

  ipcMain.handle('raw-materials:getById', (_, id: number) => {
    return inventoryDB!.getRawMaterialById(id)
  })

  ipcMain.handle('raw-materials:create', (_, material: Omit<RawMaterial, 'id' | 'created_at' | 'updated_at'>) => {
    return inventoryDB!.createRawMaterial(material)
  })

  ipcMain.handle('raw-materials:update', (_, id: number, material: Partial<Omit<RawMaterial, 'id' | 'created_at' | 'updated_at'>>) => {
    return inventoryDB!.updateRawMaterial(id, material)
  })

  ipcMain.handle('raw-materials:delete', (_, id: number) => {
    return inventoryDB!.deleteRawMaterial(id)
  })

  ipcMain.handle('raw-materials:generateTestNumber', () => {
    return inventoryDB!.generateRawMaterialTestNumber()
  })

  ipcMain.handle('raw-materials:checkTestNumberExists', (_, testNumber: string, excludeId?: number) => {
    return inventoryDB!.checkRawMaterialTestNumberExists(testNumber, excludeId)
  })

  ipcMain.handle('raw-materials:findLatestByName', (_, name: string) => {
    return inventoryDB!.findLatestRawMaterialByName(name)
  })

  // 부자재 IPC 핸들러
  ipcMain.handle('packing-materials:getAll', () => {
    return inventoryDB!.getAllPackingMaterials()
  })

  ipcMain.handle('packing-materials:getById', (_, id: number) => {
    return inventoryDB!.getPackingMaterialById(id)
  })

  ipcMain.handle('packing-materials:create', (_, material: Omit<PackingMaterial, 'id' | 'created_at' | 'updated_at'>) => {
    return inventoryDB!.createPackingMaterial(material)
  })

  ipcMain.handle('packing-materials:update', (_, id: number, material: Partial<Omit<PackingMaterial, 'id' | 'created_at' | 'updated_at'>>) => {
    return inventoryDB!.updatePackingMaterial(id, material)
  })

  ipcMain.handle('packing-materials:delete', (_, id: number) => {
    return inventoryDB!.deletePackingMaterial(id)
  })

  ipcMain.handle('packing-materials:generateTestNumber', () => {
    return inventoryDB!.generatePackingMaterialTestNumber()
  })

  ipcMain.handle('packing-materials:checkTestNumberExists', (_, testNumber: string, excludeId?: number) => {
    return inventoryDB!.checkPackingMaterialTestNumberExists(testNumber, excludeId)
  })

  // 원료 마스터 IPC 핸들러
  ipcMain.handle('raw-material-masters:getAll', () => {
    return inventoryDB!.getAllRawMaterialMasters()
  })

  ipcMain.handle('raw-material-masters:getById', (_, id: number) => {
    return inventoryDB!.getRawMaterialMasterById(id)
  })

  ipcMain.handle('raw-material-masters:getByName', (_, name: string) => {
    return inventoryDB!.getRawMaterialMasterByName(name)
  })

  ipcMain.handle('raw-material-masters:search', (_, query: string) => {
    return inventoryDB!.searchRawMaterialMasters(query)
  })

  ipcMain.handle('raw-material-masters:create', (_, master: Omit<RawMaterialMaster, 'id' | 'created_at' | 'updated_at'>) => {
    return inventoryDB!.createRawMaterialMaster(master)
  })

  ipcMain.handle('raw-material-masters:update', (_, id: number, master: Partial<Omit<RawMaterialMaster, 'id' | 'created_at' | 'updated_at'>>) => {
    return inventoryDB!.updateRawMaterialMaster(id, master)
  })

  ipcMain.handle('raw-material-masters:delete', (_, id: number) => {
    return inventoryDB!.deleteRawMaterialMaster(id)
  })

  ipcMain.handle('raw-material-masters:convertToRawMaterial', (_, masterId: number, manufacturingDate: string, receivingQuantity: number, quantity: number) => {
    const master = inventoryDB!.getRawMaterialMasterById(masterId)
    if (!master) return null
    return inventoryDB!.convertMasterToRawMaterial(master, manufacturingDate, receivingQuantity, quantity)
  })
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
