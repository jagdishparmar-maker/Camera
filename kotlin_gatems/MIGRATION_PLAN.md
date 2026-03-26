# GateMS — Expo → Kotlin/Jetpack Compose Migration Plan

> **Status:** Plan (awaiting review before implementation)  
> **Source app:** `D:/coldverse/Camera/` (Expo SDK 54, React Native Paper, PocketBase)  
> **Target app:** `D:/coldverse/Camera/kotlin_gatems/` (Kotlin Multiplatform, Jetpack Compose, Material 3)

---

## 1. Feature Inventory (Complete)

Everything that must be carried over 1-for-1:

| # | Feature | Source file(s) |
|---|---------|---------------|
| 1 | PocketBase auth (email/password, persistent token) | `lib/pocketbase.ts`, `hooks/use-pocketbase-auth.ts` |
| 2 | Bottom nav — 3 tabs: Home · Dock · Settings | `app/(tabs)/_layout.tsx`, `components/AppTabBar.tsx` |
| 3 | Home screen — active vehicles, Inward/Outward swipe-pager, inline search | `app/(tabs)/(home)/index.tsx` |
| 4 | All Vehicles screen — full history, search, same pager | `app/(tabs)/(home)/all.tsx` |
| 5 | Add Vehicle — 3-step wizard (Type+Customer → Photo → Details), background upload, draft cleanup | `app/(tabs)/(home)/add.tsx` |
| 6 | Edit Vehicle — full form pre-filled from record | `app/(tabs)/(home)/vehicle/edit/[id].tsx` |
| 7 | Vehicle Detail — hero image, status chip, dock assignment grid (10 bays), 4-step timeline, share, delete | `app/(tabs)/(home)/vehicle/[id].tsx` |
| 8 | Dock Layout screen — 10-bay grid, occupied/free, dock-out action sheet | `app/(tabs)/(search)/index.tsx` |
| 9 | Settings screen — placeholder list | `app/(tabs)/(settings)/index.tsx` |
| 10 | Realtime updates — SSE subscriptions on `vehicles` collection | `lib/realtime.ts`, `hooks/use-realtime.ts` |
| 11 | In-app toast notifications with "View" action | `contexts/NotificationContext.tsx` |
| 12 | Connectivity banner — no-internet / DB-unreachable states | `contexts/ConnectivityContext.tsx` |
| 13 | Camera & gallery image capture | `expo-image-picker` usage in add/edit |
| 14 | Share vehicle details + image | `expo-sharing`, `expo-file-system` |
| 15 | Phone dial shortcut from vehicle card | `Linking.openURL('tel:...')` |
| 16 | Vehicle status computation logic | `lib/vehicle-types.ts` |
| 17 | Check-out bottom sheet modal (date/time picker + remarks) | inline in home/all screens |
| 18 | Full-screen image viewer | Modal inside vehicle detail |
| 19 | Dark Material 3 theme — lime green primary, dark gray surfaces | `lib/theme.ts` |

---

## 2. Target Architecture

