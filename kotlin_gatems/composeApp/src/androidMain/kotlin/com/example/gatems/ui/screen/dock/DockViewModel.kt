package com.example.gatems.ui.screen.dock

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.gatems.data.model.Vehicle
import com.example.gatems.data.model.VehicleStatus
import com.example.gatems.data.network.RealtimeAction
import com.example.gatems.data.network.RealtimeClient
import com.example.gatems.data.repository.VehicleRepository
import com.example.gatems.util.HapticController
import com.example.gatems.util.toIso
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.Date
import javax.inject.Inject

const val DOCK_COUNT = 10

/** One dock bay with the vehicles currently occupying it. */
data class DockSlot(
    val dockNumber: Int,
    val vehicles: List<Vehicle> = emptyList(),
) {
    val isOccupied get() = vehicles.isNotEmpty()
}

@HiltViewModel
class DockViewModel @Inject constructor(
    private val vehicleRepo: VehicleRepository,
    private val realtimeClient: RealtimeClient,
    private val haptics: HapticController,
) : ViewModel() {

    private val _vehicles   = MutableStateFlow<List<Vehicle>>(emptyList())
    private val _isLoading  = MutableStateFlow(true)
    private val _isRefreshing = MutableStateFlow(false)
    private val _error      = MutableStateFlow<String?>(null)
    private val _snackbar   = MutableStateFlow<String?>(null)

    val isLoading:    StateFlow<Boolean>  = _isLoading.asStateFlow()
    val isRefreshing: StateFlow<Boolean>  = _isRefreshing.asStateFlow()
    val error:        StateFlow<String?>  = _error.asStateFlow()
    val snackbar:     StateFlow<String?>  = _snackbar.asStateFlow()

    /** 10 dock slots derived from the vehicle list. */
    val dockSlots: StateFlow<List<DockSlot>> = _vehicles
        .map { list ->
            (1..DOCK_COUNT).map { num ->
                DockSlot(
                    dockNumber = num,
                    vehicles   = list.filter {
                        it.assignedDock == num &&
                        it.effectiveStatus() == VehicleStatus.DockedIn
                    },
                )
            }
        }
        .stateIn(viewModelScope, SharingStarted.Eagerly, (1..DOCK_COUNT).map { DockSlot(it) })

    /** Vehicles on-site but not currently at a dock — available to assign. */
    val yardVehicles: StateFlow<List<Vehicle>> = _vehicles
        .map { list ->
            list.filter {
                val s = it.effectiveStatus()
                s == VehicleStatus.CheckedIn || s == VehicleStatus.DockedOut
            }.sortedBy { it.vehicleno }
        }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    // ── Assign-dock sheet ──────────────────────────────────────────────────────
    var showAssignSheet by mutableStateOf(false)
    var assignTargetDock by mutableIntStateOf(0)
    var selectedVehicle by mutableStateOf<Vehicle?>(null)

    // ── Dock-out confirmation ──────────────────────────────────────────────────
    var showDockOutDialog by mutableStateOf(false)
    var dockOutTarget by mutableStateOf<Vehicle?>(null)

    init {
        load()
        subscribeRealtime()
    }

    fun load() = viewModelScope.launch {
        _isLoading.value = true
        _error.value = null
        runCatching { vehicleRepo.getActiveVehicles() }
            .onSuccess { _vehicles.value = it;  _isLoading.value = false }
            .onFailure { _error.value = it.message; _isLoading.value = false }
    }

    fun refresh() = viewModelScope.launch {
        _isRefreshing.value = true
        runCatching { vehicleRepo.getActiveVehicles() }
            .onSuccess { _vehicles.value = it }
            .onFailure { e ->
                _snackbar.value = e.message?.takeIf { it.isNotBlank() }
                    ?: "Could not refresh docks"
            }
        _isRefreshing.value = false
    }

    fun openAssignSheet(dockNumber: Int) {
        assignTargetDock = dockNumber
        selectedVehicle  = null
        showAssignSheet  = true
    }

    fun confirmAssign() {
        val vehicle = selectedVehicle ?: return
        viewModelScope.launch {
            runCatching {
                vehicleRepo.assignDock(vehicle.id, assignTargetDock, Date().toIso())
            }.onSuccess { updated ->
                _vehicles.update { list -> list.map { if (it.id == updated.id) updated else it } }
                showAssignSheet = false
                selectedVehicle = null
                haptics.success()
                _snackbar.value = "Assigned to Dock $assignTargetDock"
            }.onFailure {
                haptics.error()
                _snackbar.value = "Assign failed: ${it.message}"
                showAssignSheet = false
            }
        }
    }

    fun promptDockOut(vehicle: Vehicle) {
        dockOutTarget    = vehicle
        showDockOutDialog = true
    }

    fun confirmDockOut() {
        val vehicle = dockOutTarget ?: return
        viewModelScope.launch {
            runCatching {
                vehicleRepo.dockOut(vehicle.id, Date().toIso())
            }.onSuccess { updated ->
                _vehicles.update { list -> list.map { if (it.id == updated.id) updated else it } }
                showDockOutDialog = false
                dockOutTarget     = null
                haptics.success()
                _snackbar.value   = "${vehicle.vehicleno} docked out"
            }.onFailure {
                haptics.error()
                _snackbar.value   = "Dock out failed: ${it.message}"
                showDockOutDialog = false
            }
        }
    }

    fun clearSnackbar() { _snackbar.value = null }

    private fun subscribeRealtime() = viewModelScope.launch {
        realtimeClient.subscribe<Vehicle>("vehicles").collect { event ->
            when (event.action) {
                RealtimeAction.CREATE -> _vehicles.update { it + event.record }
                RealtimeAction.UPDATE -> _vehicles.update { list ->
                    list.map { if (it.id == event.record.id) event.record else it }
                }
                RealtimeAction.DELETE -> _vehicles.update { list ->
                    list.filter { it.id != event.record.id }
                }
                else -> Unit
            }
        }
    }
}
