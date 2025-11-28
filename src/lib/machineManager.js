// // Machine Management Library
// // Handles automatic machine assignment and management for transactions

// import { query, executeTransaction } from './database'

// async function autoCleanupStuckMachines() {
//   try {
//     const stuckMachines = await query(`
//       SELECT ml.id_mesin, ml.nomor_mesin
//       FROM mesin_laundry ml
//       WHERE ml.status_mesin = 'digunakan'
//         AND ml.id_cabang = 1
//         AND NOT EXISTS (
//           SELECT 1 FROM detail_transaksi_layanan dtl 
//           WHERE dtl.id_mesin = ml.id_mesin
//             AND dtl.service_status IN ('planned', 'active', 'queued')
//             AND (dtl.estimasi_selesai IS NULL OR dtl.estimasi_selesai > NOW())
//         )
//     `)
    
//     if (stuckMachines.length > 0) {
//       const machineIds = stuckMachines.map(m => m.id_mesin)
//       await query(`
//         UPDATE mesin_laundry 
//         SET status_mesin = 'tersedia', updated_by_karyawan = NULL, estimasi_selesai = NULL
//         WHERE id_mesin IN (${machineIds.map(() => '?').join(',')})
//       `, machineIds)
      
//       console.log(`🔧 Auto-fixed ${stuckMachines.length} stuck machines`)
//     }
//   } catch (error) {
//     console.error('Auto-cleanup error:', error)
//   }
// }

// /**
//  * Service to Machine Type Mapping
//  */
// const SERVICE_MACHINE_MAPPING = {
//   1: 'cuci',      // Cuci service → cuci machine
//   2: 'pengering', // Kering service → pengering machine  
//   3: 'cuci'       // Bilas service → cuci machine
// }

// /**
//  * Service Duration Mapping (in minutes)
//  */
// const SERVICE_DURATION = {
//   1: 15,  // Cuci - 15 minutes
//   2: 45,  // Kering - 45 minutes
//   3: 7    // Bilas - 7 minutes
// }

// /**
//  * Find available machine for a specific service type
//  * @param {number} cabangId - Branch ID
//  * @param {number} jenisLayananId - Service type ID
//  * @returns {Promise<number|null>} Machine ID or null if no machine available
//  */
// export async function findAvailableMachine(cabangId, jenisLayananId) {
//   try {
//     const machineType = SERVICE_MACHINE_MAPPING[jenisLayananId] || 'cuci'
    
//     console.log(`🔍 Finding ${machineType} machine for service ${jenisLayananId} in branch ${cabangId}`)
    
//     // Debug: First check all machines of this type
//     const allMachines = await query(`
//       SELECT id_mesin, nomor_mesin, status_mesin
//       FROM mesin_laundry 
//       WHERE id_cabang = ? AND jenis_mesin = ?
//       ORDER BY nomor_mesin ASC
//     `, [cabangId, machineType])
    
//     console.log(`📊 All ${machineType} machines in branch ${cabangId}:`, 
//       allMachines.map(m => `${m.nomor_mesin}(${m.status_mesin})`).join(', ')
//     )
    
//     const machines = await query(`
//       SELECT id_mesin, nomor_mesin
//       FROM mesin_laundry 
//       WHERE id_cabang = ? 
//         AND jenis_mesin = ? 
//         AND status_mesin = 'tersedia'
//       ORDER BY nomor_mesin ASC
//       LIMIT 1
//     `, [cabangId, machineType])
    
//     const result = machines.length > 0 ? machines[0].id_mesin : null
//     console.log(`🎯 Found available machine for service ${jenisLayananId}: ${result ? `${machines[0].nomor_mesin} (id=${result})` : 'NONE'} (${machineType})`)
    
//     return result
//   } catch (error) {
//     console.error('Error finding available machine:', error)
//     return null
//   }
// }

// /**
//  * Assign machine to a service and activate it with sequential timing
//  * @param {number} machineId - Machine ID
//  * @param {number} detailLayananId - Service detail ID
//  * @param {number} jenisLayananId - Service type ID
//  * @param {number} karyawanId - Employee ID who created the transaction
//  * @param {Date} scheduledStartTime - When this service should start (for sequential services)
//  * @param {Date} machineFinishTime - When this machine should finish (for machines used by multiple services)
//  * @returns {Promise<boolean>} Success status
//  */
// export async function assignAndActivateMachine(machineId, detailLayananId, jenisLayananId, karyawanId, scheduledStartTime = null, machineFinishTime = null) {
//   try {
//     const durationMinutes = SERVICE_DURATION[jenisLayananId] || 15
//     const startTime = scheduledStartTime || new Date()
    
//     // Use machineFinishTime if provided (for machines used by multiple sequential services)
//     // Otherwise use individual service finish time
//     const estimatedFinish = machineFinishTime || new Date(startTime.getTime() + (durationMinutes * 60 * 1000))
    
//     console.log(`🕰️ Assigning machine ${machineId} for service ${jenisLayananId}:`)
//     console.log(`   Start: ${startTime.toLocaleString()}`)
//     console.log(`   Finish: ${estimatedFinish.toLocaleString()}`)
//     console.log(`   Duration: ${durationMinutes} minutes`)
    
//     // Use database transaction with row locking to prevent race conditions
//     const result = await executeTransaction(async (connection) => {
      
//       // 1. Lock machine row and check availability (SELECT FOR UPDATE)
//       // Accept both 'tersedia' and 'digunakan' status since machine might be pre-reserved
//       const [machineCheck] = await connection.execute(`
//         SELECT id_mesin, status_mesin, nomor_mesin, jenis_mesin
//         FROM mesin_laundry 
//         WHERE id_mesin = ? AND status_mesin IN ('tersedia', 'digunakan')
//         FOR UPDATE
//       `, [machineId])
      
//       // Check if machine is still available after lock
//       if (machineCheck.length === 0) {
//         throw new Error(`Machine ${machineId} is no longer available or already in use`)
//       }
      
//       console.log(`🔒 Machine ${machineId} (${machineCheck[0].nomor_mesin}) locked for assignment - current status: ${machineCheck[0].status_mesin}`)
      
//       // 2. Update machine status to 'digunakan' if not already (atomic)
//       if (machineCheck[0].status_mesin === 'tersedia') {
//         const [machineUpdateResult] = await connection.execute(`
//           UPDATE mesin_laundry 
//           SET status_mesin = 'digunakan',
//               updated_by_karyawan = ?
//           WHERE id_mesin = ?
//         `, [karyawanId, machineId])
        
//         if (machineUpdateResult.affectedRows === 0) {
//           throw new Error(`Failed to update machine ${machineId} status`)
//         }
//         console.log(`✅ Updated machine ${machineId} status to 'digunakan'`)
//       } else {
//         console.log(`ℹ️ Machine ${machineId} already marked as 'digunakan', skipping status update`)
//       }
      
//       // 3. Update service detail with machine assignment (atomic)
//       // Use scheduled start time for sequential services
//       // Set service_status based on timing:
//       // - 'active' if service should start now or already started
//       // - 'planned' if service is scheduled for future
//       const now = new Date()
//       const startTime = scheduledStartTime || now
//       const isImmediateService = startTime <= now
//       const serviceStatus = isImmediateService ? 'active' : 'planned'
      
//       const [assignmentResult] = await connection.execute(`
//         UPDATE detail_transaksi_layanan
//         SET id_mesin = ?,
//             waktu_mulai = ?,
//             estimasi_selesai = ?,
//             service_status = ?
//         WHERE id_detail_layanan = ?
//       `, [machineId, startTime, estimatedFinish, serviceStatus, detailLayananId])
      
//       if (assignmentResult.affectedRows === 0) {
//         throw new Error(`Failed to assign machine ${machineId} to detail layanan ${detailLayananId}`)
//       }
      
//       // 4. Machine activation logged via service status change only
//       // Removed redundant audit log for auto assignments
      
//       return {
//         machineId,
//         detailLayananId,
//         estimatedFinish: estimatedFinish.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z',
//         machineNumber: machineCheck[0].nomor_mesin
//       }
//     })
    
//     console.log(`✅ Machine ${result.machineId} (${result.machineNumber}) successfully assigned to detail layanan ${result.detailLayananId}`)
//     return true
    
//   } catch (error) {
//     console.error('❌ Error assigning and activating machine:', {
//       machineId,
//       detailLayananId,
//       jenisLayananId,
//       error: error.message,
//       stack: error.stack
//     })
//     return false
//   }
// }

// /**
//  * Build sequential service chain with smart timing (preserve existing running services)
//  * @param {Array} services - Array of service objects with id_jenis_layanan
//  * @param {Object} existingAssignments - Current running services with timing
//  * @returns {Array} Sequential chain with timing
//  */
// function buildSequentialChain(services, existingAssignments = null) {
//   const chain = []
  
