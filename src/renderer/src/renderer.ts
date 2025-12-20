import type { RawMaterial, PackingMaterial, RawMaterialMaster } from '../../shared/types'

// 현재 편집 중인 항목 ID
let editingRawMaterialId: number | null = null
let editingPackingMaterialId: number | null = null

// 탭 전환
function initTabs(): void {
  const tabButtons = document.querySelectorAll('.tab-btn')
  const tabContents = document.querySelectorAll('.tab-content')

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab')

      // 모든 탭 버튼과 콘텐츠 비활성화
      tabButtons.forEach((b) => b.classList.remove('active'))
      tabContents.forEach((c) => c.classList.remove('active'))

      // 선택된 탭 활성화
      btn.classList.add('active')
      document.getElementById(`${targetTab}-tab`)?.classList.add('active')

      // 데이터 로드
      if (targetTab === 'raw-material-masters') {
        loadRawMaterialMasters()
      } else if (targetTab === 'raw-materials') {
        loadRawMaterials()
      } else if (targetTab === 'packing-materials') {
        loadPackingMaterials()
      }
    })
  })
}

// 원재료 관련 함수들
async function loadRawMaterials(): Promise<void> {
  try {
    const materials = await window.api.rawMaterials.getAll()
    const tbody = document.getElementById('raw-materials-tbody')
    if (!tbody) return

    if (materials.length === 0) {
      tbody.innerHTML = '<tr><td colspan="13" class="empty-message">등록된 원재료가 없습니다.</td></tr>'
      return
    }

    tbody.innerHTML = materials
      .map(
        (m) => `
      <tr>
        <td>${m.testNumber}</td>
        <td>${m.name}</td>
        <td>${m.receivingQuantity}</td>
        <td>${m.netWeight}</td>
        <td>${m.weightUnit}</td>
        <td>${m.quantity}</td>
        <td>${formatDate(m.manufacturingDate)}</td>
        <td>${formatDate(m.expireDate)}</td>
        <td>${m.vendor}</td>
        <td>${m.country}</td>
        <td>${getStorageConditionLabel(m.storageConditions)}</td>
        <td>${m.foodType || '-'}</td>
        <td class="action-buttons">
          <button class="btn btn-sm btn-edit" data-material-id="${m.id}" data-action="edit">수정</button>
          <button class="btn btn-sm btn-delete" data-material-id="${m.id}" data-action="delete">삭제</button>
        </td>
      </tr>
    `
      )
      .join('')

    // 이벤트 위임으로 수정/삭제 버튼 이벤트 등록
    tbody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt((e.target as HTMLElement).getAttribute('data-material-id') || '0')
        if (id) {
          const material = await window.api.rawMaterials.getById(id)
          if (material) {
            openRawMaterialModal(material)
          }
        }
      })
    })

    tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt((e.target as HTMLElement).getAttribute('data-material-id') || '0')
        if (id) {
          await deleteRawMaterial(id)
        }
      })
    })
  } catch (error) {
    console.error('원재료 로드 실패:', error)
    alert('원재료 목록을 불러오는데 실패했습니다.')
  }
}

