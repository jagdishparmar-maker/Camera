package com.example.gatems.ui.screen.edit

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
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.DateRange
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.example.gatems.util.formatDateTimeLong
import com.example.gatems.util.toIso
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditVehicleScreen(navController: NavController) {
    val viewModel: EditVehicleViewModel = hiltViewModel()
    val loadState by viewModel.loadState.collectAsStateWithLifecycle()
    val saveState by viewModel.saveState.collectAsStateWithLifecycle()
    val customers by viewModel.customers.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    // Navigate back on success
    LaunchedEffect(saveState) {
        when (val s = saveState) {
            is EditVehicleSaveState.Saved -> navController.popBackStack()
            is EditVehicleSaveState.Error -> {
                snackbarHostState.showSnackbar(s.message)
                viewModel.clearSaveError()
            }
            else -> Unit
        }
    }

    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) viewModel.imageUri = uri
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text("Edit Vehicle", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    val isSaving = saveState is EditVehicleSaveState.Saving
                    Button(
                        onClick  = viewModel::save,
                        enabled  = !isSaving && loadState is EditVehicleLoadState.Success,
                        modifier = Modifier.padding(end = 8.dp),
                    ) {
                        if (isSaving) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color    = MaterialTheme.colorScheme.onPrimary,
                                strokeWidth = 2.dp,
                            )
                        } else {
                            Text("Save")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { innerPadding ->
        when (loadState) {
            is EditVehicleLoadState.Loading -> {
                Box(Modifier.fillMaxSize().padding(innerPadding), Alignment.Center) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            }
            is EditVehicleLoadState.Error -> {
                Box(Modifier.fillMaxSize().padding(innerPadding), Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text((loadState as EditVehicleLoadState.Error).message, color = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = viewModel::load) { Text("Retry") }
                    }
                }
            }
            is EditVehicleLoadState.Success -> {
                EditForm(
                    viewModel   = viewModel,
                    customers   = customers,
                    onPickImage = { pickImage.launch("image/*") },
                    modifier    = Modifier.padding(innerPadding),
                )
            }
        }
    }
}