```
kotlin_gatems/
└── composeApp/
    └── src/
        └── androidMain/
            └── kotlin/com/example/gatems/
                ├── MainActivity.kt
                ├── GateMsApp.kt              ← Application class
                │
                ├── data/
                │   ├── model/
                │   │   ├── Vehicle.kt         ← data class (mirrors Vehicle TS type)
                │   │   ├── VehicleStatus.kt   ← enum + computeStatus()
                │   │   └── Customer.kt
                │   ├── network/
                │   │   ├── PocketBaseClient.kt ← Retrofit/Ktor instance + auth header
                │   │   ├── PocketBaseApi.kt   ← REST endpoints
                │   │   └── RealtimeClient.kt  ← SSE-based realtime subscriptions
                │   ├── repository/
                │   │   ├── VehicleRepository.kt
                │   │   └── CustomerRepository.kt
                │   └── preferences/
                │       └── AuthPreferences.kt ← DataStore auth token persistence
                │
                ├── ui/
                │   ├── theme/
                │   │   ├── Theme.kt           ← Material3 dark, lime green
                │   │   ├── Color.kt
                │   │   └── Type.kt
                │   ├── navigation/
                │   │   └── NavGraph.kt        ← NavHost + BottomNav
                │   ├── components/
                │   │   ├── VehicleListCard.kt
                │   │   ├── ConnectivityBanner.kt
                │   │   ├── ToastNotification.kt
                │   │   ├── CheckOutBottomSheet.kt
                │   │   ├── DockPickerDialog.kt
                │   │   └── TimelineRow.kt
                │   └── screens/
                │       ├── home/
                │       │   ├── HomeScreen.kt
                │       │   └── HomeViewModel.kt
                │       ├── allvehicles/
                │       │   ├── AllVehiclesScreen.kt
                │       │   └── AllVehiclesViewModel.kt
                │       ├── addvehicle/
                │       │   ├── AddVehicleScreen.kt
                │       │   └── AddVehicleViewModel.kt
                │       ├── editvehicle/
                │       │   ├── EditVehicleScreen.kt
                │       │   └── EditVehicleViewModel.kt
                │       ├── vehicledetail/
                │       │   ├── VehicleDetailScreen.kt
                │       │   └── VehicleDetailViewModel.kt
                │       ├── dock/
                │       │   ├── DockScreen.kt
                │       │   └── DockViewModel.kt
                │       └── settings/
                │           └── SettingsScreen.kt
                │
                └── util/
                    ├── DateUtil.kt
                    └── ImageUtil.kt
```

**Pattern:** MVVM with `ViewModel` + `StateFlow` / `UiState` sealed class per screen.  
**DI:** Hilt (recommended) or manual singleton injection for repositories/client.

---

## 3. Dependency Map

### Expo → Kotlin equivalent

| Expo / React Native | Kotlin / Android |
|--------------------|-----------------|
| `pocketbase` JS SDK | Custom REST via **Ktor** (recommended) or Retrofit + OkHttp |
| PocketBase realtime (EventSource polyfill) | Ktor `HttpClient` WebSocket or raw SSE via `OkHttp.EventSource` |
| `expo-image-picker` | **Photo Picker API** (`ActivityResultContracts.PickVisualMedia`) + `CameraX` |
| `expo-file-system` | `OkHttp` download + `File` API |
| `expo-sharing` | `ShareCompat.IntentBuilder` (Android share intent) |
| `@react-native-async-storage` | **Jetpack DataStore** (Preferences) |
| `@react-native-community/netinfo` | `ConnectivityManager` + `NetworkCallback` |
| `react-native-paper` (MD3) | **Material 3 for Compose** (`androidx.compose.material3`) |
| `react-native-pager-view` | `HorizontalPager` (Accompanist Pager or Compose Foundation) |
| Expo Router bottom tabs | **Navigation Compose** + `NavigationBar` |
| `expo-haptics` | `Vibrator` / `VibrationEffect` |
| `react-native-safe-area-context` | `WindowInsets` in Compose |
| Geist font | Download TTF → `res/font/`, apply via `FontFamily` in Theme.kt |

### New `build.gradle.kts` dependencies to add

```kotlin
// Networking
implementation("io.ktor:ktor-client-android:2.3.x")
implementation("io.ktor:ktor-client-content-negotiation:2.3.x")
implementation("io.ktor:ktor-serialization-kotlinx-json:2.3.x")

// Serialization
implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.x")
plugins { id("org.jetbrains.kotlin.plugin.serialization") }

// Image loading
implementation("io.coil-kt:coil-compose:2.6.x")

// Navigation
implementation("androidx.navigation:navigation-compose:2.7.x")

// DataStore
implementation("androidx.datastore:datastore-preferences:1.1.x")

// Pager (HorizontalPager)
// Built-in from compose.foundation 1.6+, no extra dep needed

// Hilt (DI)
implementation("com.google.dagger:hilt-android:2.51.x")
kapt("com.google.dagger:hilt-android-compiler:2.51.x")
implementation("androidx.hilt:hilt-navigation-compose:1.2.x")

// Lifecycle
implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.x")
implementation("androidx.lifecycle:lifecycle-runtime-compose:2.7.x")

// CameraX (optional — Photo Picker alone covers gallery + camera on API 21+)
implementation("androidx.camera:camera-camera2:1.3.x")
implementation("androidx.camera:camera-lifecycle:1.3.x")
implementation("androidx.camera:camera-view:1.3.x")

// Coroutines (already implied)
implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.x")
```