//   console.log('🕰️ Building sequential chain with existing assignments:', existingAssignments)
//   console.log('📋 Input services order:', services.map(s => {
//     const serviceId = s.id_jenis_layanan || s.id
//     return `${serviceId} (${SERVICE_MACHINE_MAPPING[serviceId]}) qty:${s.quantity || 1}`
//   }).join(' → '))
//   console.log('🗂️ Existing assignments available:', existingAssignments ? 
//     existingAssignments.map(a => `${a.id_jenis_layanan}(machine:${a.id_mesin})`).join(', ') : 
//     'none'
//   )
  
//   // Group services by machine type for proper parallel/sequential timing
//   const machineGroups = {
//     cuci: [],     // Cuci and Bilas services (sequential on same machine)
//     pengering: [] // Kering services (parallel on different machine)
//   }
  
//   // Sort services into machine groups - ALWAYS sort for correct sequential processing
//   // Even for edits, we need Cuci before Bilas for proper machine reuse
//   const sortedServices = [...services].sort((a, b) => {
//     const orderMap = { 1: 1, 3: 2, 2: 3 } // Cuci first, then Bilas, then Kering
//     return (orderMap[a.id_jenis_layanan || a.id] || 999) - (orderMap[b.id_jenis_layanan || b.id] || 999)
//   })
  
//   // Group services by machine type AND expand quantities into individual entries
//   for (const service of sortedServices) {
//     const serviceId = service.id_jenis_layanan || service.id
//     const machineType = SERVICE_MACHINE_MAPPING[serviceId]
//     const quantity = service.quantity || 1
    
//     console.log(`📋 Processing service ${serviceId} with quantity ${quantity}`)
    
//     // Create individual entries for each quantity unit
//     for (let i = 0; i < quantity; i++) {
//       const serviceEntry = {
//         ...service,
//         quantity: 1, // Each individual entry has quantity 1
//         originalQuantity: quantity,
//         quantityIndex: i + 1
//       }
      
//       if (machineType === 'cuci') {
//         machineGroups.cuci.push(serviceEntry)
//       } else if (machineType === 'pengering') {
//         machineGroups.pengering.push(serviceEntry)
//       }
      
//       console.log(`   → Created entry ${i + 1}/${quantity} for service ${serviceId}`)
//     }
//   }
  
//   console.log('🔄 Machine groups after quantity expansion:', {
//     cuci: machineGroups.cuci.map(s => `${s.id_jenis_layanan || s.id}[${s.quantityIndex}/${s.originalQuantity}]`),
//     pengering: machineGroups.pengering.map(s => `${s.id_jenis_layanan || s.id}[${s.quantityIndex}/${s.originalQuantity}]`)
//   })
  
//   // Ensure we're working with WIB timezone for consistency
//   const now = new Date()
//   const wibOffset = 7 * 60 * 60 * 1000 // WIB is UTC+7
//   const currentTimeWIB = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + wibOffset)
  
//   console.log(`🌏 Current time WIB: ${currentTimeWIB.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`)
  
//   // Process machine groups with proper sequential timing
//   const processedServices = []
  
//   // Calculate sequential timing
//   let cuciEndTime = currentTimeWIB
//   let pengeringStartTime = currentTimeWIB
  
//   // Process cuci services - parallel for same service type, sequential for different types
//   let lastCuciEndTime = currentTimeWIB
  
//   // Group cuci services by service type
//   const cuciByType = {}
//   for (const service of machineGroups.cuci) {
//     const serviceId = service.id_jenis_layanan || service.id
//     if (!cuciByType[serviceId]) {
//       cuciByType[serviceId] = []
//     }
//     cuciByType[serviceId].push(service)
//   }
  
//   console.log('🔄 Cuci services grouped by type:', Object.keys(cuciByType).map(type => `${type}: ${cuciByType[type].length} units`))
  
//   // Process each service type sequentially, but services of same type in parallel
//   for (const [serviceId, services] of Object.entries(cuciByType)) {
//     const duration = SERVICE_DURATION[serviceId]
//     const startTime = lastCuciEndTime
//     const endTime = new Date(startTime.getTime() + (duration * 60 * 1000))
    
//     // All services of same type start at same time (parallel)
//     for (const service of services) {
//       const processedService = processServiceWithTiming(
//         service, 
//         startTime, // All services of same type start at same time
//         null, 
//         existingAssignments
//       )
      
//       processedServices.push(processedService)
//     }
    
//     // Update timing for next service type (sequential between different types)
//     lastCuciEndTime = endTime
//   }
  
//   // Pengering starts after ALL cuci services are done
//   pengeringStartTime = lastCuciEndTime
  
//   // Process pengering services - group by service type for parallel timing
//   const pengeringByType = {}
//   for (const service of machineGroups.pengering) {
//     const serviceId = service.id_jenis_layanan || service.id
//     if (!pengeringByType[serviceId]) {
//       pengeringByType[serviceId] = []
//     }
//     pengeringByType[serviceId].push(service)
//   }
  
//   console.log('🔄 Pengering services grouped by type:', Object.keys(pengeringByType).map(type => `${type}: ${pengeringByType[type].length} units`))
  
//   let lastPengeringEndTime = pengeringStartTime
  
//   // Process each pengering service type sequentially, but services of same type in parallel
//   for (const [serviceId, services] of Object.entries(pengeringByType)) {
//     const duration = SERVICE_DURATION[serviceId]
//     const startTime = lastPengeringEndTime
//     const endTime = new Date(startTime.getTime() + (duration * 60 * 1000))
    
//     // All services of same type start at same time (parallel)
//     for (const service of services) {
//       const processedService = processServiceWithTiming(
//         service, 
//         startTime, // All services of same type start at same time
//         null, 
//         existingAssignments
//       )
      
//       processedServices.push(processedService)
//     }
    
//     // Update timing for next service type (sequential between different types)
//     lastPengeringEndTime = endTime
//   }
  
//   // Sort back to original order for consistent processing
//   processedServices.sort((a, b) => {
//     const orderMap = { 1: 1, 3: 2, 2: 3 }
//     return (orderMap[a.serviceId] || 999) - (orderMap[b.serviceId] || 999)
//   })
  
//   return processedServices
// }

// function processServiceWithTiming(service, currentTime, prevService, existingAssignments) {
//     const serviceId = service.id_jenis_layanan || service.id
//     const serviceType = SERVICE_MACHINE_MAPPING[serviceId]
//     const duration = SERVICE_DURATION[serviceId]
//     const quantityIndex = service.quantityIndex || 1
    
//     console.log(`🔄 Processing service ${serviceId} [${quantityIndex}/${service.originalQuantity || 1}]`)
    
//     // Check if THIS specific service instance has an existing assignment with timing
//     // Only mark as existing if this exact service instance exists, not just same type
//     const thisServiceExistingAssignment = existingAssignments ? 
//       existingAssignments.find(existing => 
//         existing.id_jenis_layanan === serviceId && 
//         existing.waktu_mulai && 
//         existing.estimasi_selesai &&
//         existing.id_mesin // Must have machine assignment
//       ) : null
      
//     // Check if ANY existing assignment has this service type with timing (for parallel timing)
//     const existingServiceTypeWithTiming = existingAssignments ? 
//       existingAssignments.find(existing => 
//         existing.id_jenis_layanan === serviceId && 
//         existing.waktu_mulai && 
//         existing.estimasi_selesai
//       ) : null
    
//     // Track how many existing assignments we have for this service type
//     const existingCountForThisType = existingAssignments ? 
//       existingAssignments.filter(existing => 
//         existing.id_jenis_layanan === serviceId && 
//         existing.waktu_mulai && 
//         existing.estimasi_selesai &&
//         existing.id_mesin
//       ).length : 0
    
//     console.log(`🔍 Service ${serviceId}[${quantityIndex}] analysis:`, {
//       thisServiceHasExisting: !!thisServiceExistingAssignment,
//       typeHasExistingTiming: !!existingServiceTypeWithTiming,
//       existingCountForType: existingCountForThisType,
//       quantityIndex
//     })
    
//     // Only preserve existing if this is within the range of existing assignments
//     if (existingServiceTypeWithTiming && quantityIndex <= existingCountForThisType) {
//       // This service instance should preserve existing assignment
//       const startTime = new Date(existingServiceTypeWithTiming.waktu_mulai + '+07:00')
//       const endTime = new Date(existingServiceTypeWithTiming.estimasi_selesai + '+07:00')
      
//       console.log(`🔄 Preserving existing service ${serviceId}[${quantityIndex}/${service.originalQuantity || 1}] (${serviceType}):`, {
//         start: startTime.toLocaleString(),
//         end: endTime.toLocaleString(),
//         existingCount: existingCountForThisType
//       })
      
//       return {
//         serviceId: serviceId,
//         machineType: serviceType,
//         duration: duration,
//         startTime: startTime,
//         endTime: endTime,
//         delayFromPrevious: 0,
//         isExisting: true,
//         existingMachineId: thisServiceExistingAssignment?.id_mesin,
//         quantityIndex: quantityIndex,
//         originalQuantity: service.originalQuantity || 1
//       }
      