async function openRawMaterialModal(material?: RawMaterial): Promise<void> {
  const modal = document.getElementById('raw-material-modal')
  const form = document.getElementById('raw-material-form') as HTMLFormElement
  const title = document.getElementById('raw-material-modal-title')
  const testNumberInput = document.getElementById('raw-test-number') as HTMLInputElement

  if (!modal || !form || !title || !testNumberInput) return

  editingRawMaterialId = material?.id || null
  selectedMasterId = null
  title.textContent = material ? '원재료 수정' : '원재료 입고 등록'

  if (material) {
    // 수정 모드: 폼에 데이터 채우기
    testNumberInput.value = material.testNumber
    testNumberInput.removeAttribute('readonly') // readonly 제거하여 수정 가능하게
    ;(document.getElementById('raw-name') as HTMLInputElement).value = material.name
    ;(document.getElementById('raw-receiving-quantity') as HTMLInputElement).value = material.receivingQuantity.toString()
    ;(document.getElementById('raw-net-weight') as HTMLInputElement).value = material.netWeight.toString()
    ;(document.getElementById('raw-weight-unit') as HTMLSelectElement).value = material.weightUnit
    ;(document.getElementById('raw-quantity') as HTMLInputElement).value = material.quantity.toString()
    ;(document.getElementById('raw-manufacturing-date') as HTMLInputElement).value = material.manufacturingDate.split('T')[0]
    ;(document.getElementById('raw-expire-date') as HTMLInputElement).value = material.expireDate.split('T')[0]
    ;(document.getElementById('raw-vendor') as HTMLInputElement).value = material.vendor
    ;(document.getElementById('raw-country') as HTMLInputElement).value = material.country
    ;(document.getElementById('raw-storage-conditions') as HTMLSelectElement).value = material.storageConditions
    ;(document.getElementById('raw-food-type') as HTMLInputElement).value = material.foodType || ''
    ;(document.getElementById('raw-memo') as HTMLTextAreaElement).value = material.memo || ''
  } else {
    // 등록 모드: 폼 초기화 및 시험번호 자동 생성
    form.reset()
    selectedMasterId = null
    testNumberInput.removeAttribute('readonly') // readonly 제거하여 수정 가능하게
    try {
      const autoTestNumber = await window.api.rawMaterials.generateTestNumber()
      testNumberInput.value = autoTestNumber
    } catch (error) {
      console.error('시험번호 생성 실패:', error)
    }
  }

  // 검색 결과 초기화
  const searchResults = document.getElementById('raw-material-search-results')
  if (searchResults) {
    searchResults.innerHTML = ''
    searchResults.classList.remove('active')
  }

  // 모달이 열릴 때 이벤트 리스너 등록
  setupRawMaterialModalEvents()

  modal.classList.add('active')
}

// 원료 입고 모달 이벤트 설정
let rawMaterialEventHandlers: { [key: string]: () => void } = {}

function setupRawMaterialModalEvents(): void {
  // 기존 이벤트 핸들러 정리
  Object.values(rawMaterialEventHandlers).forEach(cleanup => cleanup())
  rawMaterialEventHandlers = {}

  // 원료명 검색 기능
  const rawNameInput = document.getElementById('raw-name') as HTMLInputElement
  if (rawNameInput) {
    const handleInput = (e: Event) => {
      e.stopPropagation()
      handleRawMaterialNameSearch()
    }
    const handleBlur = () => {
      setTimeout(() => {
        const searchResults = document.getElementById('raw-material-search-results')
        if (searchResults) {
          searchResults.classList.remove('active')
        }
      }, 200)
    }
    
    rawNameInput.addEventListener('input', handleInput)
    rawNameInput.addEventListener('blur', handleBlur)
    
    rawMaterialEventHandlers['name-input'] = () => {
      rawNameInput.removeEventListener('input', handleInput)
      rawNameInput.removeEventListener('blur', handleBlur)
    }
  }

  // 패킹량 × 수량 = 총입고량 자동 계산
  const netWeightInput = document.getElementById('raw-net-weight') as HTMLInputElement
  const quantityInput = document.getElementById('raw-quantity') as HTMLInputElement
  const receivingQuantityInput = document.getElementById('raw-receiving-quantity') as HTMLInputElement

  if (netWeightInput && quantityInput && receivingQuantityInput) {
    const calculateReceivingQuantity = () => {
      const netWeight = parseFloat(netWeightInput.value) || 0
      const quantity = parseFloat(quantityInput.value) || 0
      const receivingQuantity = netWeight * quantity
      if (netWeight > 0 && quantity > 0) {
        receivingQuantityInput.value = receivingQuantity.toFixed(2)
      } else if (netWeight === 0 || quantity === 0) {
        receivingQuantityInput.value = ''
      }
    }

    netWeightInput.addEventListener('input', calculateReceivingQuantity)
    netWeightInput.addEventListener('change', calculateReceivingQuantity)
    quantityInput.addEventListener('input', calculateReceivingQuantity)
    quantityInput.addEventListener('change', calculateReceivingQuantity)

    rawMaterialEventHandlers['net-weight'] = () => {
      netWeightInput.removeEventListener('input', calculateReceivingQuantity)
      netWeightInput.removeEventListener('change', calculateReceivingQuantity)
    }
    rawMaterialEventHandlers['quantity'] = () => {
      quantityInput.removeEventListener('input', calculateReceivingQuantity)
      quantityInput.removeEventListener('change', calculateReceivingQuantity)
    }
  }

  // 제조일 입력 시 소비기한 자동 계산
  const manufacturingDateInput = document.getElementById('raw-manufacturing-date') as HTMLInputElement
  if (manufacturingDateInput) {
    const handleDateChange = async () => {
      if (selectedMasterId && !editingRawMaterialId) {
        const master = await window.api.rawMaterialMasters.getById(selectedMasterId)
        if (master) {
          calculateExpireDateFromMaster(master.shelfLifeDays)
        }
      }
    }
    
    manufacturingDateInput.addEventListener('change', handleDateChange)
    
    rawMaterialEventHandlers['manufacturing-date'] = () => {
      manufacturingDateInput.removeEventListener('change', handleDateChange)
    }
  }
}

