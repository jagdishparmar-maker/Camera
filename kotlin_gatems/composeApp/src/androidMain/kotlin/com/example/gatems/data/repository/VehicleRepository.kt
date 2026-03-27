package com.example.gatems.data.repository

import com.example.gatems.data.model.Vehicle
import com.example.gatems.data.network.PocketBaseApi
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import javax.inject.Inject
import javax.inject.Singleton

private const val COLLECTION = "vehicles"
private const val EXPAND     = "Checked_In_By,Checked_Out_By"

@Singleton
class VehicleRepository @Inject constructor(private val api: PocketBaseApi) {

    suspend fun getActiveVehicles(): List<Vehicle> =
        api.getFullList<Vehicle>(COLLECTION, sort = "-created", expand = EXPAND)

    suspend fun getVehicleById(id: String): Vehicle =
        api.getOne(COLLECTION, id, expand = EXPAND)

    suspend fun checkOut(
        id: String,
        checkOutDateIso: String,
        remarks: String?,
        checkedOutByUserId: String?,
    ): Vehicle =
        api.update(
            COLLECTION, id,
            buildJsonObject {
                put("status", "CheckedOut")
                put("Check_Out_Date", checkOutDateIso)
                remarks?.takeIf { it.isNotBlank() }?.let { put("Remarks", it) }
                checkedOutByUserId?.takeIf { it.isNotBlank() }?.let { put("Checked_Out_By", it) }
            },
        )

    suspend fun assignDock(
        id: String,
        dockNumber: Int,
        dockInDateTimeIso: String,
    ): Vehicle = api.update(
        COLLECTION, id,
        buildJsonObject {
            put("Assigned_Dock", dockNumber)
            put("status", "DockedIn")
            put("Dock_In_DateTime", dockInDateTimeIso)
            put("Dock_Out_DateTime", null as String?)
        }
    )

    suspend fun dockOut(id: String, dockOutDateTimeIso: String): Vehicle =
        api.update(
            COLLECTION, id,
            buildJsonObject {
                put("status", "DockedOut")
                put("Dock_Out_DateTime", dockOutDateTimeIso)
                // Clear assigned dock
                put("Assigned_Dock", null as String?)
            }
        )

    suspend fun createVehicle(
        vehicleNo: String,
        type: String,
        transport: String,
        customer: String,
        driverName: String?,
        contactNo: String?,
        checkInDateIso: String,
        checkedInById: String?,
        status: String,
        imageLocalPath: String,
        mimeType: String,
    ): Vehicle = api.createWithFile(
        collection = COLLECTION,
        fields = buildMap {
            put("vehicleno", vehicleNo)
            put("Type", type)
            put("Transport", transport)
            put("Customer", customer)
            put("status", status)
            put("Check_In_Date", checkInDateIso)
            driverName?.takeIf { it.isNotBlank() }?.let { put("Driver_Name", it) }
            contactNo?.takeIf { it.isNotBlank() }?.let { put("Contact_No", it) }
            checkedInById?.takeIf { it.isNotBlank() }?.let { put("Checked_In_By", it) }
        },
        fileField = "image",
        fileUri   = imageLocalPath,
        mimeType  = mimeType,
        fileName  = "${vehicleNo.replace(" ", "_")}.jpg",
    )

    suspend fun updateVehicle(
        id: String,
        vehicleNo: String,
        type: String,
        transport: String,
        customer: String,
        driverName: String?,
        contactNo: String?,
        remarks: String?,
        checkInDateIso: String,
        status: String,
        imageLocalPath: String? = null,
        mimeType: String? = null,
    ): Vehicle {
        val fields = buildMap<String, String?> {
            put("vehicleno", vehicleNo)
            put("Type", type)
            put("Transport", transport)
            put("Customer", customer)
            put("status", status)
            put("Check_In_Date", checkInDateIso)
            put("Driver_Name", driverName?.takeIf { it.isNotBlank() })
            put("Contact_No", contactNo?.takeIf { it.isNotBlank() })
            put("Remarks", remarks?.takeIf { it.isNotBlank() })
        }
        return if (imageLocalPath != null) {
            api.updateWithFile(
                COLLECTION, id, fields,
                fileField = "image",
                fileUri   = imageLocalPath,
                mimeType  = mimeType ?: "image/jpeg",
                fileName  = "${vehicleNo.replace(" ", "_")}.jpg",
            )
        } else {
            api.update(COLLECTION, id, buildJsonObject {
                fields.forEach { (k, v) ->
                    if (v != null) put(k, v) else put(k, JsonNull)
                }
            })
        }
    }

    suspend fun delete(id: String) = api.delete(COLLECTION, id)
}