//     } else if (existingServiceTypeWithTiming && quantityIndex > existingCountForThisType) {
//       // New service but use parallel timing from existing services
//       const startTime = new Date(existingServiceTypeWithTiming.waktu_mulai + '+07:00')
//       const endTime = new Date(existingServiceTypeWithTiming.estimasi_selesai + '+07:00')
      
//       console.log(`✨ New service with parallel timing ${serviceId}[${quantityIndex}/${service.originalQuantity || 1}] (${serviceType}):`, {
//         start: startTime.toLocaleString(),
//         end: endTime.toLocaleString(),
//         basedOnExisting: existingCountForThisType
//       })
      
//       return {
//         serviceId: serviceId,
//         machineType: serviceType,
//         duration: duration,
//         startTime: startTime,
//         endTime: endTime,
//         delayFromPrevious: 0,
//         isExisting: false, // This is NEW service
//         quantityIndex: quantityIndex,
//         originalQuantity: service.originalQuantity || 1
//       }
      
//     } else {
//       // New service - use provided timing (sequential)
//       console.log(`✨ Processing new service ${serviceId}[${quantityIndex}/${service.originalQuantity || 1}] (${serviceType})`)
      
//       const serviceStartTime = new Date(currentTime)
//       const endTime = new Date(serviceStartTime.getTime() + duration * 60 * 1000)
      
//       console.log(`✨ New service ${serviceId}[${quantityIndex}/${service.originalQuantity || 1}] (${serviceType}):`, {
//         start: serviceStartTime.toLocaleString(),
//         end: endTime.toLocaleString(),
//         duration: duration + ' minutes',
//         machineType: serviceType
//       })
      
//       return {
//         serviceId: serviceId,
//         machineType: serviceType,
//         duration: duration,
//         startTime: serviceStartTime,
//         endTime: endTime,
//         delayFromPrevious: 0,
//         isExisting: false,
//         quantityIndex: quantityIndex,
//         originalQuantity: service.originalQuantity || 1
//       }
//     }
// }

// /**
//  * FIXED: Assign machines for all services in a transaction with proper sequential logic
//  * @param {Array} services - Array of service objects with id_jenis_layanan
//  * @param {number} cabangId - Branch ID
//  * @param {number} karyawanId - Employee ID
//  * @returns {Promise<Object>} Assignment results
//  */
// export async function assignMachinesForTransaction(services, cabangId, karyawanId) {
//   const results = {
//     success: true,
//     assignments: [],
//     errors: [],
//     sequentialChain: []
//   }
  
//   try {
//     console.log('📥 Input services for transaction:', services.map(s => ({ id: s.id_jenis_layanan, name: s.nama_layanan })))
    
//     // SIMPLE SEQUENTIAL LOGIC - No complex chains
//     // Sort services: Cuci → Bilas → Kering
//     const sortedServices = [...services].sort((a, b) => {
//       const orderMap = { 1: 1, 3: 2, 2: 3 } // Cuci first, then Bilas, then Kering
//       return (orderMap[a.id_jenis_layanan] || 999) - (orderMap[b.id_jenis_layanan] || 999)
//     })
    
//     console.log('🔗 Sorted services:', sortedServices.map(s => `${s.id_jenis_layanan}(${s.nama_layanan})`))
    
//     // Group services by type for parallel timing
//     const servicesByType = {}
//     for (const service of sortedServices) {
//       const serviceId = service.id_jenis_layanan
//       if (!servicesByType[serviceId]) {
//         servicesByType[serviceId] = []
//       }
//       servicesByType[serviceId].push(service)
//     }
    
//     console.log('🔄 Services grouped by type:', Object.keys(servicesByType).map(type => `${type}: ${servicesByType[type].length} units`))
    
//     // Calculate timing with parallel services of same type
//     const now = new Date()
//     let cuciEndTime = now
//     let bilasEndTime = now  
//     let cuciMachineId = null
    
//     // Process service types in order: 1 (Cuci) → 3 (Bilas) → 2 (Kering)
//     const serviceOrder = [1, 3, 2]
    
//     for (const serviceId of serviceOrder) {
//       if (!servicesByType[serviceId]) continue
      
//       const servicesOfThisType = servicesByType[serviceId]
//       const serviceType = SERVICE_MACHINE_MAPPING[serviceId]
//       const duration = SERVICE_DURATION[serviceId]
      
//       console.log(`\n🔄 Processing ${servicesOfThisType.length} services of type ${serviceId} (${serviceType})`)
      
//       // Calculate start time based on service type dependencies
//       let startTime
//       if (serviceId === 1) { // Cuci - starts immediately
//         startTime = new Date(now)
//       } else if (serviceId === 3) { // Bilas - starts after cuci ends
//         startTime = new Date(cuciEndTime)
//       } else if (serviceId === 2) { // Kering - starts after bilas ends (or cuci if no bilas)
//         const previousEndTime = servicesByType[3] ? bilasEndTime : cuciEndTime
//         startTime = new Date(previousEndTime)
//       }
      
//       const endTime = new Date(startTime.getTime() + duration * 60 * 1000)
      
//       // Update end times for dependency tracking
//       if (serviceId === 1) cuciEndTime = endTime
//       if (serviceId === 3) bilasEndTime = endTime
      
//       console.log(`⏰ All ${serviceType} services will: Start ${startTime.toLocaleTimeString()} → End ${endTime.toLocaleTimeString()}`)
      
//       // Process each service of this type
//       for (let i = 0; i < servicesOfThisType.length; i++) {
//         const service = servicesOfThisType[i]
//         let machineId = null
//         let isReused = false
        
//         console.log(`  📋 Processing service ${i + 1}/${servicesOfThisType.length} of type ${serviceId}`)
        
//         // Machine assignment logic
//         if (serviceId === 3) { // Bilas - try reuse cuci machine, or find bilas machine
//           if (cuciMachineId && i === 0) { // Only first bilas can reuse cuci machine
//             machineId = cuciMachineId
//             isReused = true
//             console.log(`    🔄 Bilas reusing cuci machine ${machineId}`)
//           } else {
//             // Find dedicated bilas machine for additional bilas or if no cuci
//             console.log(`    🔍 Finding dedicated bilas machine`)
//             machineId = await findAvailableMachine(cabangId, 3)
//             if (machineId) {
//               isReused = false
//               console.log(`    🎯 Found bilas machine ${machineId}`)
//             } else {
//               results.errors.push({
//                 service: serviceId,
//                 error: `No bilas machine available for service ${i + 1}`
//               })
//               continue
//             }
//           }
//         } else {
//           // Find new machine for cuci/kering
//           console.log(`    🔍 Looking for ${serviceType} machine`)
//           machineId = await findAvailableMachine(cabangId, serviceId)
          
//           if (!machineId) {
//             console.log(`    ❌ No ${serviceType} machine found`)
//             results.errors.push({
//               service: serviceId,
//               error: `No available ${serviceType} machine for service ${i + 1}`
//             })
//             continue
//           } else {
//             console.log(`    ✅ Found ${serviceType} machine ${machineId}`)
//           }
          
//           // IMMEDIATELY reserve machine to prevent double assignment
//           await query(`
//             UPDATE mesin_laundry 
//             SET status_mesin = 'digunakan'
//             WHERE id_mesin = ?
//           `, [machineId])
          
//           console.log(`    🔒 Reserved machine ${machineId}`)
          
//           // Track first cuci machine for bilas reuse
//           if (serviceId === 1 && i === 0) {
//             cuciMachineId = machineId
//             console.log(`    📌 First cuci machine ${machineId} will be available for bilas reuse`)
//           }
//         }
        
//         // Store assignment - all services of same type have IDENTICAL timing
//         results.assignments.push({
//           serviceId: serviceId,
//           machineId: machineId,
//           machineType: serviceType,
//           duration: duration,
//           startTime: startTime, // Same start time for all services of this type
//           endTime: endTime,     // Same end time for all services of this type
//           isReused: isReused
//         })
        
//         console.log(`    🕐 Service ${serviceId}[${i + 1}] on machine ${machineId}: ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`)
//       }
      
//       console.log(`✅ Completed processing ${servicesOfThisType.length} services of type ${serviceId}`)
//     }
    
//     // If any service can't get a machine, mark as partial success
//     if (results.errors.length > 0) {
//       results.success = false
//       console.warn('⚠️ Some services could not be assigned machines:', results.errors)
//     }
    
//   } catch (error) {
//     console.error('Error assigning machines for transaction:', error)
    
//     // Rollback any reserved machines on error
//     for (const assignment of results.assignments) {
//       if (assignment.machineId && !assignment.isReused) {
//         try {
//           await query(`
//             UPDATE mesin_laundry 
//             SET status_mesin = 'tersedia'
//             WHERE id_mesin = ?
//           `, [assignment.machineId])
//           console.log(`🔄 Rolled back reservation for machine ${assignment.machineId}`)
//         } catch (rollbackError) {
//           console.error(`Failed to rollback machine ${assignment.machineId}:`, rollbackError)
//         }
//       }
//     }
    
//     results.success = false
//     results.errors.push({ error: error.message })
//   }
  
//   return results
// }