async function saveRawMaterial(e: Event): Promise<void> {
  e.preventDefault()
  const form = e.target as HTMLFormElement
  const formData = new FormData(form)

  const testNumber = (formData.get('testNumber') as string).trim()

  // 시험번호 중복 체크
  const exists = await window.api.rawMaterials.checkTestNumberExists(testNumber, editingRawMaterialId || undefined)
  if (exists) {
    alert('이미 존재하는 시험번호입니다. 다른 시험번호를 입력해주세요.')
    return
  }

  const material: Omit<RawMaterial, 'id' | 'created_at' | 'updated_at'> = {
    testNumber,
    name: formData.get('name') as string,
    receivingQuantity: parseFloat(formData.get('receivingQuantity') as string),
    netWeight: parseFloat(formData.get('netWeight') as string),
    weightUnit: formData.get('weightUnit') as 'kg' | 'g' | 'mg',
    quantity: parseInt(formData.get('quantity') as string),
    manufacturingDate: new Date(formData.get('manufacturingDate') as string).toISOString(),
    expireDate: new Date(formData.get('expireDate') as string).toISOString(),
    vendor: formData.get('vendor') as string,
    country: formData.get('country') as string,
    storageConditions: formData.get('storageConditions') as 'Room Temperature' | 'Freezing Temperature' | 'Refrigerating Temperature',
    foodType: (formData.get('foodType') as string) || undefined,
    memo: (formData.get('memo') as string) || undefined
  }

  try {
    if (editingRawMaterialId) {
      await window.api.rawMaterials.update(editingRawMaterialId, material)
    } else {
      await window.api.rawMaterials.create(material)
    }
    closeModal('raw-material-modal')
    loadRawMaterials()
  } catch (error) {
    console.error('저장 실패:', error)
    alert('저장에 실패했습니다.')
  }
}

async function deleteRawMaterial(id: number): Promise<void> {
  if (!confirm('정말 삭제하시겠습니까?')) return

  try {
    await window.api.rawMaterials.delete(id)
    loadRawMaterials()
  } catch (error) {
    console.error('삭제 실패:', error)
    alert('삭제에 실패했습니다.')
  }
}

// 부자재 관련 함수들
async function loadPackingMaterials(): Promise<void> {
  try {
    const materials = await window.api.packingMaterials.getAll()
    const tbody = document.getElementById('packing-materials-tbody')
    if (!tbody) return

    if (materials.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty-message">등록된 부자재가 없습니다.</td></tr>'
      return
    }

    tbody.innerHTML = materials
      .map(
        (m) => `
      <tr>
        <td>${m.testNumber}</td>
        <td>${m.productName}</td>
        <td>${m.materialName}</td>
        <td>${m.receivingQuantity}</td>
        <td>${m.lotNumber}</td>
        <td>${formatDate(m.expireDate)}</td>
        <td><span class="badge ${m.result ? 'badge-success' : 'badge-danger'}">${m.result ? '적합' : '부적합'}</span></td>
        <td>${m.category}</td>
        <td>${m.vendor}</td>
        <td class="action-buttons">
          <button class="btn btn-sm btn-edit" data-packing-id="${m.id}" data-action="edit">수정</button>
          <button class="btn btn-sm btn-delete" data-packing-id="${m.id}" data-action="delete">삭제</button>
        </td>
      </tr>
    `
      )
      .join('')

    // 이벤트 위임으로 수정/삭제 버튼 이벤트 등록
    tbody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt((e.target as HTMLElement).getAttribute('data-packing-id') || '0')
        if (id) {
          const material = await window.api.packingMaterials.getById(id)
          if (material) {
            openPackingMaterialModal(material)
          }
        }
      })
    })

    tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt((e.target as HTMLElement).getAttribute('data-packing-id') || '0')
        if (id) {
          await deletePackingMaterial(id)
        }
      })
    })
  } catch (error) {
    console.error('부자재 로드 실패:', error)
    alert('부자재 목록을 불러오는데 실패했습니다.')
  }
}