---

## 4. Data Model (Kotlin)

Direct translation of `lib/vehicle-types.ts`:

```kotlin
// VehicleStatus.kt
enum class VehicleStatus { CheckedIn, CheckedOut, DockedIn, DockedOut }

fun computeStatus(
    checkOutDate: String?,
    dockOutDateTime: String?,
    assignedDock: Int?,
    dockInDateTime: String?
): VehicleStatus = when {
    checkOutDate != null        -> VehicleStatus.CheckedOut
    dockOutDateTime != null     -> VehicleStatus.DockedOut
    assignedDock != null || dockInDateTime != null -> VehicleStatus.DockedIn
    else                        -> VehicleStatus.CheckedIn
}

val STATUS_COLORS = mapOf(
    VehicleStatus.CheckedIn  to Color(0xFF22C55E),
    VehicleStatus.CheckedOut to Color(0xFF64748B),
    VehicleStatus.DockedIn   to Color(0xFF3B82F6),
    VehicleStatus.DockedOut  to Color(0xFFF59E0B),
)
```

```kotlin
// Vehicle.kt
@Serializable
data class Vehicle(
    val id: String,
    val vehicleno: String,
    val image: String = "",
    val status: VehicleStatus? = null,
    @SerialName("Check_In_Date")  val checkInDate: String? = null,
    @SerialName("Type")           val type: String? = null,
    @SerialName("Transport")      val transport: String? = null,
    @SerialName("Customer")       val customer: String? = null,
    @SerialName("Driver_Name")    val driverName: String? = null,
    @SerialName("Contact_No")     val contactNo: String? = null,
    @SerialName("Check_Out_Date") val checkOutDate: String? = null,
    @SerialName("Assigned_Dock")  val assignedDock: Int? = null,
    @SerialName("Dock_In_DateTime")  val dockInDateTime: String? = null,
    @SerialName("Dock_Out_DateTime") val dockOutDateTime: String? = null,
    @SerialName("Remarks")        val remarks: String? = null,
    @SerialName("Checked_In_By")  val checkedInBy: String? = null,
    @SerialName("Checked_Out_By") val checkedOutBy: String? = null,
    val expand: VehicleExpand? = null,
)

@Serializable
data class VehicleExpand(
    @SerialName("Checked_In_By")  val checkedInBy: UserRecord? = null,
    @SerialName("Checked_Out_By") val checkedOutBy: UserRecord? = null,
)

@Serializable
data class UserRecord(val id: String, val name: String? = null, val email: String? = null)

@Serializable
data class Customer(val id: String, @SerialName("customer_name") val customerName: String)
```

---

## 5. PocketBase Client (Kotlin)

PocketBase exposes a REST API. We will call it with **Ktor** (multiplatform-friendly).

### Auth flow
- `POST /api/collections/users/auth-with-password` → returns `{ token, record }`
- Store token in **DataStore Preferences**
- Attach `Authorization: Bearer <token>` on every request via Ktor plugin

### File URLs
```
GET {PB_URL}/api/files/{collectionId}/{recordId}/{filename}
```
Build this URL from the record's `collectionId`/`id`/`image` fields — same logic as `lib/storage.ts`.

### Realtime (SSE)
PocketBase realtime endpoint: `GET /api/realtime` — returns a Server-Sent Events stream.

