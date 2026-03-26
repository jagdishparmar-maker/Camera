package com.example.gatems.ui.screen.dock

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import com.example.gatems.data.model.Vehicle
import com.example.gatems.ui.navigation.Routes
import com.example.gatems.util.durationBetween

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DockScreen(navController: NavController) {
    val viewModel: DockViewModel = hiltViewModel()
    val dockSlots by viewModel.dockSlots.collectAsStateWithLifecycle()
    val yardVehicles by viewModel.yardVehicles.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val isRefreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    val snackbar by viewModel.snackbar.collectAsStateWithLifecycle()

    var selectedOccupied by remember { mutableStateOf<Pair<Int, Vehicle>?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(snackbar) {
        snackbar?.let { snackbarHostState.showSnackbar(it); viewModel.clearSnackbar() }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            "Dock Layout",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            "DOCK1 - DOCK$DOCK_COUNT",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground,
                ),
            )
        },
    ) { innerPadding ->
        when {
            isLoading -> Box(Modifier.fillMaxSize().padding(innerPadding), Alignment.Center) {
                CircularProgressIndicator()
            }

            error != null -> Box(Modifier.fillMaxSize().padding(innerPadding), Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(error ?: "Failed to load", color = MaterialTheme.colorScheme.error)
                    Spacer(Modifier.height(12.dp))
                    Button(onClick = viewModel::load) { Text("Retry") }
                }
            }

            else -> PullToRefreshBox(
                isRefreshing = isRefreshing,
                onRefresh = viewModel::refresh,
                modifier = Modifier.fillMaxSize().padding(innerPadding),
            ) {
                val slots = dockSlots.sortedBy { it.dockNumber }
                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    gridItems(slots, key = { it.dockNumber }) { slot ->
                        DockGridCard(
                            slot = slot,
                            onEmptyClick = { viewModel.openAssignSheet(slot.dockNumber) },
                            onOccupiedClick = {
                                slot.vehicles.firstOrNull()?.let { vehicle ->
                                    selectedOccupied = slot.dockNumber to vehicle
                                }
                            },
                        )
                    }
                }
            }
        }
    }

    // Occupied dock action dialog: same action flow as Expo (view details / dock out)
    selectedOccupied?.let { (dockNum, vehicle) ->
        AlertDialog(
            onDismissRequest = { selectedOccupied = null },
            title = { Text("Dock Out Vehicle") },
            text = { Text("Dock out ${vehicle.vehicleno} from DOCK$dockNum?") },
            confirmButton = {
                TextButton(onClick = {
                    selectedOccupied = null
                    navController.navigate(Routes.vehicleDetail(vehicle.id))
                }) { Text("View Details") }
            },
            dismissButton = {
                Row {
                    TextButton(onClick = { selectedOccupied = null }) { Text("Cancel") }
                    TextButton(onClick = {
                        selectedOccupied = null
                        viewModel.promptDockOut(vehicle)
                    }) { Text("Dock Out") }
                }
            },
        )
    }

    if (viewModel.showAssignSheet) {
        AssignDockSheet(
            dockNumber = viewModel.assignTargetDock,
            yardVehicles = yardVehicles,
            selectedVehicle = viewModel.selectedVehicle,
            onSelectVehicle = { viewModel.selectedVehicle = it },
            onConfirm = viewModel::confirmAssign,
            onDismiss = { viewModel.showAssignSheet = false },
        )
    }

    if (viewModel.showDockOutDialog) {
        AlertDialog(
            onDismissRequest = { viewModel.showDockOutDialog = false },
            title = { Text("Dock Out") },
            text = { Text("Mark ${viewModel.dockOutTarget?.vehicleno} as docked out?") },
            confirmButton = { Button(onClick = viewModel::confirmDockOut) { Text("Dock Out") } },
            dismissButton = { TextButton(onClick = { viewModel.showDockOutDialog = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun DockGridCard(
    slot: DockSlot,
    onEmptyClick: () -> Unit,
    onOccupiedClick: () -> Unit,
) {
    val vehicle = slot.vehicles.firstOrNull()
    val occupied = vehicle != null
    val containerColor = if (occupied) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.surfaceVariant
    val badgeColor = if (occupied) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
    val badgeTextColor = if (occupied) Color(0xFF1A1A1A) else MaterialTheme.colorScheme.onSurfaceVariant

    Card(
        modifier = Modifier.fillMaxWidth().height(128.dp).clickable { if (occupied) onOccupiedClick() else onEmptyClick() },
        colors = CardDefaults.cardColors(containerColor = containerColor),
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(Modifier.fillMaxSize().padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Surface(
                    color = badgeColor,
                    shape = RoundedCornerShape(6.dp),
                    shadowElevation = 0.dp,
                ) {
                    Text(
                        text = "DOCK${slot.dockNumber}",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = badgeTextColor,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    )
                }
                if (occupied) {
                    Icon(Icons.Filled.Check, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                }
            }

            Spacer(Modifier.height(10.dp))
            if (vehicle != null) {
                Text(
                    vehicle.vehicleno,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                )
                Text(
                    vehicle.customer ?: "—",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                )
                Text(
                    vehicle.type ?: "—",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                    maxLines = 1,
                )
            } else {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Available", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AssignDockSheet(
    dockNumber: Int,
    yardVehicles: List<Vehicle>,
    selectedVehicle: Vehicle?,
    onSelectVehicle: (Vehicle) -> Unit,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
            Text("Assign to Dock $dockNumber", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Text(
                "Select a yard vehicle to move into this dock",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp, bottom = 14.dp),
            )

            if (yardVehicles.isEmpty()) {
                Box(Modifier.fillMaxWidth().padding(vertical = 28.dp), contentAlignment = Alignment.Center) {
                    Text("No vehicles available in yard", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxWidth().height(320.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    items(yardVehicles, key = { it.id }) { vehicle ->
                        val selected = selectedVehicle?.id == vehicle.id
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(
                                    if (selected) MaterialTheme.colorScheme.primaryContainer else Color.Transparent,
                                    RoundedCornerShape(8.dp),
                                )
                                .clickable { onSelectVehicle(vehicle) }
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(
                                    vehicle.vehicleno,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = if (selected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface,
                                )
                                Text(
                                    "${vehicle.customer ?: "—"} • ${vehicle.type ?: "—"}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = if (selected) MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f) else MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            val duration = durationBetween(vehicle.checkInDate)
                            Text(
                                duration ?: "—",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.End,
                            )
                        }
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
                    }
                }
            }

            Spacer(Modifier.height(14.dp))
            Button(onClick = onConfirm, enabled = selectedVehicle != null, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Assign to Dock $dockNumber")
            }
            Spacer(Modifier.height(20.dp))
        }
    }
}