async function openPackingMaterialModal(material?: PackingMaterial): Promise<void> {
  const modal = document.getElementById('packing-material-modal')
  const form = document.getElementById('packing-material-form') as HTMLFormElement
  const title = document.getElementById('packing-material-modal-title')
  const testNumberInput = document.getElementById('packing-test-number') as HTMLInputElement

  if (!modal || !form || !title || !testNumberInput) return

  editingPackingMaterialId = material?.id || null
  title.textContent = material ? '부자재 수정' : '부자재 입고 등록'

  if (material) {
    testNumberInput.value = material.testNumber
    testNumberInput.readOnly = false // 수정 모드에서는 수정 가능
    ;(document.getElementById('packing-product-name') as HTMLInputElement).value = material.productName
    ;(document.getElementById('packing-material-name') as HTMLInputElement).value = material.materialName
    ;(document.getElementById('packing-receiving-quantity') as HTMLInputElement).value = material.receivingQuantity.toString()
    ;(document.getElementById('packing-lot-number') as HTMLInputElement).value = material.lotNumber
    ;(document.getElementById('packing-expire-date') as HTMLInputElement).value = material.expireDate.split('T')[0]
    ;(document.getElementById('packing-result') as HTMLSelectElement).value = material.result.toString()
    ;(document.getElementById('packing-category') as HTMLInputElement).value = material.category
    ;(document.getElementById('packing-vendor') as HTMLInputElement).value = material.vendor
    ;(document.getElementById('packing-memo') as HTMLTextAreaElement).value = material.memo || ''
  } else {
    form.reset()
    testNumberInput.readOnly = false // 자동 생성된 번호는 수정 가능
    try {
      const autoTestNumber = await window.api.packingMaterials.generateTestNumber()
      testNumberInput.value = autoTestNumber
    } catch (error) {
      console.error('시험번호 생성 실패:', error)
    }
  }

  modal.classList.add('active')
}

async function savePackingMaterial(e: Event): Promise<void> {
  e.preventDefault()
  const form = e.target as HTMLFormElement
  const formData = new FormData(form)

  const testNumber = (formData.get('testNumber') as string).trim()

  // 시험번호 중복 체크
  const exists = await window.api.packingMaterials.checkTestNumberExists(testNumber, editingPackingMaterialId || undefined)
  if (exists) {
    alert('이미 존재하는 시험번호입니다. 다른 시험번호를 입력해주세요.')
    return
  }

  const material: Omit<PackingMaterial, 'id' | 'created_at' | 'updated_at'> = {
    testNumber,
    productName: formData.get('productName') as string,
    materialName: formData.get('materialName') as string,
    receivingQuantity: parseInt(formData.get('receivingQuantity') as string),
    lotNumber: formData.get('lotNumber') as string,
    expireDate: new Date(formData.get('expireDate') as string).toISOString(),
    result: formData.get('result') === 'true',
    category: formData.get('category') as string,
    vendor: formData.get('vendor') as string,
    memo: (formData.get('memo') as string) || undefined
  }

  try {
    if (editingPackingMaterialId) {
      await window.api.packingMaterials.update(editingPackingMaterialId, material)
    } else {
      await window.api.packingMaterials.create(material)
    }
    closeModal('packing-material-modal')
    loadPackingMaterials()
  } catch (error) {
    console.error('저장 실패:', error)
    alert('저장에 실패했습니다.')
  }
}

