package com.example.gatems.ui.screen.home

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
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import com.example.gatems.BuildConfig
import com.example.gatems.data.model.Vehicle
import com.example.gatems.data.model.VehicleStatus
import com.example.gatems.util.SnackbarEvent
import com.example.gatems.ui.component.CheckOutBottomSheet
import com.example.gatems.ui.component.ConnectivityBanner
import com.example.gatems.ui.component.ErrorState
import com.example.gatems.ui.component.VehicleListCard
import com.example.gatems.ui.navigation.Routes
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(navController: NavController) {
    val viewModel: HomeViewModel = hiltViewModel()

    val uiState          by viewModel.uiState.collectAsStateWithLifecycle()
    val allVehicles      by viewModel.allVehicles.collectAsStateWithLifecycle()
    val filteredVehicles by viewModel.filteredVehicles.collectAsStateWithLifecycle()
    val searchQuery      by viewModel.searchQuery.collectAsStateWithLifecycle()
    val isRefreshing     by viewModel.isRefreshing.collectAsStateWithLifecycle()
    val snackbarEvent    by viewModel.snackbarEvent.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope    = rememberCoroutineScope()
    val searchFocusRequester = remember { FocusRequester() }

    // Snackbar dispatch
    LaunchedEffect(snackbarEvent) {
        snackbarEvent?.let { evt ->
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
                    viewModel.refresh()
                SnackbarEvent.ActionKind.RETRY_LOAD    -> if (result == SnackbarResult.ActionPerformed)
                    viewModel.loadVehicles()
                SnackbarEvent.ActionKind.NAVIGATE_DETAIL -> if (result == SnackbarResult.ActionPerformed)
                    evt.actionVehicleId?.let { navController.navigate(Routes.vehicleDetail(it)) }
                null -> if (result == SnackbarResult.ActionPerformed)
                    evt.actionVehicleId?.let { navController.navigate(Routes.vehicleDetail(it)) }
            }
            viewModel.clearSnackbar()
        }
    }

    // Pager ↔ tab sync
    val pagerState  = rememberPagerState(pageCount = { 2 })
    var selectedTab by remember { mutableIntStateOf(0) }

    LaunchedEffect(pagerState.currentPage, pagerState.isScrollInProgress) {
        if (!pagerState.isScrollInProgress) selectedTab = pagerState.currentPage
    }

    var searchExpanded  by remember { mutableStateOf(false) }
    var checkoutVehicle by remember { mutableStateOf<Vehicle?>(null) }

    val inwardVehicles  = remember(filteredVehicles) { filteredVehicles.filter { it.type == "Inward" } }
    val outwardVehicles = remember(filteredVehicles) { filteredVehicles.filter { it.type == "Outward" } }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            Column {
                if (searchExpanded) {
                    // ── Search mode toolbar ────────────────────────────────────
                    TopAppBar(
                        title = {
                            LaunchedEffect(Unit) { searchFocusRequester.requestFocus() }
                            OutlinedTextField(
                                value         = searchQuery,
                                onValueChange = viewModel::setSearchQuery,
                                placeholder   = { Text("Track vehicle…") },
                                singleLine    = true,
                                modifier      = Modifier
                                    .fillMaxWidth()
                                    .focusRequester(searchFocusRequester),
                                shape         = RoundedCornerShape(8.dp),
                                colors        = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor   = MaterialTheme.colorScheme.primary,
                                    unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                                ),
                                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                                keyboardActions = KeyboardActions(onSearch = { /* already filtering */ }),
                            )
                        },
                        actions = {
                            IconButton(onClick = {
                                searchExpanded = false
                                viewModel.setSearchQuery("")
                            }) {
                                Icon(Icons.Outlined.Close, contentDescription = "Close search")
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(
                            containerColor = MaterialTheme.colorScheme.background,
                        ),
                    )
                } else {
                    // ── Normal toolbar ─────────────────────────────────────────
                    TopAppBar(
                        navigationIcon = {
                            Surface(
                                shape    = CircleShape,
                                color    = MaterialTheme.colorScheme.surfaceVariant,
                                modifier = Modifier
                                    .padding(start = 12.dp)
                                    .size(36.dp),
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(
                                        text       = "GM",
                                        style      = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        color      = MaterialTheme.colorScheme.primary,
                                    )
                                }
                            }
                        },
                        title = {
                            Column(modifier = Modifier.padding(start = 4.dp)) {
                                Text(
                                    text       = "GateMS",
                                    style      = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Text(
                                    text  = "${allVehicles.size} vehicles active",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        },
                        actions = {
                            IconButton(onClick = { /* notifications — Phase 5 */ }) {
                                Icon(Icons.Outlined.Notifications, contentDescription = "Notifications")
                            }
                            IconButton(onClick = { searchExpanded = true }) {
                                Icon(Icons.Outlined.Search, contentDescription = "Search")
                            }
                            IconButton(onClick = { /* menu — Phase 5 */ }) {
                                Icon(Icons.Outlined.MoreVert, contentDescription = "Menu")
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(
                            containerColor    = MaterialTheme.colorScheme.background,
                            titleContentColor = MaterialTheme.colorScheme.onBackground,
                            actionIconContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            navigationIconContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        ),
                    )
                }

                // ── Connectivity banner under toolbar ──────────────────────────
                ConnectivityBanner()
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick        = { navController.navigate(Routes.ADD_VEHICLE) },
                icon           = { Icon(Icons.Outlined.Add, null) },
                text           = { Text("Add") },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor   = Color(0xFF1A1A1A),
            )
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            // ── Section header ─────────────────────────────────────────────────
            Row(
                modifier              = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(top = 8.dp, bottom = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment     = Alignment.CenterVertically,
            ) {
                Text(
                    text       = "Vehicles",
                    style      = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text     = "See all",
                    style    = MaterialTheme.typography.bodyMedium,
                    color    = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.clickable { navController.navigate(Routes.ALL_VEHICLES) },
                )
            }

            // ── Segmented tabs ─────────────────────────────────────────────────
            SingleChoiceSegmentedButtonRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 12.dp),
            ) {
                SegmentedButton(
                    selected = selectedTab == 0,
                    onClick  = {
                        selectedTab = 0
                        coroutineScope.launch { pagerState.animateScrollToPage(0) }
                    },
                    shape = SegmentedButtonDefaults.itemShape(0, 2),
                ) { Text("Inward (${inwardVehicles.size})") }

                SegmentedButton(
                    selected = selectedTab == 1,
                    onClick  = {
                        selectedTab = 1
                        coroutineScope.launch { pagerState.animateScrollToPage(1) }
                    },
                    shape = SegmentedButtonDefaults.itemShape(1, 2),
                ) { Text("Outward (${outwardVehicles.size})") }
            }

            // ── Content ────────────────────────────────────────────────────────
            when (uiState) {
                is HomeUiState.Loading -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    }
                }
                is HomeUiState.Error -> ErrorState(
                    message  = (uiState as HomeUiState.Error).message,
                    onRetry  = { viewModel.loadVehicles() },
                    modifier = Modifier.fillMaxSize(),
                )
                else -> {
                    HorizontalPager(
                        state    = pagerState,
                        modifier = Modifier.weight(1f),
                    ) { page ->
                        val pageVehicles = if (page == 0) inwardVehicles else outwardVehicles
                        val emptyMsg     = if (page == 0) "No inward vehicles" else "No outward vehicles"
                        VehicleLazyList(
                            vehicles     = pageVehicles,
                            isRefreshing = isRefreshing,
                            emptyMsg     = emptyMsg,
                            onRefresh    = viewModel::refresh,
                            onOpenDetail = { navController.navigate(Routes.vehicleDetail(it.id)) },
                            onCheckOut   = { checkoutVehicle = it },
                            onAddVehicle = { navController.navigate(Routes.ADD_VEHICLE) },
                        )
                    }
                }
            }
        }
    }

    // ── Checkout bottom sheet ──────────────────────────────────────────────────
    checkoutVehicle?.let { vehicle ->
        CheckOutBottomSheet(
            vehicle   = vehicle,
            onDismiss = { checkoutVehicle = null },
            onConfirm = { date, remarks ->
                viewModel.checkOut(vehicle.id, date, remarks)
                checkoutVehicle = null
            },
        )
    }
}

