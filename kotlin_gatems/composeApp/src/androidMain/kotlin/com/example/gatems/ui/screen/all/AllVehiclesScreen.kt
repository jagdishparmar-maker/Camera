package com.example.gatems.ui.screen.all

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import com.example.gatems.data.model.Vehicle
import com.example.gatems.data.model.auditCheckedInByLabel
import com.example.gatems.ui.navigation.Routes
import com.example.gatems.util.formatDateTimeShort

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AllVehiclesScreen(navController: NavController) {
    val viewModel: AllVehiclesViewModel = hiltViewModel()

    val vehicles     by viewModel.filteredVehicles.collectAsStateWithLifecycle()
    val searchQuery  by viewModel.searchQuery.collectAsStateWithLifecycle()
    val filter       by viewModel.filter.collectAsStateWithLifecycle()
    val isLoading    by viewModel.isLoading.collectAsStateWithLifecycle()
    val isRefreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()
    val error        by viewModel.error.collectAsStateWithLifecycle()
    val countOnSite  by viewModel.countOnSite.collectAsStateWithLifecycle()
    val countInward  by viewModel.countInward.collectAsStateWithLifecycle()
    val countOutward by viewModel.countOutward.collectAsStateWithLifecycle()
    val countHistory by viewModel.countHistory.collectAsStateWithLifecycle()

    var searchExpanded by remember { mutableStateOf(false) }
    val searchFocus    = remember { FocusRequester() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            Column {
                TopAppBar(
                    navigationIcon = {
                        IconButton(onClick = { navController.popBackStack() }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                        }
                    },
                    title = {
                        if (searchExpanded) {
                            OutlinedTextField(
                                value         = searchQuery,
                                onValueChange = viewModel::setSearchQuery,
                                placeholder   = { Text("Search vehicles…") },
                                singleLine    = true,
                                modifier      = Modifier
                                    .fillMaxWidth()
                                    .focusRequester(searchFocus),
                                shape  = RoundedCornerShape(8.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor   = MaterialTheme.colorScheme.primary,
                                    unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                                ),
                                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                                keyboardActions = KeyboardActions(onSearch = {}),
                            )
                        } else {
                            Text("All Vehicles", fontWeight = FontWeight.SemiBold)
                        }
                    },
                    actions = {
                        if (!searchExpanded) {
                            IconButton(onClick = { searchExpanded = true }) {
                                Icon(Icons.Filled.Search, contentDescription = "Search")
                            }
                        } else {
                            IconButton(onClick = {
                                searchExpanded = false
                                viewModel.setSearchQuery("")
                            }) {
                                Icon(Icons.Filled.Close, contentDescription = "Close search")
                            }
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
                )

                // ── Filter tabs ────────────────────────────────────────────────
                ScrollableTabRow(
                    selectedTabIndex = VehicleFilter.entries.indexOf(filter),
                    containerColor   = MaterialTheme.colorScheme.background,
                    edgePadding      = 16.dp,
                ) {
                    val tabs = listOf(
                        "On Site"  to countOnSite,
                        "Inward"   to countInward,
                        "Outward"  to countOutward,
                        "History"  to countHistory,
                    )
                    VehicleFilter.entries.forEachIndexed { index, f ->
                        val (label, count) = tabs[index]
                        Tab(
                            selected = filter == f,
                            onClick  = { viewModel.setFilter(f) },
                            text     = {
                                Text(
                                    text  = "$label ($count)",
                                    style = MaterialTheme.typography.labelMedium,
                                )
                            },
                        )
                    }
                }
            }
        },
    ) { innerPadding ->
        when {
            isLoading -> Box(Modifier.fillMaxSize().padding(innerPadding), Alignment.Center) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
            error != null -> Box(Modifier.fillMaxSize().padding(innerPadding), Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(error!!, color = MaterialTheme.colorScheme.error)
                    Spacer(Modifier.height(12.dp))
                    Button(onClick = viewModel::load) { Text("Retry") }
                }
            }
            else -> PullToRefreshBox(
                isRefreshing = isRefreshing,
                onRefresh    = viewModel::refresh,
                modifier     = Modifier.fillMaxSize().padding(innerPadding),
            ) {
                if (vehicles.isEmpty()) {
                    Box(Modifier.fillMaxSize(), Alignment.Center) {
                        Text(
                            text  = "No vehicles found",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                } else {
                    LazyColumn(
                        contentPadding      = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier            = Modifier.fillMaxSize(),
                    ) {
                        items(vehicles, key = { it.id }) { vehicle ->
                            VehicleRow(
                                vehicle  = vehicle,
                                onClick  = { navController.navigate(Routes.vehicleDetail(vehicle.id)) },
                            )
                        }
                        item { Spacer(Modifier.height(16.dp)) }
                    }
                }
            }
        }
    }
}

// ── Vehicle row card ───────────────────────────────────────────────────────────

@Composable
private fun VehicleRow(vehicle: Vehicle, onClick: () -> Unit) {
    val status = vehicle.effectiveStatus()

    Card(
        modifier  = Modifier.fillMaxWidth().clickable { onClick() },
        shape     = RoundedCornerShape(10.dp),
        colors    = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(
            modifier          = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            // Left: vehicle no + meta
            Column(Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        text       = vehicle.vehicleno,
                        style      = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                    )
                    // Status chip
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = status.chipBg(),
                    ) {
                        Text(
                            text     = status.humanLabel(),
                            style    = MaterialTheme.typography.labelSmall,
                            color    = status.chipText(),
                            modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp),
                        )
                    }
                }
                Text(
                    text  = "${vehicle.customer ?: "—"} · ${vehicle.type ?: "—"}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                val inBy = vehicle.auditCheckedInByLabel()
                if (inBy != "—") {
                    Text(
                        text  = "In by $inBy",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (vehicle.assignedDock != null) {
                    Text(
                        text  = "Dock ${vehicle.assignedDock}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }

            // Right: check-in date
            Text(
                text  = formatDateTimeShort(vehicle.checkInDate),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