async function deletePackingMaterial(id: number): Promise<void> {
  if (!confirm('정말 삭제하시겠습니까?')) return

  try {
    await window.api.packingMaterials.delete(id)
    loadPackingMaterials()
  } catch (error) {
    console.error('삭제 실패:', error)
    alert('삭제에 실패했습니다.')
  }
}

// 유틸리티 함수들
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR')
}

function getStorageConditionLabel(condition: string): string {
  const labels: Record<string, string> = {
    'Room Temperature': '실온',
    'Freezing Temperature': '냉동',
    'Refrigerating Temperature': '냉장'
  }
  return labels[condition] || condition
}

function closeModal(modalId: string): void {
  const modal = document.getElementById(modalId)
  if (modal) {
    modal.classList.remove('active')
  }
  editingRawMaterialId = null
  editingPackingMaterialId = null
  editingRawMaterialMasterId = null
  
  // 원료 입고 모달 이벤트 핸들러 정리
  if (modalId === 'raw-material-modal') {
    Object.values(rawMaterialEventHandlers).forEach(cleanup => cleanup())
    rawMaterialEventHandlers = {}
  }
}

// 전역 함수로 등록 (onclick에서 사용하기 위해)
;(window as any).editRawMaterial = async (id: number) => {
  const material = await window.api.rawMaterials.getById(id)
  if (material) {
    openRawMaterialModal(material)
  }
}

;(window as any).deleteRawMaterial = deleteRawMaterial
;(window as any).editPackingMaterial = async (id: number) => {
  const material = await window.api.packingMaterials.getById(id)
  if (material) {
    openPackingMaterialModal(material)
  }
}
;(window as any).deletePackingMaterial = deletePackingMaterial

// 원료명 검색 및 자동완성
let searchTimeout: NodeJS.Timeout | null = null
let selectedMasterId: number | null = null

async function handleRawMaterialNameSearch(): Promise<void> {
  const nameInput = document.getElementById('raw-name') as HTMLInputElement
  const searchResults = document.getElementById('raw-material-search-results')
  if (!nameInput || !searchResults) return

  const query = nameInput.value.trim()

  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  if (!query || editingRawMaterialId) {
    searchResults.innerHTML = ''
    searchResults.classList.remove('active')
    selectedMasterId = null
    return
  }

  searchTimeout = setTimeout(async () => {
    try {
      const masters = await window.api.rawMaterialMasters.search(query)
      if (masters.length === 0) {
        searchResults.innerHTML = ''
        searchResults.classList.remove('active')
        return
      }

      searchResults.innerHTML = masters
        .map(
          (master) => `
        <div class="search-result-item" data-id="${master.id}" data-name="${master.name}">
          <div class="search-result-name">${master.name}</div>
          <div class="search-result-info">${master.vendor} | ${master.country}</div>
        </div>
      `
        )
        .join('')

      searchResults.classList.add('active')

      // 검색 결과 클릭 이벤트
      searchResults.querySelectorAll('.search-result-item').forEach((item) => {
        item.addEventListener('click', () => {
          const id = parseInt(item.getAttribute('data-id') || '0')
          const name = item.getAttribute('data-name') || ''
          selectRawMaterialMaster(id, name)
        })
      })
    } catch (error) {
      console.error('원료 검색 실패:', error)
    }
  }, 300)
}

