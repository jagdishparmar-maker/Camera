package com.example.gatems.ui.screen.detail

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.example.gatems.BuildConfig
import com.example.gatems.data.model.Vehicle
import com.example.gatems.data.model.auditCheckedInByLabel
import com.example.gatems.data.model.auditCheckedOutByLabel
import com.example.gatems.ui.navigation.Routes
import com.example.gatems.util.durationBetween
import com.example.gatems.util.formatDateTimeLong
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URL
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VehicleDetailScreen(
    navController: NavController,
    vehicleId: String,
) {
    val viewModel: VehicleDetailViewModel = hiltViewModel()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val deleted by viewModel.deleted.collectAsStateWithLifecycle()
    val actionErr by viewModel.actionError.collectAsStateWithLifecycle()
    val dockOccupancy by viewModel.dockOccupancy.collectAsStateWithLifecycle()
    val isUpdatingDock by viewModel.isUpdatingDock.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var showImagePreview by remember { mutableStateOf(false) }

    LaunchedEffect(deleted) {
        if (deleted) navController.popBackStack()
    }
    LaunchedEffect(actionErr) {
        actionErr?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = (uiState as? VehicleDetailViewModel.UiState.Success)?.vehicle?.vehicleno ?: "Vehicle Detail",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    val vehicle = (uiState as? VehicleDetailViewModel.UiState.Success)?.vehicle ?: return@TopAppBar
                    IconButton(onClick = { navController.navigate(Routes.editVehicle(vehicleId)) }) {
                        Icon(Icons.Filled.Edit, contentDescription = "Edit")
                    }
                    IconButton(onClick = { scope.launch { shareVehicleWithPhoto(context, vehicle) } }) {
                        Icon(Icons.Filled.Share, contentDescription = "Share")
                    }
                    IconButton(onClick = { viewModel.showDeleteDialog = true }) {
                        Icon(Icons.Filled.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        when (val s = uiState) {
            is VehicleDetailViewModel.UiState.Loading -> {
                Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            }
            is VehicleDetailViewModel.UiState.Error -> {
                Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(s.message, color = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = viewModel::load) { Text("Retry") }
                    }
                }
            }
            is VehicleDetailViewModel.UiState.Success -> {
                DetailContent(
                    vehicle = s.vehicle,
                    modifier = Modifier.padding(innerPadding),
                    onOpenImage = { showImagePreview = true },
                    onAssignDock = { viewModel.openDockSheet() },
                    onCallContact = { contact ->
                        context.startActivity(Intent(Intent.ACTION_DIAL).apply {
                            data = android.net.Uri.parse("tel:${contact.trim()}")
                        })
                    },
                )
            }
        }
    }

    if (viewModel.showDeleteDialog) {
        val vehicle = (uiState as? VehicleDetailViewModel.UiState.Success)?.vehicle
        AlertDialog(
            onDismissRequest = { viewModel.showDeleteDialog = false },
            title = { Text("Delete vehicle?") },
            text = { Text("Remove ${vehicle?.vehicleno ?: "this vehicle"} permanently. This cannot be undone.") },
            confirmButton = {
                Button(
                    onClick = viewModel::confirmDelete,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                ) { Text("Delete") }
            },
            dismissButton = { TextButton(onClick = { viewModel.showDeleteDialog = false }) { Text("Cancel") } },
        )
    }

    if (showImagePreview) {
        val vehicle = (uiState as? VehicleDetailViewModel.UiState.Success)?.vehicle
        val imageUrl = vehicle?.imageUrl(BuildConfig.POCKETBASE_URL)
        if (imageUrl != null) {
            FullScreenZoomableImage(
                imageUrl = imageUrl,
                contentDescription = vehicle.vehicleno,
                onDismiss = { showImagePreview = false },
            )
        }
    }

    if (viewModel.showDockSheet) {
        val vehicle = (uiState as? VehicleDetailViewModel.UiState.Success)?.vehicle
        val currentDock = vehicle?.assignedDock
        ModalBottomSheet(onDismissRequest = { viewModel.showDockSheet = false }) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    if (currentDock == null) "Assign dock" else "Change dock",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    if (currentDock == null) "Choose a free bay for ${vehicle?.vehicleno ?: "vehicle"}."
                    else "Move ${vehicle?.vehicleno ?: "vehicle"} to another free bay.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth().height(250.dp).padding(top = 6.dp),
                ) {
                    items((1..10).toList()) { dockNo ->
                        val occupiedBy = dockOccupancy[dockNo]
                        val blockedByOther = occupiedBy != null
                        val isCurrentBay = currentDock == dockNo
                        val bgColor = when {
                            blockedByOther -> MaterialTheme.colorScheme.surfaceVariant
                            isCurrentBay -> MaterialTheme.colorScheme.secondaryContainer
                            else -> MaterialTheme.colorScheme.primaryContainer
                        }

                        OutlinedButton(
                            onClick = {
                                if (isCurrentBay) {
                                    viewModel.showDockSheet = false
                                } else if (!blockedByOther) {
                                    viewModel.assignOrReassignDock(dockNo)
                                }
                            },
                            enabled = !isUpdatingDock && !blockedByOther,
                            colors = ButtonDefaults.outlinedButtonColors(containerColor = bgColor),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("Dock $dockNo", fontWeight = FontWeight.Bold)
                                when {
                                    blockedByOther -> Text(
                                        occupiedBy?.vehicleno ?: "Occupied",
                                        style = MaterialTheme.typography.labelSmall,
                                        maxLines = 1,
                                    )
                                    isCurrentBay -> Text("Current", style = MaterialTheme.typography.labelSmall)
                                    else -> Text("Available", style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                    }
                }
                if (isUpdatingDock) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(8.dp))
                        Text("Updating...", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}

@Composable
private fun DetailContent(
    vehicle: Vehicle,
    modifier: Modifier = Modifier,
    onOpenImage: () -> Unit,
    onAssignDock: () -> Unit,
    onCallContact: (String) -> Unit,
) {
    val status = vehicle.effectiveStatus()
    val imageUrl = vehicle.imageUrl(BuildConfig.POCKETBASE_URL)
    val onSite = vehicle.checkOutDate.isNullOrBlank()
    val hasDockAssigned = vehicle.assignedDock != null

    LazyColumn(modifier = modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Box(
                modifier = Modifier.fillMaxWidth().height(220.dp).clickable(enabled = imageUrl != null, onClick = onOpenImage),
            ) {
                if (imageUrl != null) {
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current).data(imageUrl).crossfade(true).build(),
                        contentDescription = vehicle.vehicleno,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Box(Modifier.fillMaxSize().background(Color(0xFF2C2C2E)), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Filled.Edit, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(42.dp))
                            Spacer(Modifier.height(8.dp))
                            Text(vehicle.vehicleno, color = Color.White, style = MaterialTheme.typography.titleMedium)
                        }
                    }
                }
                Box(
                    modifier = Modifier.fillMaxSize().background(
                        Brush.verticalGradient(0f to Color.Transparent, 1f to Color(0xB0000000))
                    )
                )
                Column(modifier = Modifier.align(Alignment.BottomStart).padding(16.dp)) {
                    Surface(shape = RoundedCornerShape(20.dp), color = status.chipBg()) {
                        Text(
                            text = status.humanLabel().uppercase(),
                            style = MaterialTheme.typography.labelMedium,
                            color = status.chipText(),
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        )
                    }
                }
                if (imageUrl != null) {
                    AssistChip(
                        onClick = onOpenImage,
                        label = { Text("View full") },
                        colors = AssistChipDefaults.assistChipColors(
                            containerColor = Color(0x66000000),
                            labelColor = Color.White,
                        ),
                        modifier = Modifier.align(Alignment.TopEnd).padding(12.dp),
                    )
                }
            }
        }

        if (imageUrl != null) {
            item {
                Surface(modifier = Modifier.fillMaxWidth(), color = Color(0xFF1C1C1E)) {
                    Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                        Text(vehicle.vehicleno, color = Color.White, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        vehicle.type?.takeIf { it.isNotBlank() }?.let {
                            Text(it, color = Color(0xFFAEAEB2), style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }
        }

        item {
            DetailSection(title = "Dock") {
                if (!onSite) {
                    Text("Vehicle has checked out - dock actions are not available.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                } else {
                    if (hasDockAssigned) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("${vehicle.assignedDock}", style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.ExtraBold)
                                Text("Assigned bay", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Column(modifier = Modifier.weight(1.3f)) {
                                vehicle.dockInDateTime?.let {
                                    Text("In: ${formatDateTimeLong(it)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                vehicle.dockOutDateTime?.let {
                                    Text("Out: ${formatDateTimeLong(it)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    } else {
                        Text("No dock assigned yet", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Spacer(Modifier.height(12.dp))
                    Button(onClick = onAssignDock, modifier = Modifier.fillMaxWidth()) {
                        Text(if (hasDockAssigned) "Change dock" else "Assign dock")
                    }
                }
            }
        }

        item {
            DetailSection(title = "People & logistics") {
                InfoRow("Transport", vehicle.transport)
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                InfoRow("Customer", vehicle.customer, highlight = true)
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                InfoRow("Driver", vehicle.driverName)
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                Row(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Contact", modifier = Modifier.weight(0.38f), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    val contact = vehicle.contactNo?.takeIf { it.isNotBlank() }
                    if (contact == null) {
                        Text("—", modifier = Modifier.weight(0.62f), style = MaterialTheme.typography.bodySmall)
                    } else {
                        Row(modifier = Modifier.weight(0.62f), verticalAlignment = Alignment.CenterVertically) {
                            Text(contact, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
                            Spacer(Modifier.width(8.dp))
                            OutlinedButton(onClick = { onCallContact(contact) }) {
                                Icon(Icons.Filled.Call, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("Call")
                            }
                        }
                    }
                }
            }
        }

        item {
            DetailSection(title = "Timeline") {
                TimelineStep("Check in", formatDateTimeLong(vehicle.checkInDate), !vehicle.checkInDate.isNullOrBlank())
                TimelineStep("Dock in", formatDateTimeLong(vehicle.dockInDateTime), !vehicle.dockInDateTime.isNullOrBlank())
                TimelineStep("Dock out", formatDateTimeLong(vehicle.dockOutDateTime), !vehicle.dockOutDateTime.isNullOrBlank())
                TimelineStep("Check out", formatDateTimeLong(vehicle.checkOutDate), !vehicle.checkOutDate.isNullOrBlank(), isLast = true)
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f), modifier = Modifier.padding(top = 4.dp))
                DetailRow("Yard Duration", durationBetween(vehicle.checkInDate, vehicle.checkOutDate) ?: "Ongoing")
            }
        }

        item {
            DetailSection(title = "Notes & audit") {
                InfoRow("Remarks", vehicle.remarks, multiline = true)
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                InfoRow("Checked in by", vehicle.auditCheckedInByLabel())
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                InfoRow("Checked out by", vehicle.auditCheckedOutByLabel())
            }
        }

        item { Spacer(Modifier.height(12.dp)) }
    }
}

@Composable
private fun DetailSection(title: String, content: @Composable () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(14.dp),
    ) {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 14.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(bottom = 10.dp),
            )
            content()
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String?) {
    val display = value?.takeIf { it.isNotBlank() } ?: "—"
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(0.38f),
        )
        Text(
            text = display,
            style = MaterialTheme.typography.bodySmall,
            color = if (value.isNullOrBlank()) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            fontWeight = if (value.isNullOrBlank()) FontWeight.Normal else FontWeight.Medium,
            textAlign = TextAlign.End,
            modifier = Modifier.weight(0.62f).padding(start = 8.dp),
        )
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
}

@Composable
private fun InfoRow(label: String, value: String?, highlight: Boolean = false, multiline: Boolean = false) {
    val display = value?.takeIf { it.isNotBlank() } ?: "—"
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.Top) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(0.38f),
        )
        Text(
            text = display,
            style = MaterialTheme.typography.bodyMedium,
            color = if (highlight) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
            maxLines = if (multiline) 4 else 2,
            fontWeight = if (highlight) FontWeight.SemiBold else FontWeight.Normal,
            textAlign = TextAlign.End,
            modifier = Modifier.weight(0.62f),
        )
    }
}

@Composable
private fun TimelineStep(label: String, value: String, active: Boolean, isLast: Boolean = false) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(24.dp)) {
            Box(
                Modifier.size(10.dp).clip(RoundedCornerShape(99.dp)).background(
                    if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant
                )
            )
            if (!isLast) {
                Spacer(
                    Modifier.width(2.dp).height(30.dp).background(
                        if (active) MaterialTheme.colorScheme.primary.copy(alpha = 0.45f)
                        else MaterialTheme.colorScheme.outlineVariant
                    )
                )
            }
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.padding(bottom = 8.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                value,
                style = MaterialTheme.typography.bodyMedium,
                color = if (active) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun FullScreenZoomableImage(
    imageUrl: String,
    contentDescription: String,
    onDismiss: () -> Unit,
) {
    var scale by remember { mutableFloatStateOf(1f) }
    var offsetX by remember { mutableFloatStateOf(0f) }
    var offsetY by remember { mutableFloatStateOf(0f) }

    androidx.compose.ui.window.Dialog(onDismissRequest = onDismiss) {
        Box(modifier = Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
            AsyncImage(
                model = imageUrl,
                contentDescription = contentDescription,
                modifier = Modifier
                    .fillMaxSize()
                    .offset { IntOffset(offsetX.roundToInt(), offsetY.roundToInt()) }
                    .graphicsLayer(scaleX = scale, scaleY = scale)
                    .pointerInput(Unit) {
                        detectTransformGestures { _, pan, zoom, _ ->
                            val newScale = (scale * zoom).coerceIn(1f, 4f)
                            scale = newScale
                            if (newScale == 1f) {
                                offsetX = 0f
                                offsetY = 0f
                            } else {
                                offsetX += pan.x
                                offsetY += pan.y
                            }
                        }
                    },
                contentScale = ContentScale.Fit,
            )
            IconButton(onClick = onDismiss, modifier = Modifier.align(Alignment.TopEnd).padding(16.dp)) {
                Icon(Icons.Filled.Close, contentDescription = "Close", tint = Color.White)
            }
            AssistChip(
                onClick = {
                    scale = 1f
                    offsetX = 0f
                    offsetY = 0f
                },
                label = { Text("Reset Zoom") },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = Color(0x66000000),
                    labelColor = Color.White,
                ),
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 24.dp),
            )
        }
    }
}

private suspend fun shareVehicleWithPhoto(context: android.content.Context, vehicle: Vehicle) {
    val shareText = buildShareText(vehicle)
    val imageUrl = vehicle.imageUrl(BuildConfig.POCKETBASE_URL)
    if (imageUrl.isNullOrBlank()) {
        val textIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, shareText)
        }
        context.startActivity(Intent.createChooser(textIntent, "Share Vehicle Info"))
        return
    }

    val uri = withContext(Dispatchers.IO) {
        runCatching {
            val bytes = URL(imageUrl).openStream().use { it.readBytes() }
            val dir = File(context.cacheDir, "shared_images").apply { mkdirs() }
            val file = File(dir, "vehicle_${vehicle.id}.jpg")
            file.writeBytes(bytes)
            FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        }.getOrNull()
    }

    if (uri == null) {
        val fallbackIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, shareText)
        }
        context.startActivity(Intent.createChooser(fallbackIntent, "Share Vehicle Info"))
        return
    }

    val shareIntent = Intent(Intent.ACTION_SEND).apply {
        type = "image/*"
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_TEXT, shareText)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(shareIntent, "Share Vehicle Info"))
}