// ── Vehicle lazy list with pull-to-refresh ─────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun VehicleLazyList(
    vehicles: List<Vehicle>,
    isRefreshing: Boolean,
    emptyMsg: String,
    onRefresh: () -> Unit,
    onOpenDetail: (Vehicle) -> Unit,
    onCheckOut: (Vehicle) -> Unit,
    onAddVehicle: () -> Unit,
) {
    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh    = onRefresh,
        modifier     = Modifier.fillMaxSize(),
    ) {
        if (vehicles.isEmpty()) {
            EmptyVehicleState(message = emptyMsg, onAddVehicle = onAddVehicle)
        } else {
            LazyColumn(
                contentPadding      = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier            = Modifier.fillMaxSize(),
            ) {
                items(vehicles, key = { it.id }) { vehicle ->
                    VehicleListCard(
                        vehicle      = vehicle,
                        pbBaseUrl    = BuildConfig.POCKETBASE_URL,
                        onOpenDetail = onOpenDetail,
                        onCheckOut   = onCheckOut,
                        showCheckOut = vehicle.effectiveStatus() == VehicleStatus.DockedOut,
                    )
                }
                item { Spacer(Modifier.height(72.dp)) }
            }
        }
    }
}

// ── Empty state ────────────────────────────────────────────────────────────────

@Composable
private fun EmptyVehicleState(message: String, onAddVehicle: () -> Unit) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Surface(
                shape    = CircleShape,
                color    = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier.size(120.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text  = "🚛",
                        style = MaterialTheme.typography.displaySmall,
                    )
                }
            }
            Spacer(Modifier.height(24.dp))
            Text(
                text  = message,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text  = "Tap the + button to add a vehicle",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(24.dp))
            Button(
                onClick = onAddVehicle,
                shape   = RoundedCornerShape(12.dp),
            ) {
                Icon(Icons.Outlined.Add, null, Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
                Text("Add Vehicle")
            }
        }
    }
}