async function selectRawMaterialMaster(masterId: number, name: string): Promise<void> {
  const nameInput = document.getElementById('raw-name') as HTMLInputElement
  const searchResults = document.getElementById('raw-material-search-results')
  if (!nameInput || !searchResults) return

  nameInput.value = name
  selectedMasterId = masterId
  searchResults.innerHTML = ''
  searchResults.classList.remove('active')

  try {
    const master = await window.api.rawMaterialMasters.getById(masterId)
    if (!master) return

    // 총 입고량, 수량을 제외한 정보 자동 입력
    const netWeightInput = document.getElementById('raw-net-weight') as HTMLInputElement
    const weightUnitSelect = document.getElementById('raw-weight-unit') as HTMLSelectElement
    const vendorInput = document.getElementById('raw-vendor') as HTMLInputElement
    const countryInput = document.getElementById('raw-country') as HTMLInputElement
    const storageConditionsSelect = document.getElementById('raw-storage-conditions') as HTMLSelectElement
    const foodTypeInput = document.getElementById('raw-food-type') as HTMLInputElement

    netWeightInput.value = master.netWeight.toString()
    weightUnitSelect.value = master.weightUnit
    vendorInput.value = master.vendor
    countryInput.value = master.country
    storageConditionsSelect.value = master.storageConditions
    if (master.foodType) foodTypeInput.value = master.foodType

    // 제조일이 입력되어 있으면 소비기한 자동 계산
    const manufacturingDateInput = document.getElementById('raw-manufacturing-date') as HTMLInputElement
    if (manufacturingDateInput.value) {
      calculateExpireDateFromMaster(master.shelfLifeDays)
    }
  } catch (error) {
    console.error('원료 마스터 정보 로드 실패:', error)
  }
}

function calculateExpireDateFromMaster(shelfLifeDays: number): void {
  const manufacturingDateInput = document.getElementById('raw-manufacturing-date') as HTMLInputElement
  const expireDateInput = document.getElementById('raw-expire-date') as HTMLInputElement

  if (!manufacturingDateInput.value || !expireDateInput) return

  const mfgDate = new Date(manufacturingDateInput.value)
  const expireDate = new Date(mfgDate)
  expireDate.setDate(expireDate.getDate() + shelfLifeDays)
  expireDateInput.value = expireDate.toISOString().split('T')[0]
}

// 신규 원료 마스터 관련 함수들
let editingRawMaterialMasterId: number | null = null

async function loadRawMaterialMasters(): Promise<void> {
  try {
    const masters = await window.api.rawMaterialMasters.getAll()
    const tbody = document.getElementById('raw-material-masters-tbody')
    if (!tbody) return

    if (masters.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-message">등록된 원료가 없습니다.</td></tr>'
      return
    }

    tbody.innerHTML = masters
      .map(
        (m) => {
          const shelfLifeYears = m.shelfLifeDays / 365
          const shelfLifeText = shelfLifeYears % 1 === 0 
            ? `${shelfLifeYears}년` 
            : `${shelfLifeYears}년`
          
          return `
        <tr>
          <td>${m.name}</td>
          <td>${shelfLifeText}</td>
          <td>${m.netWeight}</td>
          <td>${m.weightUnit}</td>
          <td>${m.vendor}</td>
          <td>${m.country}</td>
          <td>${getStorageConditionLabel(m.storageConditions)}</td>
          <td>${m.foodType || '-'}</td>
          <td class="action-buttons">
            <button class="btn btn-sm btn-edit" data-master-id="${m.id}" data-action="edit">수정</button>
            <button class="btn btn-sm btn-delete" data-master-id="${m.id}" data-action="delete">삭제</button>
          </td>
        </tr>
      `
        }
      )
      .join('')

    // 이벤트 위임으로 수정/삭제 버튼 이벤트 등록
    tbody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt((e.target as HTMLElement).getAttribute('data-master-id') || '0')
        if (id) {
          const master = await window.api.rawMaterialMasters.getById(id)
          if (master) {
            openRawMaterialMasterModal(master)
          }
        }
      })
    })

    tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt((e.target as HTMLElement).getAttribute('data-master-id') || '0')
        if (id) {
          await deleteRawMaterialMaster(id)
        }
      })
    })
  } catch (error) {
    console.error('원료 마스터 로드 실패:', error)
    alert('원료 목록을 불러오는데 실패했습니다.')
  }
}

async function deleteRawMaterialMaster(id: number): Promise<void> {
  if (!confirm('정말 삭제하시겠습니까?')) return

  try {
    await window.api.rawMaterialMasters.delete(id)
    loadRawMaterialMasters()
  } catch (error) {
    console.error('삭제 실패:', error)
    alert('삭제에 실패했습니다.')
  }
}