// /**
//  * Complete machine assignments after transaction details are created
//  * @param {Array} assignments - Machine assignments from assignMachinesForTransaction
//  * @param {Array} detailLayananIds - Created detail layanan IDs (in same order as assignments)
//  * @param {number} karyawanId - Employee ID
//  * @returns {Promise<Object>} Completion results
//  */
// export async function completeMachineAssignments(assignments, detailLayananIds, karyawanId) {
//   const results = {
//     success: true,
//     activated: [],
//     errors: []
//   }
  
//   try {
//     // Calculate final machine finish times for machines used by multiple services
//     const machineFinishTimes = {}
    
//     for (const assignment of assignments) {
//       const machineId = assignment.machineId
//       if (!machineFinishTimes[machineId] || assignment.endTime > machineFinishTimes[machineId]) {
//         machineFinishTimes[machineId] = assignment.endTime
//       }
//     }
    
//     console.log('🕰️ Final machine finish times:', 
//       Object.entries(machineFinishTimes).map(([machineId, finishTime]) => 
//         `Machine ${machineId}: ${finishTime.toLocaleString()}`
//       ).join(', ')
//     )
    
//     // Get service details to match assignments with correct detail IDs
//     const serviceDetails = await query(`
//       SELECT id_detail_layanan, id_jenis_layanan 
//       FROM detail_transaksi_layanan 
//       WHERE id_detail_layanan IN (${detailLayananIds.map(() => '?').join(',')})
//       ORDER BY id_detail_layanan ASC
//     `, detailLayananIds)
    
//     // Track used detail IDs to ensure each assignment gets unique record
//     const usedDetailIds = new Set()
    
//     for (const assignment of assignments) {
//       // Find matching detail layanan by service ID (that hasn't been used yet)
//       const matchingDetail = serviceDetails.find(detail => 
//         detail.id_jenis_layanan === assignment.serviceId && 
//         !usedDetailIds.has(detail.id_detail_layanan)
//       )
      
//       if (!matchingDetail) {
//         results.errors.push({
//           assignment,
//           error: `No available detail layanan found for service ${assignment.serviceId}`
//         })
//         continue
//       }
      
//       const detailId = matchingDetail.id_detail_layanan
//       usedDetailIds.add(detailId) // Mark this detail as used
      
//       console.log(`🔗 Assigning machine ${assignment.machineId} to detail ${detailId} (service ${assignment.serviceId})`)
      
//       let success = false
      
//       if (assignment.isReused) {
//         // For reused machines (bilas), just update the detail_layanan record directly
//         // Don't call assignAndActivateMachine as the machine is already in use
//         try {
//           // Set service_status based on timing for reused machines
//           const now = new Date()
//           const startTime = assignment.startTime || now
//           const isImmediateService = startTime <= now
//           const serviceStatus = isImmediateService ? 'active' : 'planned'
          
//           await query(`
//             UPDATE detail_transaksi_layanan
//             SET id_mesin = ?,
//                 waktu_mulai = ?,
//                 estimasi_selesai = ?,
//                 service_status = ?
//             WHERE id_detail_layanan = ?
//           `, [assignment.machineId, assignment.startTime, assignment.endTime, serviceStatus, detailId])
          
//           // CRITICAL: Recalculate machine countdown after bilas assignment
//           await recalculateMachineCountdown(assignment.machineId)
          
//           console.log(`🔄 Reused machine ${assignment.machineId} assigned to detail ${detailId} for bilas service`)
//           console.log(`⏰ Extended cuci machine ${assignment.machineId} countdown to: ${assignment.endTime}`)
//           success = true
//         } catch (error) {
//           console.error('Error assigning reused machine:', error)
//           success = false
//         }
//       } else {
//         // For new machines, use the normal assignment process
//         const machineFinishTime = machineFinishTimes[assignment.machineId]
        
//         success = await assignAndActivateMachine(
//           assignment.machineId,
//           detailId,
//           assignment.serviceId,
//           karyawanId,
//           assignment.startTime, // Pass scheduled start time for sequential services
//           machineFinishTime     // Pass final machine finish time (for machines used by multiple services)
//         )
//       }
      
//       if (success) {
//         results.activated.push({
//           detailId,
//           machineId: assignment.machineId,
//           machineType: assignment.machineType,
//           duration: assignment.duration,
//           startTime: assignment.startTime,
//           endTime: assignment.endTime,
//           isSequential: assignment.startTime !== undefined,
//           isReused: assignment.isReused || false
//         })
//       } else {
//         results.errors.push({
//           assignment,
//           error: 'Failed to activate machine'
//         })
//       }
//     }
    
//     if (results.errors.length > 0) {
//       results.success = false
//     }
    
//   } catch (error) {
//     console.error('Error completing machine assignments:', error)
//     results.success = false
//     results.errors.push({ error: error.message })
//   }
  
//   return results
// }

// /**
//  * Update machine assignments for edited transaction (for sequential services)
//  * @param {number} transactionId - Transaction ID
//  * @param {Array} newServices - New service configuration
//  * @param {number} cabangId - Branch ID
//  * @param {number} karyawanId - Employee ID
//  * @returns {Promise<Object>} Update results
//  */
// export async function updateMachineAssignmentsForEdit(transactionId, newServices, cabangId, karyawanId) {
//   const results = {
//     success: true,
//     released: [],
//     assigned: [],
//     errors: []
//   }
  
//   try {
//     console.log(`🔄 Updating machine assignments for transaction ${transactionId}`)
//     console.log(`📋 New services requested:`, newServices.map(s => ({ 
//       id: s.id_jenis_layanan || s.id, 
//       name: s.nama_layanan, 
//       quantity: s.quantity 
//     })))
    
//     // 1. Get current machine assignments with timing info
//     const currentAssignments = await query(`
//       SELECT 
//         dtl.id_detail_layanan,
//         dtl.id_mesin,
//         dtl.id_jenis_layanan,
//         dtl.waktu_mulai,
//         dtl.estimasi_selesai,
//         ml.nomor_mesin,
//         ml.jenis_mesin
//       FROM detail_transaksi_layanan dtl
//       LEFT JOIN mesin_laundry ml ON dtl.id_mesin = ml.id_mesin
//       WHERE dtl.id_transaksi = ?
//     `, [transactionId])
    
//     console.log(`📋 Current assignments:`, currentAssignments)
    
//     // 2. Smart machine release - only release machines for removed services
//     const newServiceIds = newServices.map(s => s.id_jenis_layanan || s.id)
    
//     console.log(`📋 New service IDs:`, newServiceIds)
//     console.log(`📋 Current service IDs:`, currentAssignments.map(a => a.id_jenis_layanan))
    
//     for (const assignment of currentAssignments) {
//       if (assignment.id_mesin) {
//         const isServiceStillNeeded = newServiceIds.includes(assignment.id_jenis_layanan)
//         const hasRunningCountdown = assignment.waktu_mulai && assignment.estimasi_selesai
        
//         console.log(`🔍 Checking service ${assignment.id_jenis_layanan} on machine ${assignment.nomor_mesin}:`, {
//           isServiceStillNeeded,
//           hasRunningCountdown,
//           waktu_mulai: assignment.waktu_mulai,
//           estimasi_selesai: assignment.estimasi_selesai
//         })
        
//         if (!isServiceStillNeeded) {
//           // Service removed - release machine
//           console.log(`🔓 RELEASING machine ${assignment.nomor_mesin} - service ${assignment.id_jenis_layanan} removed from edit`)
          
//           await query(`
//             UPDATE mesin_laundry 
//             SET status_mesin = 'tersedia',
//                 updated_by_karyawan = NULL,
//                 estimasi_selesai = NULL,
//               WHERE id_mesin = ?
//           `, [assignment.id_mesin])
          
//           // Note: detail_transaksi_layanan record will be DELETEd by PUT endpoint after this
//           // We only need to release the machine here
          
//           results.released.push({
//             machineId: assignment.id_mesin,
//             machineNumber: assignment.nomor_mesin,
//             serviceType: assignment.id_jenis_layanan
//           })
          
//           console.log(`🔓 Released machine ${assignment.nomor_mesin} (${assignment.jenis_mesin}) - service removed`)
//         } else if (hasRunningCountdown) {
//           // Service still needed and has running countdown - DON'T TOUCH
//           console.log(`🔒 Preserving machine ${assignment.nomor_mesin} (${assignment.jenis_mesin}) - has active countdown`)
//         } else {
//           console.log(`🔒 Keeping machine ${assignment.nomor_mesin} (${assignment.jenis_mesin}) - service still needed`)
//         }
//       }
//     }
    
//     // 3. Build new sequential chain with existing assignments context
//     console.log(`🔗 Building sequential chain with:`)
//     console.log(`   newServices:`, newServices.map(s => `${s.id_jenis_layanan || s.id}(${s.nama_layanan})`))
//     console.log(`   currentAssignments:`, currentAssignments.map(a => `${a.id_jenis_layanan}(machine:${a.id_mesin})`))
    