Implementation options (choose one):
1. **OkHttp EventSource** — lightweight, battle-tested on Android
2. **Ktor `HttpStatement.execute { response -> … }`** — read the byte stream manually

Subscribe payload:
```json
{ "subscriptions": ["vehicles"] }
```

Each SSE message carries `{ action: "create"|"update"|"delete", record: { … } }` — mirror the `RealtimeHandler` pattern into a Kotlin `Flow<RealtimeEvent<Vehicle>>`.

---

## 6. Theme (Material 3 Dark)

Direct translation of `lib/theme.ts`:

```kotlin
// Color.kt
val Primary         = Color(0xFF8CE02A)   // Vibrant lime green
val PrimaryContainer= Color(0xFF5A8A1A)
val OnPrimary       = Color(0xFF1A1A1A)
val Secondary       = Color(0xFFE0C8FF)
val SecondaryContainer = Color(0xFF5A3A8A)
val Surface         = Color(0xFF3A3A3C)
val Background      = Color(0xFF2C2C2E)
val SurfaceVariant  = Color(0xFF48484A)
val OnSurface       = Color(0xFFFFFFFF)
val OnSurfaceVariant= Color(0xFFC0C0C0)
val Outline         = Color(0xFF636366)

// Type.kt  — Geist font family (add TTF files to res/font/)
val GateMsTypography = Typography(
    titleLarge  = TextStyle(fontFamily = GeistSemiBold, fontSize = 22.sp),
    titleMedium = TextStyle(fontFamily = GeistMedium,   fontSize = 16.sp),
    bodyMedium  = TextStyle(fontFamily = GeistRegular,  fontSize = 14.sp),
    labelSmall  = TextStyle(fontFamily = GeistMonoRegular, fontSize = 11.sp),
    // … mirror the full geistFontConfig mapping
)
```

Roundness (`roundness = 16`) → set `Shapes` in `Theme.kt` with `medium = RoundedCornerShape(16.dp)`.

---

## 7. Navigation Structure

```
NavHost
├── BottomNavigation (3 items: Home · Dock · Settings)
│   ├── "home" graph
│   │   ├── HomeScreen              ← startDestination
│   │   ├── AllVehiclesScreen       ← "home/all"
│   │   ├── AddVehicleScreen        ← "home/add"
│   │   ├── VehicleDetailScreen     ← "home/vehicle/{id}"
│   │   └── EditVehicleScreen       ← "home/vehicle/{id}/edit"
│   ├── "dock" graph
│   │   └── DockScreen              ← startDestination
│   └── "settings" graph
│       └── SettingsScreen          ← startDestination
```

Bottom bar icons: `Icons.Default.Home` / `Icons.Outlined.Home`, `Icons.Default.GridView` / `Icons.Outlined.GridView`, `Icons.Default.Settings` / `Icons.Outlined.Settings` (matches the Expo icon set).

---

## 8. Screen-by-Screen Migration Notes

### 8.1 HomeScreen
- `PagerView` (Inward/Outward) → `HorizontalPager` from `androidx.compose.foundation.pager`
- `SegmentedButtons` → `TabRow` or custom `SegmentedControl` (Material 3 has `SegmentedButton`)
- Inline search expand/collapse → `AnimatedVisibility`
- Exit/Check-out modal → `ModalBottomSheet` with date/time picker (`DatePickerDialog` + `TimePickerDialog`)
- FAB → `FloatingActionButton`
- Realtime subscription in `ViewModel` via `Flow` collected with `lifecycleScope`

### 8.2 AllVehiclesScreen
- Nearly identical to HomeScreen — extract a shared `VehicleListContent` composable, pass `showCheckedOut: Boolean`

### 8.3 AddVehicleScreen (3-step wizard)
**Step 1** — Type selector (two big clickable cards) + Customer dropdown (`ExposedDropdownMenuBox`)  
**Step 2** — Photo: `Photo Picker` (gallery) + `CameraX` capture  
**Step 3** — Details form (vehicle no, transport, driver, contact, date)

