package com.example.gatems.data.session

import com.example.gatems.data.model.Vehicle
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Cross-screen one-shot hub for user actions that need to be carried past a
 * navigation event. Currently used for the "Vehicle deleted — UNDO" flow:
 *
 *  1. [VehicleDetailViewModel.confirmDelete] calls [requestDelete] instead of
 *     hitting the API immediately, then pops back to the list screen.
 *  2. A list screen observing [pendingDelete] removes the vehicle optimistically
 *     and shows a snackbar with an UNDO action.
 *  3. Tapping UNDO calls [cancelDelete] — the API call never happens.
 *  4. Otherwise (snackbar dismissed / timed out) the list screen calls
 *     [commitDelete], which fires the repository delete.
 *
 * Only one pending delete is tracked at a time; the bus auto-commits any
 * previous pending delete when a new one arrives (via the consumer).
 */
@Singleton
class PendingActionsBus @Inject constructor() {

    data class PendingDelete(val vehicle: Vehicle)

    private val _pendingDelete = MutableStateFlow<PendingDelete?>(null)
    val pendingDelete: StateFlow<PendingDelete?> = _pendingDelete.asStateFlow()

    /** Queue a delete — the list screen handles optimistic removal + commit/cancel. */
    fun requestDelete(vehicle: Vehicle) {
        _pendingDelete.value = PendingDelete(vehicle)
    }

    /** Consumer calls this after handling the pending delete (commit or cancel). */
    fun clear() { _pendingDelete.value = null }
}
