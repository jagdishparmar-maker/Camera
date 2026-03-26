package com.example.gatems.data.model

import androidx.compose.ui.graphics.Color
import com.example.gatems.ui.theme.StatusCheckedIn
import com.example.gatems.ui.theme.StatusCheckedOut
import com.example.gatems.ui.theme.StatusDockedIn
import com.example.gatems.ui.theme.StatusDockedOut
import com.example.gatems.ui.theme.StatusTextCheckedIn
import com.example.gatems.ui.theme.StatusTextCheckedOut
import com.example.gatems.ui.theme.StatusTextDockedIn
import com.example.gatems.ui.theme.StatusTextDockedOut
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class VehicleStatus {
    @SerialName("CheckedIn")  CheckedIn,
    @SerialName("CheckedOut") CheckedOut,
    @SerialName("DockedIn")   DockedIn,
    @SerialName("DockedOut")  DockedOut;

    fun humanLabel(): String = when (this) {
        CheckedIn  -> "Checked In"
        CheckedOut -> "Checked Out"
        DockedIn   -> "At Dock"
        DockedOut  -> "Left Dock"
    }

    fun chipBg(): Color = when (this) {
        CheckedIn  -> StatusCheckedIn
        CheckedOut -> StatusCheckedOut
        DockedIn   -> StatusDockedIn
        DockedOut  -> StatusDockedOut
    }

    fun chipText(): Color = when (this) {
        CheckedIn  -> StatusTextCheckedIn
        CheckedOut -> StatusTextCheckedOut
        DockedIn   -> StatusTextDockedIn
        DockedOut  -> StatusTextDockedOut
    }
}

// Mirrors computeStatus() in lib/vehicle-types.ts
fun computeStatus(
    checkOutDate: String?,
    dockOutDateTime: String?,
    assignedDock: Int?,
    dockInDateTime: String?,
): VehicleStatus = when {
    checkOutDate != null                               -> VehicleStatus.CheckedOut
    dockOutDateTime != null                            -> VehicleStatus.DockedOut
    assignedDock != null || dockInDateTime != null     -> VehicleStatus.DockedIn
    else                                               -> VehicleStatus.CheckedIn
}