//     const sequentialChain = buildSequentialChain(newServices, currentAssignments)
//     console.log(`🔗 Generated sequential chain:`, sequentialChain.map(c => ({
//       serviceId: c.serviceId,
//       startTime: c.startTime?.toLocaleTimeString(),
//       endTime: c.endTime?.toLocaleTimeString(),
//       isExisting: c.isExisting,
//       machineType: c.machineType
//     })))
    
//     // 4. Get new detail_layanan IDs (they should be created already by PUT endpoint)
//     const newDetailLayanan = await query(`
//       SELECT id_detail_layanan, id_jenis_layanan 
//       FROM detail_transaksi_layanan 
//       WHERE id_transaksi = ? 
//       ORDER BY id_detail_layanan
//     `, [transactionId])
    
//     // 5. Assign machines for new services with sequential timing
//     console.log(`🔗 Processing ${sequentialChain.length} items from sequential chain`)
//     console.log(`📋 Available detail layanan records:`, newDetailLayanan.map(d => `ID:${d.id_detail_layanan} Service:${d.id_jenis_layanan}`))
    
//     // Track which detail layanan records have been used to avoid duplicates
//     const usedDetailLayananIds = new Set()
    
//     for (let i = 0; i < sequentialChain.length; i++) {
//       const chainItem = sequentialChain[i]
//       console.log(`\n🔄 Processing chain item ${i+1}/${sequentialChain.length}: Service ${chainItem.serviceId}`)
//       console.log(`   Chain item details:`, {
//         serviceId: chainItem.serviceId,
//         machineType: chainItem.machineType,
//         isExisting: chainItem.isExisting,
//         quantityIndex: chainItem.quantityIndex,
//         startTime: chainItem.startTime?.toLocaleString(),
//         endTime: chainItem.endTime?.toLocaleString()
//       })
      
//       // Find the corresponding detail_layanan by service ID that hasn't been used yet
//       const availableDetailLayanan = newDetailLayanan.filter(d => 
//         d.id_jenis_layanan === chainItem.serviceId && 
//         !usedDetailLayananIds.has(d.id_detail_layanan)
//       )
      
//       if (availableDetailLayanan.length === 0) {
//         results.errors.push({
//           service: chainItem.serviceId,
//           error: 'No corresponding detail_layanan found or all already used'
//         })
//         continue
//       }
      
//       // Use the first available detail layanan
//       const detailLayanan = availableDetailLayanan[0]
      
//       // Mark this detail layanan as used
//       usedDetailLayananIds.add(detailLayanan.id_detail_layanan)
      
//       let machineId
      
//       if (chainItem.isExisting && chainItem.existingMachineId) {
//         // Service is already running - preserve existing machine assignment
//         machineId = chainItem.existingMachineId
//         console.log(`🔒 Preserving existing running service ${chainItem.serviceId} on machine ${machineId}`)
        
//         // Ensure the database record still has correct machine assignment
//         // (in case it was cleared by UPDATE logic in PUT endpoint)
//         await query(`
//           UPDATE detail_transaksi_layanan
//           SET id_mesin = ?,
//               waktu_mulai = ?,
//               estimasi_selesai = ?
//           WHERE id_detail_layanan = ?
//         `, [machineId, chainItem.startTime, chainItem.endTime, detailLayanan.id_detail_layanan])
        
//         results.assigned.push({
//           machineId: machineId,
//           serviceType: chainItem.serviceId,
//           machineType: chainItem.machineType,
//           startTime: chainItem.startTime,
//           endTime: chainItem.endTime,
//           detailLayananId: detailLayanan.id_detail_layanan,
//           isExisting: true,
//           preserved: true
//         })
        
//       } else if (chainItem.serviceId === 3) { // Bilas service (id=3)
//         // For bilas - MUST reuse existing cuci machine
//         console.log(`🔄 Processing BILAS service - looking for existing cuci machine`)
//         const existingCuciAssignment = currentAssignments.find(a => 
//           a.id_jenis_layanan === 1 && a.id_mesin // Find cuci service with machine
//         )
//         console.log(`🔍 Found existing cuci assignment:`, existingCuciAssignment)
        
//         // First try existing cuci assignment
//         if (existingCuciAssignment && existingCuciAssignment.id_mesin) {
//           machineId = existingCuciAssignment.id_mesin
          
//           console.log(`🔄 Reusing existing cuci machine ${machineId} (${existingCuciAssignment.nomor_mesin}) for bilas service`)
//           console.log(`   Bilas timing: ${chainItem.startTime?.toLocaleString()} → ${chainItem.endTime?.toLocaleString()}`)
//           console.log(`   Current cuci machine countdown: ${existingCuciAssignment.estimasi_selesai}`)
//           console.log(`   Will extend to bilas end time: ${chainItem.endTime?.toLocaleString()}`)
          
//           // For bilas reuse, just update the detail_layanan record directly
//           // Don't call assignAndActivateMachine as it will try to change machine status
//           // Set service_status based on timing for edit workflow
//           const now = new Date()
//           const startTime = chainItem.startTime || now
//           const isImmediateService = startTime <= now
//           const serviceStatus = isImmediateService ? 'active' : 'planned'
          
//           await query(`
//             UPDATE detail_transaksi_layanan
//             SET id_mesin = ?,
//                 waktu_mulai = ?,
//                 estimasi_selesai = ?,
//                 service_status = ?
//             WHERE id_detail_layanan = ?
//           `, [machineId, chainItem.startTime, chainItem.endTime, serviceStatus, detailLayanan.id_detail_layanan])
          
//           // CRITICAL: Recalculate machine countdown after adding bilas
//           console.log(`🕰️ BEFORE countdown recalculation - Machine ${machineId}`)
//           await recalculateMachineCountdown(machineId)
//           console.log(`🕰️ AFTER countdown recalculation - Machine ${machineId} updated`)
          
//           results.assigned.push({
//             machineId: machineId,
//             serviceType: chainItem.serviceId,
//             machineType: chainItem.machineType,
//             startTime: chainItem.startTime,
//             endTime: chainItem.endTime,
//             detailLayananId: detailLayanan.id_detail_layanan,
//             isReused: true,
//             machineNumber: existingCuciAssignment.nomor_mesin
//           })
          
//           console.log(`✅ Bilas assigned to reused machine ${existingCuciAssignment.nomor_mesin}`)
          
//         } else {
//           // No existing cuci - look for newly assigned cuci in this chain
//           console.log(`🔍 No existing cuci machine - looking for newly assigned cuci in results`)
//           const newCuciAssignment = results.assigned.find(a => 
//             a.serviceType === 1 && a.machineId // Find cuci service we just assigned
//           )
          
//           if (newCuciAssignment && newCuciAssignment.machineId) {
//             machineId = newCuciAssignment.machineId
            
//             console.log(`🔄 Reusing newly assigned cuci machine ${machineId} for bilas service`)
//             console.log(`   Bilas timing: ${chainItem.startTime?.toLocaleString()} → ${chainItem.endTime?.toLocaleString()}`)
            
//             // Set service_status based on timing for edit workflow
//             const now = new Date()
//             const startTime = chainItem.startTime || now
//             const isImmediateService = startTime <= now
//             const serviceStatus = isImmediateService ? 'active' : 'planned'
            
//             await query(`
//               UPDATE detail_transaksi_layanan
//               SET id_mesin = ?,
//                   waktu_mulai = ?,
//                   estimasi_selesai = ?,
//                   service_status = ?
//               WHERE id_detail_layanan = ?
//             `, [machineId, chainItem.startTime, chainItem.endTime, serviceStatus, detailLayanan.id_detail_layanan])
            
//             // CRITICAL: Recalculate machine countdown after adding bilas
//             console.log(`🕰️ BEFORE countdown recalculation - Machine ${machineId}`)
//             await recalculateMachineCountdown(machineId)
//             console.log(`🕰️ AFTER countdown recalculation - Machine ${machineId} updated`)
            
//             results.assigned.push({
//               machineId: machineId,
//               serviceType: chainItem.serviceId,
//               machineType: chainItem.machineType,
//               startTime: chainItem.startTime,
//               endTime: chainItem.endTime,
//               detailLayananId: detailLayanan.id_detail_layanan,
//               isReused: true,
//               machineNumber: newCuciAssignment.machineNumber || `M${machineId}`
//             })
            
//             console.log(`✅ Bilas assigned to newly assigned cuci machine`)
//           } else {
//             results.errors.push({
//               service: chainItem.serviceId,
//               error: 'No existing or newly assigned cuci machine found to reuse for bilas'
//             })
//           }
//         }
//       } else {
//         // Find new machine for other services (kering, etc) or new cuci
//         console.log(`🔍 Finding new machine for service ${chainItem.serviceId} (${chainItem.machineType})`)
//         machineId = await findAvailableMachine(cabangId, chainItem.serviceId)
        
//         if (!machineId) {
//           console.log(`❌ No available ${chainItem.machineType} machine found for service ${chainItem.serviceId}`)
//           results.errors.push({
//             service: chainItem.serviceId,
//             error: `No available ${chainItem.machineType} machine`
//           })
//           continue
//         } else {
//           console.log(`✅ Found machine ${machineId} for service ${chainItem.serviceId}`)
//         }
        
