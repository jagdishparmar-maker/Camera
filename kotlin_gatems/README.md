This is a Kotlin Multiplatform project targeting Android.

- [/composeApp](./composeApp/src) is for code that will be shared across your Compose Multiplatform applications.
  It contains several subfolders:
  - [commonMain](./composeApp/src/commonMain/kotlin) is for code that’s common for all targets.
  - Other folders are for Kotlin code that will be compiled for only the platform indicated in the folder name.
    For example, if you want to use Apple’s CoreCrypto for the iOS part of your Kotlin app,
    the [iosMain](./composeApp/src/iosMain/kotlin) folder would be the right place for such calls.
    Similarly, if you want to edit the Desktop (JVM) specific part, the [jvmMain](./composeApp/src/jvmMain/kotlin)
    folder is the appropriate location.

### Build and Run Android Application

To build and run the development version of the Android app, use the run configuration from the run widget
in your IDE’s toolbar or build it directly from the terminal:

- on macOS/Linux

  ```shell
  ./gradlew :composeApp:assembleDebug
  ```

- on Windows

  ```shell
  .\gradlew.bat :composeApp:assembleDebug
  ```

---

Learn more about [Kotlin Multiplatform](https://www.jetbrains.com/help/kotlin-multiplatform-dev/get-started.html)…

P0 — Quick wins (1–3 days each, high impact)
Pull-to-refresh consistency — Dock & All-Vehicles screens should use the same PullToRefreshBox that Home has, with a shared snackbar on failure.
Offline mode with Room cache — Cache the last loaded vehicles/customers locally. Show stale data with a subtle "Last synced X ago" banner when offline.
Retry button on error states — Every HomeUiState.Error/list-error card currently shows the message only. Add a "Retry" button.
Optimistic UI for check-out — When user checks out a vehicle, remove it from the active list immediately; rollback if the API call fails.
Swipe actions on vehicle cards — Swipe right to call, swipe left to check-out (or reveal edit/delete on long-press).
Empty-state illustrations — Replace the plain "No vehicles" text with a small illustration + primary CTA ("Add your first vehicle").
Snackbar undo for delete — After deleting a vehicle in Detail, show "Vehicle deleted · UNDO" for 5s.
Haptics — Light haptic on check-in/check-out success, success-style haptic on save, error haptic on auth failure.
Biometric unlock — After initial login, let returning users unlock with fingerprint/face instead of re-entering password.
Remember-me on login — Persist the last email and pre-fill it; offer a "Stay signed in" toggle.
P1 — Core UX upgrades (3–7 days each)
Global search across vehicles + customers — From Home's search icon, search by plate, customer name, or phone. Debounced, with recent-searches section.
Filters & sort on All Vehicles — Filter by status (active / checked-out / all), date range, vehicle type, owner; sort by entry time / plate / duration.
Vehicle tags / categories — Add custom tags (VIP, Staff, Delivery, Visitor) with colored chips on cards, and filter by tag.
Duration on active cards — Show live-ticking "Inside for 2h 14m" on Home; highlight cards exceeding a configurable threshold (e.g., > 4h) in warning color.
QR / Barcode plate scan — Scan a plate number or vehicle pass QR to auto-fill Add/Check-out instead of typing.
Photo capture on check-in — Attach a photo of the vehicle and/or driver ID to the record (stored as PocketBase file field), shown on Detail.
Signature capture on check-out — Finger-draw signature pad for delivery/vendor vehicles.
Customer directory screen — First-class "Customers" tab or submenu: list, create, edit, view vehicle history per customer.
Vehicle history timeline — On Detail, show a timeline of all prior check-ins/outs with durations and who handled them.
Bulk actions — Multi-select on Dock to bulk-checkout or bulk-tag.
Check-out bottom sheet presets — Quick-pick chips: "Now", "+15 min", "+1 hr", "Custom…" instead of only date+time pickers.
Duplicate-plate guard — When adding a plate that matches an already-active vehicle, show an inline warning with a "View active record" link.
Smart autocomplete — While typing plate/owner name in Add/Edit, suggest previously seen values from local history.
Proper form validation with inline errors — Per-field validators (plate format, phone number, required) with accessible error text, not just a toast.
P2 — Platform & polish
Push notifications (FCM) — Alerts for overstay vehicles, new inward entries by another operator, session expired, realtime-disconnected.
In-app notification center — The bell icon on Home currently has no destination; build a list view of system events (session expiry, sync failures, overstay alerts).
Dark mode + Material You dynamic theming — Follow system theme; allow manual override in Settings. On Android 12+, sample wallpaper colors.
Multi-language / RTL — Extract strings to strings.xml, add Arabic/Hindi locales; app already has AutoMirrored icons so RTL is partially ready.
Accessibility pass — contentDescription on every icon button, min 48dp touch targets, semantics { } on custom cards, TalkBack ordering, large-font testing.
Tablet / foldable layout — Two-pane list/detail on WindowSizeClass == Expanded.
Widget + Quick Settings tile — Home-screen widget showing "N vehicles inside" with tap-to-open; QS tile to jump straight to Add Vehicle.
Shortcuts (App Actions) — Long-press launcher icon: "Add Vehicle", "Scan Plate", "Today's Report".
Share & export — Share a vehicle record as text/PDF; export a date-range report as CSV.
In-app barcode/QR for the record itself — Each vehicle gets a QR encoding its id so a guard can re-scan on exit.
P3 — Analytics / admin / ops
Dashboard / reports screen — Per-day / week / month counts, peak hours, average dwell time, top customers. Simple charts (Vico or Compose Canvas).
Audit log — Who created/edited/checked-out each record (paired with a PocketBase operator field); visible on Detail.
Roles & permissions UI — If PocketBase has roles, hide delete/edit for guard-level accounts; show "read-only" ribbon.
Shift handover — End-of-shift summary: vehicles still inside, entries/exits during shift, notes to next operator.
Operator notes on a vehicle — Free-text notes field timestamped per author (useful for "damaged bumper at entry", "VIP – do not stop").
Blacklist / watchlist — Flag plates; Add flow warns in red if plate is on the list.
P4 — Performance, reliability, dev-quality
Paging 3 for All Vehicles — Large datasets will eventually break LazyColumn with a single getActiveVehicles(); switch to paged loading with cursor.
Request retry with exponential backoff — Wrap Ktor calls; distinguish transient (5xx, network) vs permanent (4xx).
Structured logging + crash reporting — Wire up Sentry (already configured in your Cursor plugins) or Firebase Crashlytics.
Deeplinks — gatems://vehicle/<id> and https://…/v/<id> open Detail directly; useful for FCM and shared links.
Background sync with WorkManager — Periodic reconciliation if SSE drops, and queued retry of failed mutations created offline.
Connection indicator — Already have ConnectivityBanner; enhance with "Reconnecting… / Live" status tied to the SSE client, not just network.
Secure storage audit — Move the auth token from DataStore to EncryptedDataStore / Keystore-wrapped storage.
Certificate pinning — For production PocketBase URL.
Screenshot/obscure on background — FLAG_SECURE while app is backgrounded to hide sensitive data on recents.
ViewModel unit tests + screenshot tests — Paparazzi or Roborazzi for the cards/screens; tests for token refresh and check-out state machines.
P5 — Delightful extras
Onboarding carousel for first-time users (3–4 screens explaining tabs, Add, and check-out).
"Today" summary card on Home top — "14 inside · 28 in · 14 out today".
Customer photo / avatar — Initials-colored chip on cards; tap to view profile.
Map on Detail — If you ever capture GPS at check-in, show a small map tile.
Voice entry — "Add Toyota white KA-01 AB 1234 for John Doe" → auto-fills the form via Speech-to-text.
