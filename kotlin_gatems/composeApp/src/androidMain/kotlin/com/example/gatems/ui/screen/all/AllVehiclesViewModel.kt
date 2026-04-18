package com.example.gatems.ui.screen.all

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import androidx.paging.cachedIn
import androidx.paging.filter
import com.example.gatems.data.model.Vehicle
import com.example.gatems.data.network.RealtimeAction
import com.example.gatems.data.network.RealtimeClient
import com.example.gatems.data.repository.VehicleRepository
import com.example.gatems.data.session.PendingActionsBus
import com.example.gatems.util.HapticController
import com.example.gatems.util.SnackbarEvent
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class VehicleFilter { ON_SITE, INWARD, OUTWARD, HISTORY }

@OptIn(FlowPreview::class, kotlinx.coroutines.ExperimentalCoroutinesApi::class)
@HiltViewModel
class AllVehiclesViewModel @Inject constructor(
    private val vehicleRepo: VehicleRepository,
    private val realtimeClient: RealtimeClient,
    private val pendingActions: PendingActionsBus,
    private val haptics: HapticController,
) : ViewModel() {

    // ── Input state (filter / search / refresh trigger) ──────────────────────

    private val _searchQuery = MutableStateFlow("")
    private val _filter      = MutableStateFlow(VehicleFilter.ON_SITE)
    private val _snackbar    = MutableStateFlow<SnackbarEvent?>(null)
    private val _pendingDeletes = MutableStateFlow<Set<String>>(emptySet())

    /** Bumped on realtime events and explicit `refresh()` calls to invalidate the Pager. */
    private val _refreshTrigger = MutableStateFlow(0)

    val searchQuery:  StateFlow<String>        = _searchQuery.asStateFlow()
    val filter:       StateFlow<VehicleFilter> = _filter.asStateFlow()
    val snackbarEvent:StateFlow<SnackbarEvent?> = _snackbar.asStateFlow()

    // ── Paged vehicles ───────────────────────────────────────────────────────

    /**
     * Debounced search drives a fresh `Pager` whenever the tab filter, the query, or the
     * refresh trigger changes. `cachedIn` keeps the stream surviving config changes and
     * prevents re-fetching on recomposition. Pending deletes are applied as an in-stream
     * filter so the undo overlay is instant without hitting the network.
     */
    val pagedVehicles: Flow<PagingData<Vehicle>> =
        combine(
            _filter,
            _searchQuery.debounce(300).distinctUntilChanged().onStart { emit("") },
            _refreshTrigger,
        ) { tab, query, _ -> tab to query }
            .flatMapLatest { (tab, query) ->
                Pager(
                    config = PagingConfig(
                        pageSize             = 25,
                        initialLoadSize      = 25,
                        prefetchDistance     = 10,
                        enablePlaceholders   = false,
                    ),
                    pagingSourceFactory = {
                        vehicleRepo.pagingSource(
                            filter = buildFilter(tab),
                            search = buildSearchFilter(query),
                        )
                    },
                ).flow
            }
            .combine(_pendingDeletes) { paging, hiding ->
                if (hiding.isEmpty()) paging else paging.filter { it.id !in hiding }
            }
            .cachedIn(viewModelScope)

    // ── Tab counts (server-side) ─────────────────────────────────────────────

    val countOnSite:  StateFlow<Int> = countFlowFor(VehicleFilter.ON_SITE)
    val countInward:  StateFlow<Int> = countFlowFor(VehicleFilter.INWARD)
    val countOutward: StateFlow<Int> = countFlowFor(VehicleFilter.OUTWARD)
    val countHistory: StateFlow<Int> = countFlowFor(VehicleFilter.HISTORY)

    init {
        subscribeRealtime()
        observePendingDeletes()
    }

    // ── Public actions ───────────────────────────────────────────────────────

    fun refresh() {
        _refreshTrigger.update { it + 1 }
    }

    fun setSearchQuery(q: String) { _searchQuery.value = q }
    fun setFilter(f: VehicleFilter) { _filter.value = f }
    fun clearSnackbar() { _snackbar.value = null }

    /** Called by the screen when `pagingItems.loadState.refresh` transitions to Error. */
    fun onRefreshLoadError(message: String?) {
        _snackbar.value = SnackbarEvent(
            message     = message?.takeIf { it.isNotBlank() } ?: "Could not refresh",
            actionLabel = "Retry",
            actionKind  = SnackbarEvent.ActionKind.RETRY_REFRESH,
        )
    }

    fun commitPendingDelete(vehicleId: String) {
        viewModelScope.launch {
            runCatching { vehicleRepo.delete(vehicleId) }
                .onSuccess { /* realtime DELETE will drop it from the Pager */ }
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

    fun cancelPendingDelete(vehicleId: String) {
        _pendingDeletes.update { it - vehicleId }
        haptics.tick()
        pendingActions.clear()
    }

    // ── Internal plumbing ────────────────────────────────────────────────────

    private fun countFlowFor(tab: VehicleFilter): StateFlow<Int> =
        _refreshTrigger
            .flatMapLatest { flow { emit(runCatching { vehicleRepo.getVehicleCount(buildFilter(tab)) }.getOrDefault(0)) } }
            .stateIn(viewModelScope, SharingStarted.Eagerly, 0)

    private fun observePendingDeletes() = viewModelScope.launch {
        pendingActions.pendingDelete.collect { pending ->
            val v = pending?.vehicle ?: return@collect
            _pendingDeletes.update { it + v.id }
            _snackbar.value = SnackbarEvent(
                message         = "Deleted ${v.vehicleno}",
                actionLabel     = "Undo",
                actionVehicleId = v.id,
                actionKind      = SnackbarEvent.ActionKind.UNDO_DELETE,
            )
        }
    }

    private fun subscribeRealtime() = viewModelScope.launch {
        realtimeClient.subscribe<Vehicle>("vehicles").collect { event ->
            when (event.action) {
                RealtimeAction.CREATE,
                RealtimeAction.UPDATE,
                RealtimeAction.DELETE -> _refreshTrigger.update { it + 1 }
                else -> Unit
            }
        }
    }

    /** Translates a tab into the PocketBase filter DSL. `null` = no filter (history / all). */
    private fun buildFilter(tab: VehicleFilter): String? = when (tab) {
        VehicleFilter.ON_SITE -> "status != \"CheckedOut\""
        VehicleFilter.INWARD  -> "Type = \"Inward\"  && status != \"CheckedOut\""
        VehicleFilter.OUTWARD -> "Type = \"Outward\" && status != \"CheckedOut\""
        VehicleFilter.HISTORY -> null
    }

    /** Translate the raw search box into a `field~"q"` OR expression. Empty → no filter. */
    private fun buildSearchFilter(query: String): String? {
        val q = query.trim()
        if (q.isEmpty()) return null
        val escaped = q.replace("\"", "\\\"")
        return "(vehicleno ~ \"$escaped\" || Customer ~ \"$escaped\" || " +
               "Driver_Name ~ \"$escaped\" || Contact_No ~ \"$escaped\")"
    }
}
