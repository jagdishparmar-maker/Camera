package com.example.gatems.ui.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.automirrored.outlined.List
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.navigation
import androidx.navigation.compose.rememberNavController
import com.example.gatems.ui.screen.add.AddVehicleScreen
import com.example.gatems.ui.screen.all.AllVehiclesScreen
import com.example.gatems.ui.screen.detail.VehicleDetailScreen
import com.example.gatems.ui.screen.dock.DockScreen
import com.example.gatems.ui.screen.edit.EditVehicleScreen
import com.example.gatems.ui.screen.home.HomeScreen
import com.example.gatems.ui.screen.settings.SettingsScreen

// ── Route constants ───────────────────────────────────────────────────────────

object Routes {
    // Tab roots
    const val TAB_HOME     = "tab_home"
    const val TAB_DOCK     = "tab_dock"
    const val TAB_SETTINGS = "tab_settings"

    // Home graph
    const val HOME           = "home"
    const val ALL_VEHICLES   = "all_vehicles"
    const val ADD_VEHICLE    = "add_vehicle"
    const val VEHICLE_DETAIL = "vehicle_detail/{vehicleId}"
    const val EDIT_VEHICLE   = "edit_vehicle/{vehicleId}"

    fun vehicleDetail(id: String)  = "vehicle_detail/$id"
    fun editVehicle(id: String)    = "edit_vehicle/$id"

    // Dock graph
    const val DOCK     = "dock"

    // Settings graph
    const val SETTINGS = "settings"
}

// ── Bottom nav model ──────────────────────────────────────────────────────────

private data class BottomNavItem(
    val label: String,
    val route: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
)

private val bottomNavItems = listOf(
    BottomNavItem("Home",     Routes.TAB_HOME,     Icons.Filled.Home,                       Icons.Outlined.Home),
    BottomNavItem("Dock",     Routes.TAB_DOCK,     Icons.AutoMirrored.Filled.List,          Icons.AutoMirrored.Outlined.List),
    BottomNavItem("Settings", Routes.TAB_SETTINGS, Icons.Filled.Settings,                  Icons.Outlined.Settings),
)

// ── Root NavGraph ─────────────────────────────────────────────────────────────

@Composable
fun GateMsNavGraph() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = backStackEntry?.destination

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor   = MaterialTheme.colorScheme.onSurface,
            ) {
                bottomNavItems.forEach { item ->
                    val selected = currentDestination?.hierarchy?.any { it.route == item.route } == true
                    NavigationBarItem(
                        selected = selected,
                        onClick  = {
                            navController.navigate(item.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState    = true
                            }
                        },
                        icon = {
                            Icon(
                                imageVector        = if (selected) item.selectedIcon else item.unselectedIcon,
                                contentDescription = item.label,
                            )
                        },
                        label  = { Text(item.label) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor   = MaterialTheme.colorScheme.primary,
                            selectedTextColor   = MaterialTheme.colorScheme.primary,
                            indicatorColor      = MaterialTheme.colorScheme.surfaceVariant,
                            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        ),
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController    = navController,
            startDestination = Routes.TAB_HOME,
            // Only apply bottom padding (nav bar height). Each screen's own Scaffold
            // handles the top status-bar inset via its TopAppBar contentWindowInsets.
            modifier         = Modifier.padding(bottom = innerPadding.calculateBottomPadding()),
        ) {
            // ── Home graph ────────────────────────────────────────────────────
            navigation(startDestination = Routes.HOME, route = Routes.TAB_HOME) {
                composable(Routes.HOME) {
                    HomeScreen(navController = navController)
                }
                composable(Routes.ALL_VEHICLES) {
                    AllVehiclesScreen(navController = navController)
                }
                composable(Routes.ADD_VEHICLE) {
                    AddVehicleScreen(navController = navController)
                }
                composable(Routes.VEHICLE_DETAIL) { entry ->
                    val id = entry.arguments?.getString("vehicleId") ?: ""
                    VehicleDetailScreen(navController = navController, vehicleId = id)
                }
                composable(Routes.EDIT_VEHICLE) {
                    EditVehicleScreen(navController = navController)
                }
            }

            // ── Dock graph ────────────────────────────────────────────────────
            navigation(startDestination = Routes.DOCK, route = Routes.TAB_DOCK) {
                composable(Routes.DOCK) {
                    DockScreen(navController = navController)
                }
            }

            // ── Settings graph ────────────────────────────────────────────────
            navigation(startDestination = Routes.SETTINGS, route = Routes.TAB_SETTINGS) {
                composable(Routes.SETTINGS) {
                    SettingsScreen()
                }
            }
        }
    }
}

@Composable
private fun PlaceholderScreen(label: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(
            text  = label,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}