//         // IMMEDIATELY reserve machine to prevent double assignment
//         await query(`
//           UPDATE mesin_laundry 
//           SET status_mesin = 'digunakan'
//           WHERE id_mesin = ?
//         `, [machineId])
        
//         // Assign machine with sequential timing
//         const success = await assignAndActivateMachine(
//           machineId,
//           detailLayanan.id_detail_layanan,
//           chainItem.serviceId,
//           karyawanId,
//           chainItem.startTime
//         )
        
//         if (success) {
//           results.assigned.push({
//             machineId: machineId,
//             serviceType: chainItem.serviceId,
//             machineType: chainItem.machineType,
//             startTime: chainItem.startTime,
//             endTime: chainItem.endTime,
//             detailLayananId: detailLayanan.id_detail_layanan
//           })
          
//           console.log(`✅ Assigned machine ${machineId} for service ${chainItem.serviceId} (${chainItem.machineType})`)
//         } else {
//           results.errors.push({
//             service: chainItem.serviceId,
//             error: 'Failed to assign machine'
//           })
//         }
//       }
//     }
    
//     if (results.errors.length > 0) {
//       results.success = false
//       console.warn('⚠️ Some machine assignments failed during edit:', results.errors)
      
//       // CRITICAL: Don't release machines if there are errors in reassignment
//       // This could leave transactions without proper machine assignments
//       console.error('🚨 STOPPING: Errors occurred during machine assignment. Machines not released to prevent data loss.')
//     } else {
//       console.log(`🎯 Machine assignment update completed successfully. Released: ${results.released.length}, Assigned: ${results.assigned.length}`)
//     }
    
//   } catch (error) {
//     console.error('❌ Error updating machine assignments for edit:', error)
//     results.success = false
//     results.errors.push({ error: error.message })
//   }
  
//   return results
// }

// /**
//  * Release machines that have finished their estimated time
//  * @returns {Promise<Object>} Release results
//  */
// export async function autoReleaseMachines() {
//   try {
//     // Find machines that should be released
//     const expiredMachines = await query(`
//       SELECT 
//         dtl.id_detail_layanan,
//         dtl.id_mesin,
//         ml.nomor_mesin,
//         ml.jenis_mesin,
//         dtl.estimasi_selesai
//       FROM detail_transaksi_layanan dtl
//       JOIN mesin_laundry ml ON dtl.id_mesin = ml.id_mesin
//       WHERE dtl.id_mesin IS NOT NULL 
//         AND dtl.estimasi_selesai IS NOT NULL
//         AND dtl.estimasi_selesai <= NOW()
//         AND ml.status_mesin = 'digunakan'
//     `)
    
//     let releasedCount = 0
    
//     for (const machine of expiredMachines) {
//       try {
//         // Release the machine
//         await query(`
//           UPDATE mesin_laundry 
//           SET status_mesin = 'tersedia',
//               updated_by_karyawan = NULL
//           WHERE id_mesin = ?
//         `, [machine.id_mesin])
        
//         // Auto release logged via service status change only
//         // Removed redundant audit log for auto releases
        
//         releasedCount++
        
//       } catch (error) {
//         console.error(`Error releasing machine ${machine.id_mesin}:`, error)
//       }
//     }
    
//     return {
//       success: true,
//       releasedCount,
//       totalChecked: expiredMachines.length
//     }
    
//   } catch (error) {
//     console.error('Error in auto release machines:', error)
//     return {
//       success: false,
//       error: error.message
//     }
//   }
// }

// /**
//  * Auto-activate planned services that should now be active
//  * @param {number} cabangId - Branch ID
//  * @returns {Promise<Object>} Activation results
//  */
// export async function autoActivatePlannedServicesma(cabangId) {
//   try {
    
//     let completedCount = 0
//     let activatedCount = 0
    
//     // 0. First, handle special case: services with NULL estimasi_selesai but wrong status
//     const nullEstimasiServices = await query(`
//       SELECT 
//         dtl.id_detail_layanan,
//         dtl.service_status,
//         dtl.estimasi_selesai,
//         jl.nama_layanan,
//         p.nama_pelanggan
//       FROM detail_transaksi_layanan dtl
//       JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
//       JOIN transaksi t ON dtl.id_transaksi = t.id_transaksi
//       JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
//       WHERE t.id_cabang = ?
//         AND dtl.service_status IN ('active', 'planned')
//         AND dtl.estimasi_selesai IS NULL
//     `, [cabangId])
    
    
//     for (const service of nullEstimasiServices) {
//       try {
//         await query(`
//           UPDATE detail_transaksi_layanan 
//           SET service_status = 'completed'
//           WHERE id_detail_layanan = ?
//         `, [service.id_detail_layanan])
        
//         completedCount++
//       } catch (error) {
//         console.error(`❌ Error fixing NULL estimasi service ${service.id_detail_layanan}:`, error)
//       }
//     }
    
//     // 1. Complete any services that have passed their estimated finish time
//     const expiredServices = await query(`
//       SELECT 
//         dtl.id_detail_layanan,
//         dtl.service_status,
//         dtl.estimasi_selesai,
//         dtl.waktu_mulai,
//         dtl.id_mesin,
//         jl.nama_layanan,
//         p.nama_pelanggan,
//         ml.nomor_mesin,
//         ml.jenis_mesin
//       FROM detail_transaksi_layanan dtl
//       JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
//       JOIN transaksi t ON dtl.id_transaksi = t.id_transaksi
//       JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
//       LEFT JOIN mesin_laundry ml ON dtl.id_mesin = ml.id_mesin
//       WHERE t.id_cabang = ?
//         AND dtl.service_status IN ('active', 'planned')
//         AND dtl.estimasi_selesai IS NOT NULL
//         AND dtl.estimasi_selesai <= NOW()
//     `, [cabangId])
    
    
//     for (const service of expiredServices) {
//       try {
//         // Complete the service
//         await query(`
//           UPDATE detail_transaksi_layanan 
//           SET service_status = 'completed'
//           WHERE id_detail_layanan = ?
//         `, [service.id_detail_layanan])
        
//         // Release machine if assigned and check if no other services are using it
//         if (service.id_mesin) {
          
//           // Check if there are other active services on this machine
//           const otherActiveServices = await query(`
//             SELECT COUNT(*) as count
//             FROM detail_transaksi_layanan dtl
//             JOIN transaksi t ON dtl.id_transaksi = t.id_transaksi  
//             WHERE dtl.id_mesin = ?
//               AND dtl.service_status IN ('active', 'planned')
//               AND dtl.id_detail_layanan != ?
//               AND t.id_cabang = ?
//           `, [service.id_mesin, service.id_detail_layanan, cabangId])
          
//           if (otherActiveServices[0].count === 0) {
//             // No other active services - release the machine
//             await query(`
//               UPDATE mesin_laundry 
//               SET status_mesin = 'tersedia',
//                   updated_by_karyawan = NULL,
//                   estimasi_selesai = NULL,
//                   diupdate_pada = NOW()
//               WHERE id_mesin = ?
//             `, [service.id_mesin])
            
//           }
//         }
        
//         completedCount++
//       } catch (error) {
//         console.error(`❌ Error completing service ${service.id_detail_layanan}:`, error)
//       }
//     }
    
//     // 2. Activate planned services whose start time has arrived
//     const servicesToActivate = await query(`
//       SELECT 
//         dtl.id_detail_layanan,
//         dtl.waktu_mulai,
//         dtl.estimasi_selesai,
//         jl.nama_layanan,
//         p.nama_pelanggan
//       FROM detail_transaksi_layanan dtl
//       JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
//       JOIN transaksi t ON dtl.id_transaksi = t.id_transaksi
//       JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
//       WHERE t.id_cabang = ?
//         AND dtl.service_status = 'planned'
//         AND dtl.waktu_mulai IS NOT NULL
//         AND dtl.waktu_mulai <= NOW()
//         AND dtl.id_mesin IS NOT NULL
//         AND (dtl.estimasi_selesai IS NULL OR dtl.estimasi_selesai > NOW())
//     `, [cabangId])
    
    
//     for (const service of servicesToActivate) {
//       try {
//         await query(`
//           UPDATE detail_transaksi_layanan 
//           SET service_status = 'active'
//           WHERE id_detail_layanan = ?
//         `, [service.id_detail_layanan])
        
//         activatedCount++
//       } catch (error) {
//         console.error(`❌ Error activating service ${service.id_detail_layanan}:`, error)
//       }
//     }
    
    
//     return {
//       success: true,
//       completedCount,
//       activatedCount,
//       totalChecked: expiredServices.length + servicesToActivate.length
//     }
    
//   } catch (error) {
//     console.error('❌ Error in auto activate planned services:', error)
//     return {
//       success: false,
//       error: error.message
//     }
//   }
// }

