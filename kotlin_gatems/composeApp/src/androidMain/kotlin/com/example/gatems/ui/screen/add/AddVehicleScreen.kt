package com.example.gatems.ui.screen.add

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TimePicker
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.example.gatems.data.model.Customer
import com.example.gatems.util.formatDateTimeLong
import java.io.File
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddVehicleScreen(navController: NavController) {
    val viewModel: AddVehicleViewModel = hiltViewModel()
    val state by viewModel.state.collectAsStateWithLifecycle()
    val customers by viewModel.customers.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    LaunchedEffect(state) {
        when (val s = state) {
            is AddVehicleState.Success -> navController.popBackStack()
            is AddVehicleState.Error -> {
                snackbarHostState.showSnackbar(s.message)
                viewModel.clearError()
            }
            else -> Unit
        }
    }

    var pendingCameraUri by remember { mutableStateOf<Uri?>(null) }
    val capturePhoto = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        if (success) viewModel.imageUri = pendingCameraUri
    }
    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) viewModel.imageUri = uri
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Add Vehicle", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(
                            "Step ${viewModel.currentStep + 1} of 2 · ${stepLabel(viewModel.currentStep)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = {
                        if (viewModel.currentStep > 0) viewModel.prevStep() else navController.popBackStack()
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { innerPadding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .imePadding()
        ) {
            LinearProgressIndicator(
                progress = { (viewModel.currentStep + 1) / 2f },
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.primary,
            )

            Column(
                modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                when (viewModel.currentStep) {
                    0 -> PhotoFirstStep(
                        imageUri = viewModel.imageUri,
                        onCapture = {
                            val uri = createTempImageUri(context)
                            pendingCameraUri = uri
                            capturePhoto.launch(uri)
                        },
                        onPickGallery = { pickImage.launch("image/*") },
                    )
                    1 -> DetailsStep(
                        viewModel = viewModel,
                        customers = customers,
                    )
                }
            }

            val isLoading = state is AddVehicleState.Loading
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (viewModel.currentStep > 0) {
                    Button(onClick = viewModel::prevStep, modifier = Modifier.weight(1f)) { Text("Back") }
                }
                Button(
                    onClick = {
                        if (viewModel.currentStep == 0) viewModel.nextStep() else viewModel.submit()
                    },
                    enabled = !isLoading && isStepValid(viewModel),
                    modifier = Modifier.weight(1f),
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                    } else {
                        Text(if (viewModel.currentStep == 0) "Next" else "Save Vehicle")
                    }
                }
            }
        }
    }
}