Background upload: launch a coroutine in ViewModel immediately after photo is selected; track `UploadState` (Idle / Uploading / Done / Error) in `StateFlow`. Draft cleanup on ViewModel `onCleared()` if vehicle was not saved.

`usePreventRemove` equivalent → `BackHandler` + confirmation `AlertDialog`.

### 8.4 VehicleDetailScreen
- Hero image → `AsyncImage` (Coil) with `contentScale = ContentScale.Crop`, `16:9` aspect ratio via `Modifier.aspectRatio(16f/9f)`
- Full-screen viewer → `Dialog` with `AsyncImage(contentScale = ContentScale.Fit)` + close button
- Status chip → `AssistChip` or `SuggestionChip` with coloured container
- Dock assignment → custom `AlertDialog` with `LazyVerticalGrid(columns = GridCells.Fixed(3))`, 10 dock slots
- Timeline → custom composable with a vertical line + dots (same visual as Expo version)
- Share → `Intent(Intent.ACTION_SEND)` with text + image Uri (download to cache first via OkHttp)
- Delete → `AlertDialog` confirmation

### 8.5 DockScreen
- `LazyVerticalGrid(columns = GridCells.Fixed(2))` for 10 docks
- Occupied dock → `Card` with vehicle info and ripple; press → `AlertDialog` with "View Details" / "Dock Out" options
- Realtime updates → same ViewModel `Flow` pattern

### 8.6 EditVehicleScreen
- Pre-fill form from repository on `LaunchedEffect`
- Image handling: if image is a URL (existing), display with Coil; if user picks a new one, it's a local `Uri`

### 8.7 ConnectivityBanner
- `ConnectivityManager.NetworkCallback` in a `ViewModel` or repository exposed as `StateFlow<ConnectivityStatus>`
- PocketBase health check `GET /api/health` via Ktor at 15-second intervals (same as Expo)
- Show an `AnimatedVisibility` banner at top of each screen's `Scaffold`

### 8.8 In-App Toast / Notification
- Single `SnackbarHostState` provided at root `Scaffold` level via `CompositionLocalProvider`
- OR a custom overlay `Snackbar`-style composable with action button (matches the current `showNotification(msg, { label, onPress })` API)

---

## 9. Image Handling

### Camera
```kotlin
// Use Photo Picker (API 21+ backport via `ActivityResultContracts.PickVisualMedia`)
// For camera: register ActivityResult for `ActivityResultContracts.TakePicture()`
// Save to a temp file in cacheDir, pass URI to ViewModel
```

### Upload to PocketBase
PocketBase accepts multipart form data for file fields.

```kotlin
// Ktor multipart:
client.submitFormWithBinaryData(
    url = "$PB_URL/api/collections/vehicles/records/$id",
    formData = formData {
        append("vehicleno", vehicleno)
        // … other fields
        appendInput("image", Headers.build {
            append(HttpHeaders.ContentType, "image/jpeg")
            append(HttpHeaders.ContentDisposition, "filename=vehicle.jpg")
        }) { File(localPath).readChannel() }
    }
)
```

### File URL
```kotlin
fun fileUrl(pb: String, collectionId: String, recordId: String, filename: String) =
    "$pb/api/files/$collectionId/$recordId/$filename"
```

---

## 10. Implementation Phases

### Phase 1 — Foundation (Week 1)
- [ ] Update `build.gradle.kts` with all dependencies
- [ ] Set up `GateMsApp.kt` (Application class, Hilt)
- [ ] Create `Color.kt`, `Type.kt`, `Theme.kt` (exact Expo colors + Geist font)
- [ ] Create `NavGraph.kt` with bottom navigation (3 tabs, placeholders)
- [ ] `PocketBaseClient.kt` — Ktor setup, auth header interceptor
- [ ] `AuthPreferences.kt` — DataStore token storage
- [ ] `PocketBaseApi.kt` — CRUD endpoints (list, get, create, update, delete)
- [ ] Data models: `Vehicle.kt`, `VehicleStatus.kt`, `Customer.kt`
- [ ] `VehicleRepository.kt`, `CustomerRepository.kt`

