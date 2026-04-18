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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.paging.LoadState
import androidx.paging.compose.collectAsLazyPagingItems
import androidx.paging.compose.itemKey
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
import com.example.gatems.ui.component.ErrorState
import com.example.gatems.ui.navigation.Routes
import com.example.gatems.util.SnackbarEvent
import com.example.gatems.util.formatDateTimeShort

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AllVehiclesScreen(navController: NavController) {
    val viewModel: AllVehiclesViewModel = hiltViewModel()

    val pagingItems  = viewModel.pagedVehicles.collectAsLazyPagingItems()
    val searchQuery  by viewModel.searchQuery.collectAsStateWithLifecycle()
    val filter       by viewModel.filter.collectAsStateWithLifecycle()
    val countOnSite  by viewModel.countOnSite.collectAsStateWithLifecycle()
    val countInward  by viewModel.countInward.collectAsStateWithLifecycle()
    val countOutward by viewModel.countOutward.collectAsStateWithLifecycle()
    val countHistory by viewModel.countHistory.collectAsStateWithLifecycle()
    val snackbarEvent by viewModel.snackbarEvent.collectAsStateWithLifecycle()

    var searchExpanded by remember { mutableStateOf(false) }
    val searchFocus    = remember { FocusRequester() }
    val snackbarHostState = remember { SnackbarHostState() }

    // Observed load states drive spinner, error view, pull-to-refresh indicator, and snackbar.
    val refreshLoadState = pagingItems.loadState.refresh
    val isInitialLoading by remember {
        derivedStateOf { refreshLoadState is LoadState.Loading && pagingItems.itemCount == 0 }
    }
    val isRefreshing by remember {
        derivedStateOf { refreshLoadState is LoadState.Loading && pagingItems.itemCount > 0 }
    }
    val initialError by remember {
        derivedStateOf { (refreshLoadState as? LoadState.Error)?.error?.message?.takeIf { pagingItems.itemCount == 0 } }
    }

    // Surface background-refresh errors via the existing snackbar flow; silent when we still have items.
    LaunchedEffect(refreshLoadState) {
        if (refreshLoadState is LoadState.Error && pagingItems.itemCount > 0) {
            viewModel.onRefreshLoadError(refreshLoadState.error.message)
        }
    }

    LaunchedEffect(snackbarEvent) {
        val evt = snackbarEvent ?: return@LaunchedEffect
        val duration = if (evt.actionKind == SnackbarEvent.ActionKind.UNDO_DELETE)
            SnackbarDuration.Long else SnackbarDuration.Short
        val result = snackbarHostState.showSnackbar(
            message     = evt.message,
            actionLabel = evt.actionLabel,
            duration    = duration,
        )
        when (evt.actionKind) {
            SnackbarEvent.ActionKind.UNDO_DELETE -> {
                val id = evt.actionVehicleId
                if (id != null) {
                    if (result == SnackbarResult.ActionPerformed) viewModel.cancelPendingDelete(id)
                    else viewModel.commitPendingDelete(id)
                }
            }
            SnackbarEvent.ActionKind.RETRY_REFRESH -> if (result == SnackbarResult.ActionPerformed)
                pagingItems.refresh()
            else -> Unit
        }
        viewModel.clearSnackbar()
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            Column {
                TopAppBar(
                    navigationIcon = {
                        IconButton(onClick = { navController.popBackStack() }) {
                            Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
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
                                Icon(Icons.Outlined.Search, contentDescription = "Search")
                            }
                        } else {
                            IconButton(onClick = {
                                searchExpanded = false
                                viewModel.setSearchQuery("")
                            }) {
                                Icon(Icons.Outlined.Close, contentDescription = "Close search")
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
            isInitialLoading -> Box(Modifier.fillMaxSize().padding(innerPadding), Alignment.Center) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
            initialError != null -> ErrorState(
                message  = initialError ?: "Could not load vehicles",
                onRetry  = { pagingItems.retry() },
                modifier = Modifier.fillMaxSize().padding(innerPadding),
            )
            else -> PullToRefreshBox(
                isRefreshing = isRefreshing,
                onRefresh    = { pagingItems.refresh() },
                modifier     = Modifier.fillMaxSize().padding(innerPadding),
            ) {
                if (pagingItems.itemCount == 0 && refreshLoadState !is LoadState.Loading) {
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
                        items(
                            count = pagingItems.itemCount,
                            key   = pagingItems.itemKey { it.id },
                        ) { index ->
                            val vehicle = pagingItems[index] ?: return@items
                            VehicleRow(
                                vehicle = vehicle,
                                onClick = { navController.navigate(Routes.vehicleDetail(vehicle.id)) },
                            )
                        }

                        // Append state — loader or retry button at the bottom.
                        when (val append = pagingItems.loadState.append) {
                            is LoadState.Loading -> item {
                                Box(
                                    Modifier.fillMaxWidth().padding(16.dp),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(24.dp),
                                        color    = MaterialTheme.colorScheme.primary,
                                    )
                                }
                            }
                            is LoadState.Error -> item {
                                Column(
                                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    Text(
                                        text  = append.error.message ?: "Could not load more",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.error,
                                    )
                                    Spacer(Modifier.height(8.dp))
                                    Button(onClick = { pagingItems.retry() }) { Text("Retry") }
                                }
                            }
                            else -> Unit
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
