package com.example.gatems.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Mirrors the Vehicle type in lib/vehicle-types.ts
@Serializable
data class Vehicle(
    val id: String = "",
    val collectionId: String = "",
    val vehicleno: String = "",
    val image: String = "",
    val status: VehicleStatus? = null,
    @SerialName("Check_In_Date")     val checkInDate: String? = null,
    @SerialName("Type")              val type: String? = null,
    @SerialName("Transport")         val transport: String? = null,
    @SerialName("Customer")          val customer: String? = null,
    @SerialName("Driver_Name")       val driverName: String? = null,
    @SerialName("Contact_No")        val contactNo: String? = null,
    @SerialName("Check_Out_Date")    val checkOutDate: String? = null,
    @SerialName("Assigned_Dock")     val assignedDock: Int? = null,
    @SerialName("Dock_In_DateTime")  val dockInDateTime: String? = null,
    @SerialName("Dock_Out_DateTime") val dockOutDateTime: String? = null,
    @SerialName("Remarks")           val remarks: String? = null,
    @SerialName("Checked_In_By")     val checkedInBy: String? = null,
    @SerialName("Checked_Out_By")    val checkedOutBy: String? = null,
    val expand: VehicleExpand? = null,
) {
    /** Returns the effective status, computing it from fields if not explicitly set. */
    fun effectiveStatus(): VehicleStatus = status ?: computeStatus(
        checkOutDate   = checkOutDate,
        dockOutDateTime= dockOutDateTime,
        assignedDock   = assignedDock,
        dockInDateTime = dockInDateTime,
    )

    /** Returns the file URL for this vehicle's image. */
    fun imageUrl(pbUrl: String): String? {
        if (image.isBlank() || collectionId.isBlank() || id.isBlank()) return null
        return "$pbUrl/api/files/$collectionId/$id/$image"
    }
}

@Serializable
data class VehicleExpand(
    @SerialName("Checked_In_By")  val checkedInBy: UserRecord? = null,
    @SerialName("Checked_Out_By") val checkedOutBy: UserRecord? = null,
)

@Serializable
data class UserRecord(
    val id: String = "",
    val name: String? = null,
    val email: String? = null,
) {
    fun displayName(): String = name?.takeIf { it.isNotBlank() }
        ?: email?.takeIf { it.isNotBlank() }
        ?: "—"
}

/** Prefer expanded PocketBase user; avoids showing raw relation id when expand is missing. */
fun Vehicle.auditCheckedInByLabel(): String =
    expand?.checkedInBy?.displayName()?.takeIf { it.isNotBlank() && it != "—" } ?: "—"

fun Vehicle.auditCheckedOutByLabel(): String =
    expand?.checkedOutBy?.displayName()?.takeIf { it.isNotBlank() && it != "—" } ?: "—"