@Composable
private fun PhotoFirstStep(
    imageUri: Uri?,
    onCapture: () -> Unit,
    onPickGallery: () -> Unit,
) {
    Text("Step 1: Capture Vehicle Photo", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
    Text(
        "Camera capture is primary. Add the photo first, then details will open.",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(240.dp)
            .clip(RoundedCornerShape(14.dp))
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center,
    ) {
        if (imageUri != null) {
            AsyncImage(
                model = imageUri,
                contentDescription = "Selected photo",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Filled.Add, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(48.dp))
                Spacer(Modifier.height(8.dp))
                Text("No photo selected", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }

    Button(onClick = onCapture, modifier = Modifier.fillMaxWidth()) {
        Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
        Text(if (imageUri == null) "Capture Photo" else "Retake Photo")
    }
    TextButton(onClick = onPickGallery, modifier = Modifier.fillMaxWidth()) {
        Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
        Text("Select from Gallery")
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DetailsStep(
    viewModel: AddVehicleViewModel,
    customers: List<Customer>,
) {
    Text("Step 2: Vehicle & Driver Details", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)

    TextField(
        value = viewModel.vehicleNo,
        onValueChange = viewModel::onVehicleNoChange,
        label = { Text("Vehicle Number *") },
        placeholder = { Text("MH12AB1234") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
        isError = viewModel.vehicleNo.isBlank(),
        supportingText = if (viewModel.vehicleNo.isBlank()) ({ Text("Required") }) else null,
    )

    TextField(
        value = viewModel.transport,
        onValueChange = { viewModel.transport = it },
        label = { Text("Transport / Truck Owner *") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
        isError = viewModel.transport.isBlank(),
        supportingText = if (viewModel.transport.isBlank()) ({ Text("Required") }) else null,
    )

    Column {
        Text("Type", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(4.dp))
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            listOf("Inward", "Outward").forEachIndexed { index, label ->
                SegmentedButton(
                    selected = viewModel.type == label,
                    onClick = { viewModel.type = label },
                    shape = SegmentedButtonDefaults.itemShape(index, 2),
                ) { Text(label) }
            }
        }
    }

    var customerExpanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(
        expanded = customerExpanded,
        onExpandedChange = { customerExpanded = !customerExpanded },
    ) {
        TextField(
            value = viewModel.customer,
            onValueChange = { viewModel.customer = it },
            label = { Text("Customer *") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryEditable),
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(customerExpanded) },
            isError = viewModel.customer.isBlank(),
            supportingText = if (viewModel.customer.isBlank()) ({ Text("Required") }) else null,
        )
        ExposedDropdownMenu(
            expanded = customerExpanded,
            onDismissRequest = { customerExpanded = false },
        ) {
            customers.forEach { customer ->
                DropdownMenuItem(
                    text = { Text(customer.customerName) },
                    onClick = {
                        viewModel.customer = customer.customerName
                        customerExpanded = false
                    },
                )
            }
        }
    }

    TextField(
        value = viewModel.driverName,
        onValueChange = { viewModel.driverName = it },
        label = { Text("Driver Name") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
    )

    val phoneDigits = viewModel.contactNo.filter { it.isDigit() }
    val invalidPhone = phoneDigits.isNotEmpty() && !(phoneDigits.length == 10 && phoneDigits.first() in listOf('6', '7', '8', '9'))
    TextField(
        value = viewModel.contactNo.filter { it.isDigit() },
        onValueChange = { input -> viewModel.onContactNoChange(input) },
        label = { Text("Driver Contact Number") },
        placeholder = { Text("9876543210") },
        singleLine = true,
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Phone),
        modifier = Modifier.fillMaxWidth(),
        isError = invalidPhone,
        supportingText = if (invalidPhone) ({ Text("Enter valid 10-digit Indian mobile number") }) else null,
    )

    CheckInDateTimeField(
        date = viewModel.checkInDate,
        onChange = { viewModel.checkInDate = it },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CheckInDateTimeField(
    date: Date,
    onChange: (Date) -> Unit,
) {
    var showDateDialog by remember { mutableStateOf(false) }
    var showTimeDialog by remember { mutableStateOf(false) }
    var pendingDateMillis by remember { mutableLongStateOf(date.time) }

    val datePickerState = rememberDatePickerState(initialSelectedDateMillis = pendingDateMillis)
    val calendar = remember(date) { Calendar.getInstance().apply { time = date } }
    val timePickerState = rememberTimePickerState(
        initialHour = calendar.get(Calendar.HOUR_OF_DAY),
        initialMinute = calendar.get(Calendar.MINUTE),
        is24Hour = true,
    )

    val iso = remember(date) {
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(date)
    }

    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        TextField(
            value = formatDateTimeLong(iso),
            onValueChange = {},
            readOnly = true,
            label = { Text("Check-In Date & Time") },
            singleLine = true,
            modifier = Modifier.weight(1f).clickable { showDateDialog = true },
            trailingIcon = {
                IconButton(onClick = { showDateDialog = true }) { Icon(Icons.Filled.DateRange, null) }
            },
        )
    }

    if (showDateDialog) {
        DatePickerDialog(
            onDismissRequest = { showDateDialog = false },
            confirmButton = {
                TextButton(onClick = {
                    pendingDateMillis = datePickerState.selectedDateMillis ?: pendingDateMillis
                    showDateDialog = false
                    showTimeDialog = true
                }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showDateDialog = false }) { Text("Cancel") }
            },
        ) {
            DatePicker(state = datePickerState)
        }
    }

    if (showTimeDialog) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showTimeDialog = false },
            title = { Text("Select time") },
            text = { TimePicker(state = timePickerState) },
            confirmButton = {
                TextButton(onClick = {
                    val merged = Calendar.getInstance().apply {
                        timeInMillis = pendingDateMillis
                        set(Calendar.HOUR_OF_DAY, timePickerState.hour)
                        set(Calendar.MINUTE, timePickerState.minute)
                        set(Calendar.SECOND, 0)
                    }.time
                    onChange(merged)
                    showTimeDialog = false
                }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showTimeDialog = false }) { Text("Cancel") }
            },
        )
    }
}

private fun stepLabel(step: Int) = when (step) {
    0 -> "Photo"
    else -> "Details"
}

private fun isStepValid(viewModel: AddVehicleViewModel): Boolean = when (viewModel.currentStep) {
    0 -> viewModel.isPhotoStepValid()
    else -> viewModel.isDetailsStepValid()
}

private fun createTempImageUri(context: Context): Uri {
    val dir = File(context.cacheDir, "camera_capture").apply { mkdirs() }
    val file = File(dir, "vehicle_${System.currentTimeMillis()}.jpg")
    return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
}