### Phase 2 — Core Screens (Week 2)
- [ ] `HomeViewModel.kt` + `HomeScreen.kt` (list, search, pager, realtime hook)
- [ ] `VehicleListCard.kt` composable (thumbnail, status chip, dock pill, actions)
- [ ] `CheckOutBottomSheet.kt` (date picker + remarks + confirm)
- [ ] `ConnectivityBanner.kt` + `ConnectivityViewModel.kt`
- [ ] `ToastNotification.kt` (snackbar with action)

### Phase 3 — Vehicle CRUD (Week 3)
- [ ] `AddVehicleViewModel.kt` + `AddVehicleScreen.kt` (3-step wizard)
  - Photo Picker integration
  - CameraX capture
  - Background upload with `UploadState`
  - Draft cleanup on back
- [ ] `EditVehicleViewModel.kt` + `EditVehicleScreen.kt`
- [ ] `VehicleDetailViewModel.kt` + `VehicleDetailScreen.kt`
  - Hero image + full-screen viewer
  - Dock assignment dialog (10 bays, grid)
  - Timeline composable
  - Share intent with image

### Phase 4 — Dock & Extras (Week 4)
- [ ] `DockViewModel.kt` + `DockScreen.kt` (grid, dock-out action sheet)
- [ ] `AllVehiclesScreen.kt` + `AllVehiclesViewModel.kt`
- [ ] `RealtimeClient.kt` — SSE subscription integrated into ViewModels
- [ ] `SettingsScreen.kt` (placeholder list)
- [ ] Connectivity monitor wired to UI

### Phase 5 — Polish & Release (Week 5)
- [ ] Geist font files bundled in `res/font/`
- [ ] App icon (replace default ic_launcher with GateMS branding)
- [ ] AndroidManifest permissions: CAMERA, INTERNET, READ_MEDIA_IMAGES
- [ ] ProGuard rules for Ktor + Kotlin serialization
- [ ] Build release APK, verify on physical device

---

## 11. Key Decisions to Confirm

| Decision | Recommended choice | Alternative |
|----------|--------------------|-------------|
| HTTP client | **Ktor** (KMP-ready, already fits the multiplatform project template) | Retrofit + OkHttp |
| PocketBase realtime | **OkHttp SSE** (EventSource via `okhttp-sse`) | Ktor byte stream |
| DI | **Hilt** | Manual singleton |
| Auth persistence | **DataStore Preferences** | SharedPreferences |
| Camera | **Photo Picker** (gallery) + `ActivityResultContracts.TakePicture` (camera) | CameraX |
| Keep KMP template or go pure Android? | **Pure Android** (only one platform needed) — simplify the template | Keep KMP |

---

## 12. What Is NOT Migrated

| Item | Reason |
|------|--------|
| iOS support | Kotlin app is Android-only (by design) |
| EAS Build / OTA updates | Replaced by native APK distribution |
| Expo Go compatibility | Not applicable |
| `webapp_nextjs/` web dashboard | Separate project; stays as-is |
| `pocketbase_hooks/` | Backend hooks — unchanged, still run on PocketBase server |

---

## 13. Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| PocketBase SSE realtime in Kotlin is underdocumented | Use `okhttp-sse` with the documented PocketBase realtime protocol; test early |
| Multipart file upload to PocketBase | Test with a small curl script first to confirm field names before coding |
| Geist font licensing for Android | Geist is OFL-licensed — bundling in APK is permitted |
| KMP template overhead | Switch to pure Android module inside the existing project; remove KMP boilerplate |

---

*Review this plan and confirm. Once approved, implementation begins with Phase 1.*