// 신규 원료 등록/수정 모달
function openRawMaterialMasterModal(master?: RawMaterialMaster): void {
  const modal = document.getElementById('raw-material-master-modal')
  const form = document.getElementById('raw-material-master-form') as HTMLFormElement
  const title = document.getElementById('raw-material-master-modal-title')

  if (!modal || !form || !title) return

  editingRawMaterialMasterId = master?.id || null
  title.textContent = master ? '원료 수정' : '원료 등록'

  if (master) {
    // 수정 모드: 폼에 데이터 채우기
    ;(document.getElementById('master-name') as HTMLInputElement).value = master.name
    ;(document.getElementById('master-shelf-life-days') as HTMLSelectElement).value = master.shelfLifeDays.toString()
    ;(document.getElementById('master-net-weight') as HTMLInputElement).value = master.netWeight.toString()
    ;(document.getElementById('master-weight-unit') as HTMLSelectElement).value = master.weightUnit
    ;(document.getElementById('master-vendor') as HTMLInputElement).value = master.vendor
    ;(document.getElementById('master-country') as HTMLInputElement).value = master.country
    ;(document.getElementById('master-storage-conditions') as HTMLSelectElement).value = master.storageConditions
    ;(document.getElementById('master-food-type') as HTMLInputElement).value = master.foodType || ''
    ;(document.getElementById('master-memo') as HTMLTextAreaElement).value = master.memo || ''
  } else {
    // 등록 모드: 폼 초기화
    form.reset()
  }

  modal.classList.add('active')
}

async function saveRawMaterialMaster(e: Event): Promise<void> {
  e.preventDefault()
  const form = e.target as HTMLFormElement
  const formData = new FormData(form)

  const master: Omit<RawMaterialMaster, 'id' | 'created_at' | 'updated_at'> = {
    name: formData.get('name') as string,
    shelfLifeDays: parseFloat(formData.get('shelfLifeDays') as string),
    netWeight: parseFloat(formData.get('netWeight') as string),
    weightUnit: formData.get('weightUnit') as 'kg' | 'g' | 'mg',
    vendor: formData.get('vendor') as string,
    country: formData.get('country') as string,
    storageConditions: formData.get('storageConditions') as 'Room Temperature' | 'Freezing Temperature' | 'Refrigerating Temperature',
    foodType: (formData.get('foodType') as string) || undefined,
    memo: (formData.get('memo') as string) || undefined
  }

  try {
    if (editingRawMaterialMasterId) {
      await window.api.rawMaterialMasters.update(editingRawMaterialMasterId, master)
    } else {
      await window.api.rawMaterialMasters.create(master)
    }
    closeModal('raw-material-master-modal')
    loadRawMaterialMasters()
  } catch (error) {
    console.error('저장 실패:', error)
    alert('저장에 실패했습니다. 이미 존재하는 원료명일 수 있습니다.')
  }
}

// 초기화
function init(): void {
  // 탭 초기화
  initTabs()

  // 원재료 버튼 이벤트
  document.getElementById('add-raw-material-btn')?.addEventListener('click', () => {
    openRawMaterialModal()
  })
  document.getElementById('raw-material-form')?.addEventListener('submit', saveRawMaterial)

  // 원료명 검색 기능은 모달이 열릴 때 등록

  // 신규 원료 등록 버튼
  document.getElementById('add-raw-material-master-btn')?.addEventListener('click', () => {
    openRawMaterialMasterModal()
  })
  document.getElementById('raw-material-master-form')?.addEventListener('submit', saveRawMaterialMaster)

  // 부자재 버튼 이벤트
  document.getElementById('add-packing-material-btn')?.addEventListener('click', () => {
    openPackingMaterialModal()
  })
  document.getElementById('packing-material-form')?.addEventListener('submit', savePackingMaterial)

  // 모달 닫기 이벤트
  document.querySelectorAll('.modal-close, .modal-cancel').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const modal = (e.target as HTMLElement).closest('.modal')
      if (modal) {
        closeModal(modal.id)
      }
    })
  })

  // 모달 배경 클릭 시 닫기
  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal.id)
      }
    })
  })

  // 초기 데이터 로드 (첫 번째 탭인 원료 데이터 관리)
  loadRawMaterialMasters()
}

window.addEventListener('DOMContentLoaded', init)
