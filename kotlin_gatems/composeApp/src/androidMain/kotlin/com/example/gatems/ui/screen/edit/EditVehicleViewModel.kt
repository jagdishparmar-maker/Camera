package com.example.gatems.ui.screen.edit

import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.gatems.BuildConfig
import com.example.gatems.data.model.Customer
import com.example.gatems.data.repository.CustomerRepository
import com.example.gatems.data.repository.VehicleRepository
import com.example.gatems.util.parseIso
import com.example.gatems.util.toIso
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Date
import javax.inject.Inject

sealed class EditVehicleLoadState {
    object Loading : EditVehicleLoadState()
    object Success : EditVehicleLoadState()
    data class Error(val message: String) : EditVehicleLoadState()
}

sealed class EditVehicleSaveState {
    object Idle    : EditVehicleSaveState()
    object Saving  : EditVehicleSaveState()
    object Saved   : EditVehicleSaveState()
    data class Error(val message: String) : EditVehicleSaveState()
}

@HiltViewModel
class EditVehicleViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val vehicleRepo: VehicleRepository,
    private val customerRepo: CustomerRepository,
) : ViewModel() {

    private val vehicleId: String = checkNotNull(savedStateHandle["vehicleId"])

    private val _loadState = MutableStateFlow<EditVehicleLoadState>(EditVehicleLoadState.Loading)
    val loadState: StateFlow<EditVehicleLoadState> = _loadState.asStateFlow()

    private val _saveState = MutableStateFlow<EditVehicleSaveState>(EditVehicleSaveState.Idle)
    val saveState: StateFlow<EditVehicleSaveState> = _saveState.asStateFlow()

    // ── Form fields ────────────────────────────────────────────────────────────
    var vehicleNo        by mutableStateOf("")
    var type             by mutableStateOf("Inward")
    var transport        by mutableStateOf("")
    var customer         by mutableStateOf("")
    var driverName       by mutableStateOf("")
    var contactNo        by mutableStateOf("")
    var checkInDate      by mutableStateOf(Date())
    var remarks          by mutableStateOf("")
    var imageUri         by mutableStateOf<Uri?>(null)
    var existingImageUrl by mutableStateOf<String?>(null)

    private val _customers = MutableStateFlow<List<Customer>>(emptyList())
    val customers: StateFlow<List<Customer>> = _customers.asStateFlow()

    init { load() }

    fun load() = viewModelScope.launch {
        _loadState.value = EditVehicleLoadState.Loading
        runCatching {
            coroutineScope {
                val vehicleDeferred   = async { vehicleRepo.getVehicleById(vehicleId) }
                val customersDeferred = async { runCatching { customerRepo.getAll() }.getOrDefault(emptyList()) }
                vehicleDeferred.await() to customersDeferred.await()
            }
        }.onSuccess { (vehicle, customers) ->
            _customers.value  = customers
            vehicleNo         = vehicle.vehicleno
            type              = vehicle.type ?: "Inward"
            transport         = vehicle.transport ?: ""
            customer          = vehicle.customer ?: ""
            driverName        = vehicle.driverName ?: ""
            contactNo         = vehicle.contactNo ?: ""
            checkInDate       = vehicle.checkInDate?.parseIso() ?: Date()
            remarks           = vehicle.remarks ?: ""
            existingImageUrl  = vehicle.imageUrl(BuildConfig.POCKETBASE_URL)
            _loadState.value  = EditVehicleLoadState.Success
        }.onFailure { e ->
            _loadState.value = EditVehicleLoadState.Error(e.message ?: "Failed to load vehicle")
        }
    }

    fun save() = viewModelScope.launch {
        _saveState.value = EditVehicleSaveState.Saving
        runCatching {
            vehicleRepo.updateVehicle(
                id             = vehicleId,
                vehicleNo      = vehicleNo.trim(),
                type           = type,
                transport      = transport.trim(),
                customer       = customer.trim(),
                driverName     = driverName.takeIf { it.isNotBlank() },
                contactNo      = contactNo.takeIf { it.isNotBlank() },
                remarks        = remarks.takeIf { it.isNotBlank() },
                checkInDateIso = checkInDate.toIso(),
                status         = "CheckedIn",
                imageLocalPath = imageUri?.toString(),
                mimeType       = if (imageUri != null) "image/jpeg" else null,
            )
        }.onSuccess {
            _saveState.value = EditVehicleSaveState.Saved
        }.onFailure { e ->
            _saveState.value = EditVehicleSaveState.Error(e.message ?: "Failed to save changes")
        }
    }

    fun clearSaveError() {
        if (_saveState.value is EditVehicleSaveState.Error) _saveState.value = EditVehicleSaveState.Idle
    }
}
