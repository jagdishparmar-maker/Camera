package com.example.gatems.ui.screen.detail

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.gatems.data.model.Vehicle
import com.example.gatems.data.repository.VehicleRepository
import com.example.gatems.data.session.PendingActionsBus
import com.example.gatems.util.HapticController
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Date
import javax.inject.Inject
import com.example.gatems.util.toIso

@HiltViewModel
class VehicleDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val vehicleRepo: VehicleRepository,
    private val pendingActions: PendingActionsBus,
    private val haptics: HapticController,
) : ViewModel() {

    private val vehicleId: String = checkNotNull(savedStateHandle["vehicleId"])

    sealed class UiState {
        object Loading : UiState()
        data class Success(val vehicle: Vehicle) : UiState()
        data class Error(val message: String) : UiState()
    }

    private val _uiState = MutableStateFlow<UiState>(UiState.Loading)
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    var showDeleteDialog by mutableStateOf(false)

    private val _deleted = MutableStateFlow(false)
    val deleted: StateFlow<Boolean> = _deleted.asStateFlow()

    private val _actionError = MutableStateFlow<String?>(null)
    val actionError: StateFlow<String?> = _actionError.asStateFlow()
    private val _isUpdatingDock = MutableStateFlow(false)
    val isUpdatingDock: StateFlow<Boolean> = _isUpdatingDock.asStateFlow()

    private val _availableDocks = MutableStateFlow<List<Int>>(emptyList())
    val availableDocks: StateFlow<List<Int>> = _availableDocks.asStateFlow()
    private val _dockOccupancy = MutableStateFlow<Map<Int, Vehicle>>(emptyMap())
    val dockOccupancy: StateFlow<Map<Int, Vehicle>> = _dockOccupancy.asStateFlow()

    var showDockSheet by mutableStateOf(false)

    init { load() }

    fun load() = viewModelScope.launch {
        _uiState.value = UiState.Loading
        runCatching {
            val vehicle = vehicleRepo.getVehicleById(vehicleId)
            val activeVehicles = vehicleRepo.getActiveVehicles()
            vehicle to activeVehicles
        }
            .onSuccess { (vehicle, activeVehicles) ->
                _availableDocks.value = calculateAvailableDocks(vehicle, activeVehicles)
                _dockOccupancy.value = calculateDockOccupancy(vehicle, activeVehicles)
                _uiState.value = UiState.Success(vehicle)
            }
            .onFailure { _uiState.value = UiState.Error(it.message ?: "Failed to load vehicle") }
    }

    fun openDockSheet() {
        showDockSheet = true
    }

    fun assignOrReassignDock(dockNumber: Int) = viewModelScope.launch {
        val current = (_uiState.value as? UiState.Success)?.vehicle ?: return@launch
        _isUpdatingDock.value = true
        runCatching {
            vehicleRepo.assignDock(current.id, dockNumber, Date().toIso())
        }.onSuccess { updated ->
            _uiState.value = UiState.Success(updated)
            val activeVehicles = vehicleRepo.getActiveVehicles()
            _availableDocks.value = calculateAvailableDocks(updated, activeVehicles)
            _dockOccupancy.value = calculateDockOccupancy(updated, activeVehicles)
            showDockSheet = false
            haptics.success()
        }.onFailure {
            haptics.error()
            _actionError.value = it.message ?: "Failed to assign dock"
        }
        _isUpdatingDock.value = false
    }

    /**
     * Queues a delete onto [PendingActionsBus] instead of hitting the API immediately,
     * then pops the back stack. A list screen observer then shows a snackbar with UNDO;
     * tapping UNDO cancels the delete, otherwise it commits after the snackbar dismisses.
     */
    fun confirmDelete() {
        val vehicle = (_uiState.value as? UiState.Success)?.vehicle ?: return
        showDeleteDialog = false
        pendingActions.requestDelete(vehicle)
        haptics.tick()
        _deleted.value = true
    }

    fun clearError() { _actionError.value = null }

    private fun calculateAvailableDocks(current: Vehicle, activeVehicles: List<Vehicle>): List<Int> {
        val occupied = activeVehicles
            .asSequence()
            .filter { it.id != current.id }
            .mapNotNull { it.assignedDock }
            .toSet()
        return (1..10).filterNot { occupied.contains(it) }
    }

    private fun calculateDockOccupancy(current: Vehicle, activeVehicles: List<Vehicle>): Map<Int, Vehicle> =
        activeVehicles
            .asSequence()
            .filter { it.id != current.id }
            .mapNotNull { vehicle -> vehicle.assignedDock?.takeIf { it in 1..10 }?.let { it to vehicle } }
            .toMap()
}