private fun buildShareText(vehicle: Vehicle) = buildString {
    val overview = mutableListOf<String>().apply {
        add("Vehicle: ${vehicle.vehicleno}")
        add("Status: ${vehicle.effectiveStatus().humanLabel()}")
        vehicle.type?.takeIf { it.isNotBlank() }?.let { add("Type: $it") }
        vehicle.customer?.takeIf { it.isNotBlank() }?.let { add("Customer: $it") }
        vehicle.transport?.takeIf { it.isNotBlank() }?.let { add("Transport: $it") }
    }
    val driver = mutableListOf<String>().apply {
        vehicle.driverName?.takeIf { it.isNotBlank() }?.let { add("Driver: $it") }
        vehicle.contactNo?.takeIf { it.isNotBlank() }?.let { add("Contact: $it") }
    }
    val timeline = mutableListOf<String>().apply {
        vehicle.checkInDate?.takeIf { it.isNotBlank() }?.let { add("Check In: ${formatDateTimeLong(it)}") }
        vehicle.checkOutDate?.takeIf { it.isNotBlank() }?.let { add("Check Out: ${formatDateTimeLong(it)}") }
    }
    val dock = mutableListOf<String>().apply {
        vehicle.assignedDock?.let { add("Dock: Dock $it") }
        vehicle.dockInDateTime?.takeIf { it.isNotBlank() }?.let { add("Dock In: ${formatDateTimeLong(it)}") }
        vehicle.dockOutDateTime?.takeIf { it.isNotBlank() }?.let { add("Dock Out: ${formatDateTimeLong(it)}") }
    }

    appendLine("*GateMS - Vehicle Details*")
    appendLine()
    appendLine("*Overview*")
    overview.forEach { appendLine(it) }
    if (driver.isNotEmpty()) {
        appendLine()
        appendLine("*Driver*")
        driver.forEach { appendLine(it) }
    }
    if (timeline.isNotEmpty()) {
        appendLine()
        appendLine("*Timeline*")
        timeline.forEach { appendLine(it) }
    }
    if (dock.isNotEmpty()) {
        appendLine()
        appendLine("*Dock*")
        dock.forEach { appendLine(it) }
    }
    vehicle.remarks?.takeIf { it.isNotBlank() }?.let {
        appendLine()
        appendLine("*Notes*")
        appendLine("Remarks: $it")
    }
}