// /**
//  * Auto-release machines that have expired timers
//  * @param {number} cabangId - Branch ID
//  * @returns {Promise<Object>} Release results
//  */
// export async function autoReleaseExpiredMachines(cabangId) {
//   try {
//     // Find machines that are 'digunakan' but have expired timers
//     // Use same logic as dashboard display to get latest assignment only
//     const expiredMachines = await query(`
//       SELECT 
//         ml.id_mesin,
//         ml.nomor_mesin,
//         ml.jenis_mesin,
//         dtl.estimasi_selesai,
//         dtl.id_detail_layanan
//       FROM mesin_laundry ml
//       JOIN detail_transaksi_layanan dtl ON ml.id_mesin = dtl.id_mesin
//         AND dtl.estimasi_selesai = (
//           SELECT MAX(estimasi_selesai) 
//           FROM detail_transaksi_layanan dtl2 
//           WHERE dtl2.id_mesin = ml.id_mesin 
//             AND dtl2.estimasi_selesai IS NOT NULL
//         )
//       WHERE ml.id_cabang = ?
//         AND ml.status_mesin = 'digunakan'
//         AND dtl.estimasi_selesai IS NOT NULL
//         AND dtl.estimasi_selesai <= NOW()
//     `, [cabangId])

//     let releasedCount = 0
    
//     for (const machine of expiredMachines) {
//       try {
//         // Update machine status to 'tersedia'
//         await query(`
//           UPDATE mesin_laundry 
//           SET status_mesin = 'tersedia',
//               updated_by_karyawan = NULL
//           WHERE id_mesin = ?
//         `, [machine.id_mesin])

//         // Clear the assignment
//         await query(`
//           UPDATE detail_transaksi_layanan 
//           SET estimasi_selesai = NULL
//           WHERE id_mesin = ? AND estimasi_selesai <= NOW()
//         `, [machine.id_mesin])

//         releasedCount++
        
//       } catch (error) {
//         console.error(`Failed to auto-release machine ${machine.nomor_mesin}:`, error)
//       }
//     }

//     return {
//       success: true,
//       releasedCount,
//       totalChecked: expiredMachines.length
//     }
    
//   } catch (error) {
//     console.error('Error in auto-release expired machines:', error)
//     return {
//       success: false,
//       error: error.message
//     }
//   }
// }

// /**
//  * Get machine status with active assignments
//  * @param {number} cabangId - Branch ID
//  * @returns {Promise<Array>} Machine status list
//  */
// export async function getMachineStatusWithAssignments(cabangId) {
//   try {
//     // First, auto-release any expired machines
//     await autoReleaseExpiredMachines(cabangId)
    
//     // Also fix stuck machines automatically
//     await autoCleanupStuckMachines()
    
//     const machines = await query(`
//       SELECT 
//         ml.*,
//         latest_service.id_detail_layanan,
//         latest_service.waktu_mulai,
//         COALESCE(latest_service.estimasi_selesai, ml.estimasi_selesai) as estimasi_selesai,
//         latest_service.nama_layanan,
//         latest_service.nama_pelanggan,
//         latest_service.kode_transaksi,
//         latest_service.service_status,
//         CASE 
//           WHEN latest_service.id_detail_layanan IS NOT NULL THEN 'automatic'
//           WHEN ml.estimasi_selesai IS NOT NULL THEN 'manual'
//           ELSE NULL
//         END as assignment_type
//       FROM mesin_laundry ml
//       LEFT JOIN (
//         SELECT 
//           dtl.id_mesin,
//           dtl.id_detail_layanan,
//           dtl.waktu_mulai,
//           dtl.estimasi_selesai,
//           dtl.service_status,
//           jl.nama_layanan,
//           p.nama_pelanggan,
//           t.kode_transaksi,
//           ROW_NUMBER() OVER (
//             PARTITION BY dtl.id_mesin 
//             ORDER BY dtl.estimasi_selesai DESC, dtl.id_detail_layanan DESC
//           ) as rn
//         FROM detail_transaksi_layanan dtl
//         JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
//         JOIN transaksi t ON dtl.id_transaksi = t.id_transaksi
//         JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
//         WHERE dtl.id_mesin IS NOT NULL 
//           AND (
//             dtl.service_status IN ('planned', 'active', 'queued') OR 
//             dtl.service_status IS NULL
//           )
//           AND (
//             dtl.estimasi_selesai IS NULL OR 
//             dtl.estimasi_selesai > NOW()
//           )
//       ) latest_service ON ml.id_mesin = latest_service.id_mesin AND latest_service.rn = 1
//       WHERE ml.id_cabang = ?
//       ORDER BY ml.jenis_mesin, ml.nomor_mesin
//     `, [cabangId])
    
//     return machines
    
//   } catch (error) {
//     console.error('Error getting machine status with assignments:', error)
//     return []
//   }
// }

// /**
//  * Cancel a specific service (primarily for kering cancellation)
//  * @param {number} detailLayananId - Detail layanan ID to cancel
//  * @param {number} karyawanId - Employee ID who cancels the service
//  * @param {string} reason - Reason for cancellation
//  * @returns {Promise<Object>} Cancellation result
//  */
// export async function cancelService(detailLayananId, karyawanId, reason = 'customer_request') {
//   try {
//     console.log(`🚫 Cancelling service - detail ID: ${detailLayananId}, reason: ${reason}`)
    
//     // 1. Get service info with transaction details
//     const [service] = await query(`
//       SELECT 
//         dtl.*,
//         jl.nama_layanan,
//         jl.id_jenis_layanan,
//         ml.nomor_mesin,
//         ml.jenis_mesin,
//         t.kode_transaksi,
//         t.status_transaksi
//       FROM detail_transaksi_layanan dtl
//       JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan  
//       LEFT JOIN mesin_laundry ml ON dtl.id_mesin = ml.id_mesin
//       JOIN transaksi t ON dtl.id_transaksi = t.id_transaksi
//       WHERE dtl.id_detail_layanan = ?
//     `, [detailLayananId])
    
//     if (!service) {
//       return { success: false, error: 'Service not found' }
//     }
    
//     // 2. Check if service can be cancelled
//     if (service.service_status === 'cancelled') {
//       return { success: false, error: 'Service already cancelled' }
//     }
    
//     if (service.service_status === 'completed') {
//       return { success: false, error: 'Cannot cancel completed service' }
//     }
    
//     if (service.service_status === 'active' && service.id_mesin) {
//       // Check if machine is actually running (safety check)
//       const [machineStatus] = await query(`
//         SELECT status_mesin FROM mesin_laundry WHERE id_mesin = ?
//       `, [service.id_mesin])
      
//       if (machineStatus && machineStatus.status_mesin === 'digunakan') {
//         // Service is actively running - more careful handling needed
//         console.log(`⚠️ Warning: Cancelling active running service on machine ${service.nomor_mesin}`)
//       }
//     }
    
//     console.log(`📋 Found service: ${service.nama_layanan} (${service.service_status}) on machine ${service.nomor_mesin || 'unassigned'}`)
    
//     // 3. Use database transaction for atomic operation
//     const result = await executeTransaction(async (connection) => {
      
//       // Update service status to cancelled
//       await connection.execute(`
//         UPDATE detail_transaksi_layanan 
//         SET service_status = 'cancelled',
//             cancelled_at = NOW(),
//             cancelled_by = ?,
//             cancel_reason = ?,
//             id_mesin = NULL,
//             waktu_mulai = NULL,
//             estimasi_selesai = NULL
//         WHERE id_detail_layanan = ?
//       `, [karyawanId, reason, detailLayananId])

//       // Recalculate machine countdown (may release machine if no more services)
//       if (service.id_mesin) {
//         console.log(`🔄 Recalculating countdown for machine ${service.nomor_mesin} after cancellation`)
        
//         // Need to call outside transaction since recalculateMachineCountdown uses regular query()
//         setTimeout(async () => {
//           try {
//             await recalculateMachineCountdown(service.id_mesin)
//           } catch (error) {
//             console.error('Error in async recalculate:', error)
//           }
//         }, 100)
//       }
      
//       // Get updated transaction total (trigger will handle this, but we want to return it)
//       const [updatedTransaction] = await connection.execute(`
//         SELECT total_keseluruhan FROM transaksi WHERE id_transaksi = ?
//       `, [service.id_transaksi])
      
//       return {
//         detailLayananId,
//         serviceName: service.nama_layanan,
//         releasedMachine: service.nomor_mesin,
//         savedAmount: service.harga_satuan * service.quantity,
//         newTotal: updatedTransaction[0]?.total_keseluruhan || 0,
//         transactionCode: service.kode_transaksi
//       }
//     })
    
//     console.log(`✅ Service cancelled successfully: ${result.serviceName}`)
    
//     return {
//       success: true,
//       message: `${result.serviceName} berhasil dibatalkan`,
//       data: result
//     }
    
//   } catch (error) {
//     console.error('❌ Error cancelling service:', error)
//     return {
//       success: false,
//       error: error.message,
//       details: process.env.NODE_ENV === 'development' ? error.stack : undefined
//     }
//   }
// }

