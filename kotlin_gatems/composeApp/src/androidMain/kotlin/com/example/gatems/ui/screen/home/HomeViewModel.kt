package com.example.gatems.ui.screen.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.gatems.data.model.Vehicle
import com.example.gatems.data.model.VehicleStatus
import com.example.gatems.data.network.RealtimeAction
import com.example.gatems.data.network.RealtimeClient
import com.example.gatems.data.preferences.AuthPreferences
import com.example.gatems.data.repository.VehicleRepository
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
) : ViewModel() {

    private val _uiState     = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    private val _allVehicles = MutableStateFlow<List<Vehicle>>(emptyList())
    private val _searchQuery = MutableStateFlow("")
    private val _isRefreshing= MutableStateFlow(false)
    private val _snackbar    = MutableStateFlow<SnackbarEvent?>(null)

    val uiState: StateFlow<HomeUiState>   = _uiState.asStateFlow()
    val allVehicles: StateFlow<List<Vehicle>> = _allVehicles.asStateFlow()
    val searchQuery: StateFlow<String>    = _searchQuery.asStateFlow()
    val isRefreshing: StateFlow<Boolean>  = _isRefreshing.asStateFlow()
    val snackbarEvent: StateFlow<SnackbarEvent?> = _snackbar.asStateFlow()

    // Base URL for building image URLs in VehicleListCard
    val pbBaseUrl get() = authPrefs  // expose via function below

    /** Active vehicles (not CheckedOut), filtered by search query. */
    val filteredVehicles: StateFlow<List<Vehicle>> =
        combine(_allVehicles, _searchQuery) { vehicles, query ->
            val active = vehicles.filter { it.effectiveStatus() != VehicleStatus.CheckedOut }
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
                        e.message?.takeIf { it.isNotBlank() } ?: "Could not refresh data",
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
        viewModelScope.launch {
            try {
                vehicleRepo.checkOut(
                    id                   = vehicleId,
                    checkOutDateIso      = date.toIso(),
                    remarks              = remarks.trim().takeIf { it.isNotBlank() },
                    checkedOutByUserId   = authPrefs.getUserInfo().id.takeIf { it.isNotBlank() },
                )
                _snackbar.value = SnackbarEvent("Vehicle checked out successfully.")
                loadVehicles(silent = true)
            } catch (e: Exception) {
                _snackbar.value = SnackbarEvent("Check out failed: ${e.message}")
            }
        }
    }

    fun clearSnackbar() { _snackbar.value = null }

    fun emitSnackbar(event: SnackbarEvent) { _snackbar.value = event }

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
