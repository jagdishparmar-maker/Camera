package com.example.gatems.util

/**
 * One-shot event emitted from a ViewModel to show a Snackbar.
 * [actionLabel] is the optional action button label.
 * [actionVehicleId] is used when the action navigates to a vehicle detail screen.
 */
data class SnackbarEvent(
    val message: String,
    val actionLabel: String? = null,
    val actionVehicleId: String? = null,
)
