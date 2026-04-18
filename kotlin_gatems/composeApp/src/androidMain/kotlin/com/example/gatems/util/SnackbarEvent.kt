package com.example.gatems.util

/**
 * One-shot event emitted from a ViewModel to show a Snackbar.
 *
 * @param message         Text to display.
 * @param actionLabel     Optional label for the action button.
 * @param actionVehicleId When set, tapping the action navigates to that vehicle's detail screen.
 * @param actionKind      Hint to the UI layer about what the action should do. Keeps the ViewModel
 *                        free of Compose references and callbacks.
 */
data class SnackbarEvent(
    val message: String,
    val actionLabel: String? = null,
    val actionVehicleId: String? = null,
    val actionKind: ActionKind? = null,
) {
    enum class ActionKind { RETRY_LOAD, RETRY_REFRESH, UNDO_DELETE, NAVIGATE_DETAIL }
}
