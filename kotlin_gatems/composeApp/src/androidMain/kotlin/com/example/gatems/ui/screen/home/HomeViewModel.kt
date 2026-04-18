package com.example.gatems.ui.screen.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.gatems.data.model.Vehicle
import com.example.gatems.data.model.VehicleStatus
import com.example.gatems.data.network.RealtimeAction
import com.example.gatems.data.network.RealtimeClient
import com.example.gatems.data.preferences.AuthPreferences
import com.example.gatems.data.repository.VehicleRepository
import com.example.gatems.data.session.PendingActionsBus
import com.example.gatems.util.HapticController
import com.example.gatems.util.SnackbarEvent
import com.example.gatems.util.toIso
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.Date
import javax.inject.Inject

sealed class HomeUiState {
    object Loading : HomeUiState()
    data class Error(val message: String) : HomeUiState()
    object Success : HomeUiState()
}

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val vehicleRepo: VehicleRepository,
    private val realtimeClient: RealtimeClient,
    private val authPrefs: AuthPreferences,
    private val haptics: HapticController,
    private val pendingActions: PendingActionsBus,
) : ViewModel() {

    private val _uiState     = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    private val _allVehicles = MutableStateFlow<List<Vehicle>>(emptyList())
    private val _searchQuery = MutableStateFlow("")
    private val _isRefreshing= MutableStateFlow(false)
    private val _snackbar    = MutableStateFlow<SnackbarEvent?>(null)
    // Tracks IDs that have been optimistically deleted but not yet committed.
    // Used to hide them from the list while the UNDO snackbar is visible.
    private val _pendingDeletes = MutableStateFlow<Set<String>>(emptySet())

    val uiState: StateFlow<HomeUiState>   = _uiState.asStateFlow()
    val allVehicles: StateFlow<List<Vehicle>> = _allVehicles.asStateFlow()
    val searchQuery: StateFlow<String>    = _searchQuery.asStateFlow()
    val isRefreshing: StateFlow<Boolean>  = _isRefreshing.asStateFlow()
    val snackbarEvent: StateFlow<SnackbarEvent?> = _snackbar.asStateFlow()

    // Base URL for building image URLs in VehicleListCard
    val pbBaseUrl get() = authPrefs  // expose via function below

    /** Active vehicles (not CheckedOut), filtered by search query and pending deletes. */
    val filteredVehicles: StateFlow<List<Vehicle>> =
        combine(_allVehicles, _searchQuery, _pendingDeletes) { vehicles, query, hiding ->
            val active = vehicles.filter {
                it.effectiveStatus() != VehicleStatus.CheckedOut && it.id !in hiding
            }
            if (query.isBlank()) active
            else {
                val q = query.trim().lowercase()
                active.filter { v ->
                    v.vehicleno.lowercase().contains(q) ||
                    v.customer?.lowercase()?.contains(q) == true ||
                    v.driverName?.lowercase()?.contains(q) == true ||
                    v.transport?.lowercase()?.contains(q) == true
                }
            }
        }.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    init {
        loadVehicles()
        subscribeRealtime()
        observePendingDeletes()
    }

    fun loadVehicles(silent: Boolean = false) {
        viewModelScope.launch {
            if (!silent) _uiState.value = HomeUiState.Loading
            else _isRefreshing.value = true
            try {
                _allVehicles.value = vehicleRepo.getActiveVehicles()
                _uiState.value = HomeUiState.Success
            } catch (e: Exception) {
                if (!silent) {
                    _uiState.value = HomeUiState.Error(e.message ?: "Failed to load")
                } else {
                    _snackbar.value = SnackbarEvent(
                        message     = e.message?.takeIf { it.isNotBlank() } ?: "Could not refresh data",
                        actionLabel = "Retry",
                        actionKind  = SnackbarEvent.ActionKind.RETRY_REFRESH,
                    )
                }
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    fun refresh() = loadVehicles(silent = true)

    fun setSearchQuery(q: String) { _searchQuery.value = q }

    fun checkOut(vehicleId: String, date: Date, remarks: String) {
        // Optimistic update: mark the record as CheckedOut locally so it disappears
        // from the active list immediately. Realtime UPDATE will confirm server-side,
        // and any failure rolls back to the pre-checkout snapshot.
        val snapshot = _allVehicles.value
        val isoNow = date.toIso()
        val optimistic = snapshot.map { v ->
            if (v.id == vehicleId) v.copy(
                status        = VehicleStatus.CheckedOut,
                checkOutDate  = isoNow,
                remarks       = remarks.trim().takeIf { it.isNotBlank() } ?: v.remarks,
            ) else v
        }
        _allVehicles.value = optimistic
        haptics.success()
        _snackbar.value = SnackbarEvent("Vehicle checked out.")

        viewModelScope.launch {
            runCatching {
                vehicleRepo.checkOut(
                    id                 = vehicleId,
                    checkOutDateIso    = isoNow,
                    remarks            = remarks.trim().takeIf { it.isNotBlank() },
                    checkedOutByUserId = authPrefs.getUserInfo().id.takeIf { it.isNotBlank() },
                )
            }.onFailure { e ->
                // Rollback — restore the previous snapshot only if the optimistic row is
                // still present (a realtime UPDATE may already have committed a newer state).
                _allVehicles.update { current ->
                    if (current.any { it.id == vehicleId }) snapshot else current
                }
                haptics.error()
                _snackbar.value = SnackbarEvent(
                    message     = e.message?.let { "Check out failed: $it" } ?: "Check out failed",
                    actionLabel = "Retry",
                    actionKind  = SnackbarEvent.ActionKind.RETRY_REFRESH,
                )
            }
        }
    }

    fun clearSnackbar() { _snackbar.value = null }

    fun emitSnackbar(event: SnackbarEvent) { _snackbar.value = event }

    /** Commit a pending delete — called by the screen after the UNDO snackbar dismisses. */
    fun commitPendingDelete(vehicleId: String) {
        viewModelScope.launch {
            runCatching { vehicleRepo.delete(vehicleId) }
                .onSuccess {
                    _allVehicles.update { list -> list.filter { it.id != vehicleId } }
                }
                .onFailure { e ->
                    haptics.error()
                    _snackbar.value = SnackbarEvent(
                        message = e.message?.let { "Delete failed: $it" } ?: "Delete failed",
                    )
                }
                .also {
                    _pendingDeletes.update { it - vehicleId }
                    pendingActions.clear()
                }
        }
    }

    /** Cancel a pending delete (user tapped UNDO). The vehicle reappears in the list. */
    fun cancelPendingDelete(vehicleId: String) {
        _pendingDeletes.update { it - vehicleId }
        haptics.tick()
        pendingActions.clear()
    }

    private fun observePendingDeletes() {
        viewModelScope.launch {
            pendingActions.pendingDelete.collect { pending ->
                val v = pending?.vehicle ?: return@collect
                // Hide this vehicle immediately and surface an UNDO snackbar.
                _pendingDeletes.update { it + v.id }
                _snackbar.value = SnackbarEvent(
                    message         = "Deleted ${v.vehicleno}",
                    actionLabel     = "Undo",
                    actionVehicleId = v.id,
                    actionKind      = SnackbarEvent.ActionKind.UNDO_DELETE,
                )
            }
        }
    }

    private fun subscribeRealtime() {
        viewModelScope.launch {
            realtimeClient.subscribe<Vehicle>("vehicles").collect { event ->
                when (event.action) {
                    RealtimeAction.CREATE -> {
                        emitSnackbar(
                            SnackbarEvent(
                                message         = "New vehicle checked in: ${event.record.vehicleno}",
                                actionLabel     = "View",
                                actionVehicleId = event.record.id,
                                actionKind      = SnackbarEvent.ActionKind.NAVIGATE_DETAIL,
                            )
                        )
                        loadVehicles(silent = true)
                    }
                    RealtimeAction.UPDATE -> {
                        _allVehicles.update { list ->
                            list.map { if (it.id == event.record.id) event.record else it }
                        }
                    }
                    RealtimeAction.DELETE -> {
                        _allVehicles.update { list -> list.filter { it.id != event.record.id } }
                    }
                    else -> {}
                }
            }
        }
    }
}