// /**
//  * Add additional service to existing transaction (e.g., bilas after cuci)
//  * @param {number} transactionId - Transaction ID
//  * @param {number} jenisLayananId - Service type ID (3 for bilas)
//  * @param {number} karyawanId - Employee ID
//  * @param {string} reason - Reason for addition
//  * @returns {Promise<Object>} Addition result
//  */
// export async function addServiceToTransaction(transactionId, jenisLayananId, karyawanId, reason = 'customer_request') {
//   try {
//     console.log(`➕ Adding service ${jenisLayananId} to transaction ${transactionId}`)
    
//     // 1. Get service info and pricing
//     const [serviceInfo] = await query(`
//       SELECT * FROM jenis_layanan WHERE id_jenis_layanan = ? AND status_aktif = 'aktif'
//     `, [jenisLayananId])
    
//     if (!serviceInfo) {
//       return { success: false, error: 'Service type not found or inactive' }
//     }
    
//     // 2. Get transaction info
//     const [transaction] = await query(`
//       SELECT * FROM transaksi WHERE id_transaksi = ?
//     `, [transactionId])
    
//     if (!transaction) {
//       return { success: false, error: 'Transaction not found' }
//     }
    
//     // 3. Check if this service type already exists in transaction
//     const [existingService] = await query(`
//       SELECT * FROM detail_transaksi_layanan 
//       WHERE id_transaksi = ? AND id_jenis_layanan = ? AND service_status != 'cancelled'
//     `, [transactionId, jenisLayananId])
    
//     if (existingService) {
//       return { success: false, error: `${serviceInfo.nama_layanan} already exists in this transaction` }
//     }
    
//     // 4. Add new service detail
//     const [insertResult] = await query(`
//       INSERT INTO detail_transaksi_layanan (
//         id_transaksi,
//         id_jenis_layanan,
//         quantity,
//         harga_satuan,
//         subtotal,
//         service_status,
//         catatan
//       ) VALUES (?, ?, 1, ?, ?, 'planned', ?)
//     `, [
//       transactionId,
//       jenisLayananId,
//       serviceInfo.harga,
//       serviceInfo.harga,
//       `Added: ${reason}`
//     ])
    
//     const newDetailId = insertResult.insertId
    
//     // 5. For bilas service, try to assign same cuci machine if available
//     if (jenisLayananId === 3) { // Bilas
//       const cuciMachine = await query(`
//         SELECT ml.id_mesin, ml.nomor_mesin 
//         FROM detail_transaksi_layanan dtl
//         JOIN mesin_laundry ml ON dtl.id_mesin = ml.id_mesin
//         WHERE dtl.id_transaksi = ? 
//           AND dtl.id_jenis_layanan = 1 
//           AND dtl.service_status = 'completed'
//         ORDER BY dtl.id_detail_layanan DESC
//         LIMIT 1
//       `, [transactionId])
      
//       if (cuciMachine.length > 0) {
//         // Try to re-assign cuci machine for bilas
//         const machineId = cuciMachine[0].id_mesin
//         const success = await assignAndActivateMachine(
//           machineId,
//           newDetailId,
//           jenisLayananId,
//           karyawanId
//         )
        
//         if (success) {
//           console.log(`🔄 Bilas assigned to cuci machine ${cuciMachine[0].nomor_mesin}`)
//         }
//       }
//     }
    
//     // 6. Get updated transaction total
//     const [updatedTransaction] = await query(`
//       SELECT total_keseluruhan FROM transaksi WHERE id_transaksi = ?
//     `, [transactionId])
    
//     console.log(`✅ Service added: ${serviceInfo.nama_layanan}`)
    
//     return {
//       success: true,
//       message: `${serviceInfo.nama_layanan} berhasil ditambahkan`,
//       data: {
//         detailLayananId: newDetailId,
//         serviceName: serviceInfo.nama_layanan,
//         servicePrice: serviceInfo.harga,
//         newTotal: updatedTransaction[0]?.total_keseluruhan || 0
//       }
//     }
    
//   } catch (error) {
//     console.error('❌ Error adding service:', error)
//     return {
//       success: false,
//       error: error.message
//     }
//   }
// }

// /**
//  * Recalculate machine countdown based on all services using the machine
//  * @param {number} machineId - Machine ID
//  * @returns {Promise<boolean>} Success status
//  */
// export async function recalculateMachineCountdown(machineId) {
//   try {
//     console.log(`🔄 Recalculating countdown for machine ${machineId}`)
    
//     // Find latest finish time among all services using this machine
//     const [latestService] = await query(`
//       SELECT 
//         MAX(estimasi_selesai) as latest_finish,
//         COUNT(*) as service_count
//       FROM detail_transaksi_layanan 
//       WHERE id_mesin = ? 
//         AND estimasi_selesai IS NOT NULL 
//         AND service_status IN ('planned', 'active')
//     `, [machineId])
    
//     const latestFinish = latestService?.latest_finish
//     const serviceCount = latestService?.service_count || 0
    
//     console.log(`📊 Machine ${machineId}: ${serviceCount} active services, latest finish: ${latestFinish}`)
    
//     if (serviceCount === 0 || !latestFinish) {
//       // No active services - release machine
//       await query(`
//         UPDATE mesin_laundry 
//         SET status_mesin = 'tersedia',
//             estimasi_selesai = NULL,
//             updated_by_karyawan = NULL,
//             diupdate_pada = NOW()
//         WHERE id_mesin = ?
//       `, [machineId])
      
//       console.log(`✅ Machine ${machineId} released - no active services`)
//     } else {
//       // Update machine countdown to latest finish time
//       await query(`
//         UPDATE mesin_laundry 
//         SET estimasi_selesai = ?,
//             diupdate_pada = NOW()
//         WHERE id_mesin = ?
//       `, [latestFinish, machineId])
      
//       console.log(`✅ Machine ${machineId} countdown updated to: ${latestFinish}`)
//     }
    
//     return true
//   } catch (error) {
//     console.error(`❌ Error recalculating countdown for machine ${machineId}:`, error)
//     return false
//   }
// }

// /**
//  * Update service status (for workflow management)
//  * @param {number} detailLayananId - Detail layanan ID
//  * @param {string} newStatus - New status (planned, active, queued, completed, cancelled)
//  * @param {number} karyawanId - Employee ID
//  * @returns {Promise<Object>} Update result
//  */
// export async function updateServiceStatus(detailLayananId, newStatus, karyawanId) {
//   try {
//     const validStatuses = ['planned', 'active', 'queued', 'completed', 'cancelled']
//     if (!validStatuses.includes(newStatus)) {
//       return { success: false, error: 'Invalid service status' }
//     }
    
//     // Get current service info
//     const [service] = await query(`
//       SELECT * FROM detail_transaksi_layanan WHERE id_detail_layanan = ?
//     `, [detailLayananId])
    
//     if (!service) {
//       return { success: false, error: 'Service not found' }
//     }
    
//     if (service.service_status === newStatus) {
//       return { success: false, error: 'Service already in this status' }
//     }
    
//     // Update status
//     await query(`
//       UPDATE detail_transaksi_layanan 
//       SET service_status = ?
//       WHERE id_detail_layanan = ?
//     `, [newStatus, detailLayananId])
    
//     // Log the change (trigger will also log, but this gives us immediate feedback)
//     console.log(`🔄 Service ${detailLayananId} status: ${service.service_status} → ${newStatus}`)
    
//     return {
//       success: true,
//       message: `Service status updated to ${newStatus}`,
//       data: {
//         detailLayananId,
//         oldStatus: service.service_status,
//         newStatus
//       }
//     }
    
//   } catch (error) {
//     console.error('❌ Error updating service status:', error)
//     return {
//       success: false,
//       error: error.message
//     }
//   }
// }

// /**
//  * Get services by transaction with status information
//  * @param {number} transactionId - Transaction ID
//  * @returns {Promise<Array>} Services with status
//  */
// export async function getTransactionServicesWithStatus(transactionId) {
//   try {
//     const services = await query(`
//       SELECT 
//         dtl.*,
//         jl.nama_layanan,
//         jl.durasi_menit,
//         ml.nomor_mesin,
//         ml.jenis_mesin,
//         ml.status_mesin,
//         k.nama_karyawan as cancelled_by_name,
//         CASE 
//           WHEN dtl.service_status = 'active' AND dtl.estimasi_selesai > NOW() 
//           THEN TIMESTAMPDIFF(MINUTE, NOW(), dtl.estimasi_selesai)
//           ELSE 0
//         END as remaining_minutes
//       FROM detail_transaksi_layanan dtl
//       JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
//       LEFT JOIN mesin_laundry ml ON dtl.id_mesin = ml.id_mesin
//       LEFT JOIN karyawan k ON dtl.cancelled_by = k.id_karyawan
//       WHERE dtl.id_transaksi = ?
//       ORDER BY dtl.id_detail_layanan
//     `, [transactionId])
    
//     return services
    
//   } catch (error) {
//     console.error('Error getting transaction services:', error)
//     return []
//   }
// }