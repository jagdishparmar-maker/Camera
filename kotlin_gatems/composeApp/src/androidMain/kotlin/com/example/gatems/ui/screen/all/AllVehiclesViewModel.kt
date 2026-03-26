package com.example.gatems.ui.screen.all

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.gatems.data.model.Vehicle
import com.example.gatems.data.model.VehicleStatus
import com.example.gatems.data.network.RealtimeAction
import com.example.gatems.data.network.RealtimeClient
import com.example.gatems.data.repository.VehicleRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class VehicleFilter { ON_SITE, INWARD, OUTWARD, HISTORY }

@HiltViewModel
class AllVehiclesViewModel @Inject constructor(
    private val vehicleRepo: VehicleRepository,
    private val realtimeClient: RealtimeClient,
) : ViewModel() {

    private val _vehicles    = MutableStateFlow<List<Vehicle>>(emptyList())
    private val _searchQuery = MutableStateFlow("")
    private val _filter      = MutableStateFlow(VehicleFilter.ON_SITE)
    private val _isLoading   = MutableStateFlow(true)
    private val _isRefreshing= MutableStateFlow(false)
    private val _error       = MutableStateFlow<String?>(null)

    val searchQuery:  StateFlow<String>        = _searchQuery.asStateFlow()
    val filter:       StateFlow<VehicleFilter> = _filter.asStateFlow()
    val isLoading:    StateFlow<Boolean>       = _isLoading.asStateFlow()
    val isRefreshing: StateFlow<Boolean>       = _isRefreshing.asStateFlow()
    val error:        StateFlow<String?>       = _error.asStateFlow()

    /** Live filtered + sorted vehicle list based on filter, search and tab. */
    val filteredVehicles: StateFlow<List<Vehicle>> =
        combine(_vehicles, _searchQuery, _filter) { vehicles, query, filter ->
            val q = query.trim().lowercase()
            vehicles.filter { v ->
                val matchesQuery = q.isEmpty() ||
                    v.vehicleno.lowercase().contains(q) ||
                    v.customer?.lowercase()?.contains(q) == true ||
                    v.transport?.lowercase()?.contains(q) == true ||
                    v.driverName?.lowercase()?.contains(q) == true
                val matchesFilter = when (filter) {
                    VehicleFilter.ON_SITE -> v.effectiveStatus() != VehicleStatus.CheckedOut
                    VehicleFilter.INWARD  -> v.type == "Inward" && v.effectiveStatus() != VehicleStatus.CheckedOut
                    VehicleFilter.OUTWARD -> v.type == "Outward" && v.effectiveStatus() != VehicleStatus.CheckedOut
                    VehicleFilter.HISTORY -> true
                }
                matchesQuery && matchesFilter
            }.sortedByDescending { it.checkInDate ?: "" }
        }.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    /** Counts shown in filter tab badges. */
    val countOnSite:  StateFlow<Int> = _vehicles.map { it.count { v -> v.effectiveStatus() != VehicleStatus.CheckedOut } }.stateIn(viewModelScope, SharingStarted.Eagerly, 0)
    val countInward:  StateFlow<Int> = _vehicles.map { it.count { v -> v.type == "Inward"  && v.effectiveStatus() != VehicleStatus.CheckedOut } }.stateIn(viewModelScope, SharingStarted.Eagerly, 0)
    val countOutward: StateFlow<Int> = _vehicles.map { it.count { v -> v.type == "Outward" && v.effectiveStatus() != VehicleStatus.CheckedOut } }.stateIn(viewModelScope, SharingStarted.Eagerly, 0)
    val countHistory: StateFlow<Int> = _vehicles.map { it.size }.stateIn(viewModelScope, SharingStarted.Eagerly, 0)

    init {
        load()
        subscribeRealtime()
    }

    fun load() = viewModelScope.launch {
        _isLoading.value = true
        _error.value     = null
        runCatching { vehicleRepo.getActiveVehicles() }
            .onSuccess { _vehicles.value = it;  _isLoading.value = false }
            .onFailure { _error.value = it.message; _isLoading.value = false }
    }

    fun refresh() = viewModelScope.launch {
        _isRefreshing.value = true
        runCatching { vehicleRepo.getActiveVehicles() }.onSuccess { _vehicles.value = it }
        _isRefreshing.value = false
    }

    fun setSearchQuery(q: String) { _searchQuery.value = q }
    fun setFilter(f: VehicleFilter) { _filter.value = f }

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
