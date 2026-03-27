package com.example.gatems.ui.screen.add

import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.gatems.data.model.Customer
import com.example.gatems.data.preferences.AuthPreferences
import com.example.gatems.data.repository.CustomerRepository
import com.example.gatems.data.repository.VehicleRepository
import com.example.gatems.util.toIso
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Date
import javax.inject.Inject

sealed class AddVehicleState {
    object Idle    : AddVehicleState()
    object Loading : AddVehicleState()
    data class Success(val vehicleId: String) : AddVehicleState()
    data class Error(val message: String)     : AddVehicleState()
}

@HiltViewModel
class AddVehicleViewModel @Inject constructor(
    private val vehicleRepo: VehicleRepository,
    private val customerRepo: CustomerRepository,
    private val authPrefs: AuthPreferences,
) : ViewModel() {

    // ── Wizard step (0 = Photo, 1 = Details) ──────────────────────────────────
    var currentStep by mutableIntStateOf(0)
        private set

    // ── Step 0 field ───────────────────────────────────────────────────────────
    var imageUri    by mutableStateOf<Uri?>(null)

    // ── Step 1 fields ──────────────────────────────────────────────────────────
    var vehicleNo   by mutableStateOf("")
    var type        by mutableStateOf("Inward")   // "Inward" | "Outward"
    var transport   by mutableStateOf("")
    var customer    by mutableStateOf("")

    // ── Step 2 fields ──────────────────────────────────────────────────────────
    var driverName  by mutableStateOf("")
    var contactNo   by mutableStateOf("")
    var checkInDate by mutableStateOf(Date())

    // ── Customer list for dropdown ─────────────────────────────────────────────
    private val _customers = MutableStateFlow<List<Customer>>(emptyList())
    val customers: StateFlow<List<Customer>> = _customers.asStateFlow()

    // ── Submit state ───────────────────────────────────────────────────────────
    private val _state = MutableStateFlow<AddVehicleState>(AddVehicleState.Idle)
    val state: StateFlow<AddVehicleState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            runCatching { customerRepo.getAll() }.onSuccess { _customers.value = it }
        }
    }

    fun nextStep() { if (currentStep < 1) currentStep++ }
    fun prevStep() { if (currentStep > 0) currentStep-- }

    fun onVehicleNoChange(input: String) {
        vehicleNo = input
            .uppercase()
            .replace("\\s+".toRegex(), "")
    }

    fun onContactNoChange(input: String) {
        contactNo = input.filter { it.isDigit() }.take(10)
    }

    fun isPhotoStepValid() = imageUri != null
    fun isDetailsStepValid(): Boolean {
        val contactDigits = contactNo.filter { it.isDigit() }
        val contactOk = contactDigits.isEmpty() || (contactDigits.length == 10 && contactDigits.first() in listOf('6', '7', '8', '9'))
        return vehicleNo.isNotBlank() && transport.isNotBlank() && customer.isNotBlank() && contactOk
    }

    fun submit() = viewModelScope.launch {
        _state.value = AddVehicleState.Loading
        runCatching {
            val checkedInById = authPrefs.getUserInfo().id.takeIf { it.isNotBlank() }
            vehicleRepo.createVehicle(
                vehicleNo      = vehicleNo.trim(),
                type           = type,
                transport      = transport.trim(),
                customer       = customer.trim(),
                driverName     = driverName.takeIf { it.isNotBlank() },
                contactNo      = contactNo.replace(" ", "").takeIf { it.isNotBlank() },
                checkInDateIso = checkInDate.toIso(),
                checkedInById  = checkedInById,
                status         = "CheckedIn",
                imageLocalPath = checkNotNull(imageUri).toString(),
                mimeType       = "image/jpeg",
            )
        }.onSuccess { v ->
            _state.value = AddVehicleState.Success(v.id)
        }.onFailure { e ->
            _state.value = AddVehicleState.Error(e.message ?: "Failed to add vehicle")
        }
    }

    fun clearError() {
        if (_state.value is AddVehicleState.Error) _state.value = AddVehicleState.Idle
    }
}