// ── Edit form ──────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditForm(
    viewModel: EditVehicleViewModel,
    customers: List<com.example.gatems.data.model.Customer>,
    onPickImage: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val isoFmt  = remember {
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            .apply { timeZone = TimeZone.getTimeZone("UTC") }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        // ── Photo ──────────────────────────────────────────────────────────────
        Text("Photo", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(180.dp)
                .clip(RoundedCornerShape(12.dp))
                .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(12.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .clickable { onPickImage() },
            contentAlignment = Alignment.Center,
        ) {
            val imageModel = viewModel.imageUri ?: viewModel.existingImageUrl
            if (imageModel != null) {
                AsyncImage(
                    model = ImageRequest.Builder(context)
                        .data(imageModel)
                        .crossfade(true)
                        .build(),
                    contentDescription = "Vehicle photo",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(12.dp)),
                )
                if (viewModel.imageUri != null) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(8.dp)
                            .size(28.dp)
                            .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(14.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Outlined.Check, null, tint = Color(0xFF1A1A1A), modifier = Modifier.size(16.dp))
                    }
                }
            } else {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Outlined.Add, null, Modifier.size(36.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(6.dp))
                    Text("Tap to change photo", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
            }
        }

        if (viewModel.imageUri != null) {
            OutlinedButton(
                onClick  = { viewModel.imageUri = null },
                modifier = Modifier.fillMaxWidth(),
                colors   = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
            ) { Text("Remove New Photo") }
        }

        // ── Basic Info ─────────────────────────────────────────────────────────
        Text("Basic Information", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)

        OutlinedTextField(
            value         = viewModel.vehicleNo,
            onValueChange = { viewModel.vehicleNo = it.uppercase() },
            label         = { Text("Vehicle Number *") },
            singleLine    = true,
            modifier      = Modifier.fillMaxWidth(),
        )

        Column {
            Text("Type", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(4.dp))
            SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                listOf("Inward", "Outward").forEachIndexed { index, label ->
                    SegmentedButton(
                        selected = viewModel.type == label,
                        onClick  = { viewModel.type = label },
                        shape    = SegmentedButtonDefaults.itemShape(index, 2),
                    ) { Text(label) }
                }
            }
        }

        OutlinedTextField(
            value         = viewModel.transport,
            onValueChange = { viewModel.transport = it },
            label         = { Text("Transport / Truck Owner *") },
            singleLine    = true,
            modifier      = Modifier.fillMaxWidth(),
        )

        // Customer dropdown
        var customerExpanded by remember { mutableStateOf(false) }
        ExposedDropdownMenuBox(
            expanded         = customerExpanded,
            onExpandedChange = { customerExpanded = !customerExpanded },
        ) {
            OutlinedTextField(
                value         = viewModel.customer,
                onValueChange = { viewModel.customer = it },
                label         = { Text("Customer *") },
                singleLine    = true,
                modifier      = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryEditable),
                trailingIcon  = { ExposedDropdownMenuDefaults.TrailingIcon(customerExpanded) },
            )
            if (customers.isNotEmpty()) {
                ExposedDropdownMenu(
                    expanded         = customerExpanded,
                    onDismissRequest = { customerExpanded = false },
                ) {
                    customers.forEach { c ->
                        DropdownMenuItem(
                            text    = { Text(c.customerName) },
                            onClick = {
                                viewModel.customer = c.customerName
                                customerExpanded = false
                            },
                        )
                    }
                }
            }
        }

        // ── Driver ─────────────────────────────────────────────────────────────
        Text("Driver Details", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)

        OutlinedTextField(
            value         = viewModel.driverName,
            onValueChange = { viewModel.driverName = it },
            label         = { Text("Driver Name") },
            singleLine    = true,
            modifier      = Modifier.fillMaxWidth(),
        )

        OutlinedTextField(
            value         = viewModel.contactNo.filter { it.isDigit() },
            onValueChange = {
                viewModel.contactNo = it.filter { ch -> ch.isDigit() }.take(10)
            },
            label         = { Text("Contact Number") },
            placeholder   = { Text("9876543210") },
            singleLine    = true,
            modifier      = Modifier.fillMaxWidth(),
            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Phone),
        )

        // ── Check-in date ──────────────────────────────────────────────────────
        Text("Check-In Date & Time", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)

        EditCheckInDateTimeField(
            currentDate = viewModel.checkInDate,
            valueText = formatDateTimeLong(isoFmt.format(viewModel.checkInDate)),
            onDateTimeSelected = { viewModel.checkInDate = it },
        )

        // ── Notes ──────────────────────────────────────────────────────────────
        Text("Notes", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)

        OutlinedTextField(
            value         = viewModel.remarks,
            onValueChange = { viewModel.remarks = it },
            label         = { Text("Remarks") },
            minLines      = 3,
            modifier      = Modifier.fillMaxWidth(),
        )

        Spacer(Modifier.height(8.dp))

        // ── Save button ────────────────────────────────────────────────────────
        Button(
            onClick   = viewModel::save,
            modifier  = Modifier.fillMaxWidth(),
            enabled   = viewModel.vehicleNo.isNotBlank() && viewModel.transport.isNotBlank() && viewModel.customer.isNotBlank(),
        ) {
            Icon(Icons.Outlined.Check, null, Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text("Save Changes")
        }

        Spacer(Modifier.height(16.dp))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditCheckInDateTimeField(
    currentDate: Date,
    valueText: String,
    onDateTimeSelected: (Date) -> Unit,
) {
    var showDateDialog by remember { mutableStateOf(false) }
    var showTimeDialog by remember { mutableStateOf(false) }
    var pendingDateMillis by remember { mutableLongStateOf(currentDate.time) }

    val datePickerState = rememberDatePickerState(initialSelectedDateMillis = pendingDateMillis)
    val calendar = remember(currentDate) { Calendar.getInstance().apply { time = currentDate } }
    val timePickerState = rememberTimePickerState(
        initialHour = calendar.get(Calendar.HOUR_OF_DAY),
        initialMinute = calendar.get(Calendar.MINUTE),
        is24Hour = true,
    )

    OutlinedTextField(
        value = valueText,
        onValueChange = {},
        label = { Text("Check-In Date & Time") },
        readOnly = true,
        singleLine = true,
        modifier = Modifier.fillMaxWidth().clickable { showDateDialog = true },
        trailingIcon = {
            IconButton(onClick = { showDateDialog = true }) {
                Icon(Icons.Outlined.DateRange, null)
            }
        },
    )

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
            dismissButton = { TextButton(onClick = { showDateDialog = false }) { Text("Cancel") } },
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
                    onDateTimeSelected(merged)
                    showTimeDialog = false
                }) { Text("OK") }
            },
            dismissButton = { TextButton(onClick = { showTimeDialog = false }) { Text("Cancel") } },
        )
    }
}
