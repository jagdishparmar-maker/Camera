import { getFullList, update } from "@/lib/database";
import { getFileUrl } from "@/lib/storage";
import { useRealtime } from "@/hooks/use-realtime";
import type { Vehicle, VehicleStatus } from "@/lib/vehicle-types";
import { computeStatus, STATUS_COLORS, STATUS_TEXT_COLORS } from "@/lib/vehicle-types";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  UIManager,
  View,
} from "react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import PagerView from "react-native-pager-view";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  FAB,
  Icon,
  IconButton,
  Searchbar,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

const COLLECTION = "vehicles";

function formatCheckInDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeTab, setTypeTab] = useState<"Inward" | "Outward">("Inward");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const pagerRef = useRef<PagerView>(null);

  const toggleSearch = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchExpanded((prev) => !prev);
  }, []);

  const collapseSearch = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchExpanded(false);
  }, []);
  const [exitVehicle, setExitVehicle] = useState<Vehicle | null>(null);
  const [exitCheckOutDate, setExitCheckOutDate] = useState(new Date());
  const [exitRemarks, setExitRemarks] = useState("");
  const [showExitModal, setShowExitModal] = useState(false);

  const filteredVehicles = (searchQuery.trim()
    ? vehicles.filter(
        (v) =>
          v.vehicleno.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
          (v.Customer?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ?? false) ||
          (v.Driver_Name?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ?? false)
      )
    : vehicles
  ).filter((v) => {
    const s = v.status ?? computeStatus({
      Check_Out_Date: v.Check_Out_Date,
      Dock_Out_DateTime: v.Dock_Out_DateTime,
      Assigned_Dock: v.Assigned_Dock,
      Dock_In_DateTime: v.Dock_In_DateTime,
    });
    return s !== "CheckedOut";
  });

  const inwardVehicles = filteredVehicles.filter((v) => v.Type === "Inward");
  const outwardVehicles = filteredVehicles.filter((v) => v.Type === "Outward");

  const loadVehicles = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const list = await getFullList<Vehicle>(COLLECTION, {
        expand: "Checked_In_By,Checked_Out_By",
        sort: "-created",
      });
      setVehicles(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error(err);
      setVehicles([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadVehicles(true);
    setRefreshing(false);
  }, [loadVehicles]);

  useRealtime<Vehicle>(COLLECTION, (action, record) => {
    if (action === "create") {
      loadVehicles(true);
    } else if (action === "update") {
      setVehicles((prev) =>
        prev.map((v) => (v.id === record.id ? { ...v, ...record } : v))
      );
    } else if (action === "delete") {
      setVehicles((prev) => prev.filter((v) => v.id !== record.id));
    }
  });

  const performCheckOut = useCallback(
    async (vehicleId: string, checkOutDate: Date, remarks?: string) => {
      try {
        await update<Vehicle>(COLLECTION, vehicleId, {
          status: "CheckedOut",
          Check_Out_Date: checkOutDate.toISOString(),
          ...(remarks?.trim() && { Remarks: remarks.trim() }),
        });
      } catch (err) {
        console.error(err);
      } finally {
        setExitVehicle(null);
        setExitRemarks("");
        setShowExitModal(false);
      }
    },
    []
  );

  const openAndroidDateTimePicker = useCallback((onSelect: (d: Date) => void) => {
    let selectedDate = new Date();
    DateTimePickerAndroid.open({
      value: selectedDate,
      mode: "date",
      display: "default",
      onChange: (_e, date) => {
        if (date) {
          selectedDate = date;
          DateTimePickerAndroid.open({
            value: date,
            mode: "time",
            display: "default",
            onChange: (_e2, time) => {
              if (time) onSelect(time);
            },
          });
        }
      },
    });
  }, []);

  const handleExitPress = useCallback((vehicle: Vehicle) => {
    setExitVehicle(vehicle);
    setExitCheckOutDate(new Date());
    setExitRemarks("");
    setShowExitModal(true);
  }, []);

  const handleExitConfirm = useCallback(() => {
    if (exitVehicle) {
      performCheckOut(exitVehicle.id, exitCheckOutDate, exitRemarks);
    }
  }, [exitVehicle, exitCheckOutDate, exitRemarks, performCheckOut]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView edges={["top"]} style={styles.safeTop}>
        <View style={styles.header}>
          {!searchExpanded && (
            <View style={styles.headerLeft}>
              <Avatar.Text size={40} label="FM" style={styles.avatar} />
              <View>
                <Text variant="titleMedium" style={styles.headerName}>
                  Fleet Manager
                </Text>
                <Text variant="bodySmall" style={styles.headerSub}>
                  {vehicles.length} vehicles
                </Text>
              </View>
            </View>
          )}
          <View style={[styles.headerRight, searchExpanded && styles.headerRightExpanded]}>
            {searchExpanded ? (
              <>
                <Searchbar
                  placeholder="Track vehicle..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={styles.headerSearchbar}
                  inputStyle={styles.searchInput}
                  iconColor={theme.colors.onSurfaceVariant}
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                  elevation={0}
                  autoFocus
                />
                <IconButton
                  icon="close"
                  size={22}
                  iconColor={theme.colors.onSurface}
                  onPress={collapseSearch}
                  style={styles.headerIconBtn}
                />
              </>
            ) : (
              <>
                <IconButton icon="bell-outline" size={22} iconColor={theme.colors.onSurface} style={styles.headerIconBtn} />
                <IconButton icon="magnify" size={22} iconColor={theme.colors.onSurface} onPress={toggleSearch} style={styles.headerIconBtn} />
                <IconButton icon="dots-vertical" size={22} iconColor={theme.colors.onSurface} style={styles.headerIconBtn} />
              </>
            )}
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroContent}>
            <Text variant="titleLarge" style={styles.heroTitle}>
              Vehicles
            </Text>
            <Text variant="bodyMedium" style={styles.heroSubtitle}>
              See all
            </Text>
          </View>
        </View>

        <SegmentedButtons
          value={typeTab}
          onValueChange={(v) => {
            const tab = v as "Inward" | "Outward";
            setTypeTab(tab);
            pagerRef.current?.setPage(tab === "Inward" ? 0 : 1);
          }}
          buttons={[
            { value: "Inward", label: `Inward (${inwardVehicles.length})`, icon: "arrow-down" },
            { value: "Outward", label: `Outward (${outwardVehicles.length})`, icon: "arrow-up" },
          ]}
          style={styles.typeTabs}
        />
      </SafeAreaView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={0}
          onPageSelected={(e) => {
            setTypeTab(e.nativeEvent.position === 0 ? "Inward" : "Outward");
          }}
        >
          <View key="inward" style={styles.pagerPage}>
            <VehicleList
              data={inwardVehicles}
              refreshing={refreshing}
              onRefresh={onRefresh}
              theme={theme}
              router={router}
              emptyMessage="No inward vehicles"
              onExitPress={handleExitPress}
            />
          </View>
          <View key="outward" style={styles.pagerPage}>
            <VehicleList
              data={outwardVehicles}
              refreshing={refreshing}
              onRefresh={onRefresh}
              theme={theme}
              router={router}
              emptyMessage="No outward vehicles"
              onExitPress={handleExitPress}
            />
          </View>
        </PagerView>
      )}

      <FAB
        icon="plus"
        label="Add"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color="#1A1A1A"
        onPress={() => router.push("/(tabs)/(home)/add")}
      />

      {showExitModal && exitVehicle && (
        <Modal visible transparent animationType="slide">
          <Pressable
            style={styles.exitModalBackdrop}
            onPress={() => {
              setExitVehicle(null);
              setExitRemarks("");
              setShowExitModal(false);
            }}
          >
            <Pressable
              style={[styles.exitModalContent, { backgroundColor: theme.colors.surface }]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text variant="titleMedium" style={[styles.exitModalTitle, { color: theme.colors.onSurface }]}>
                Check Out {exitVehicle.vehicleno}
              </Text>
              <Text variant="bodySmall" style={[styles.exitModalSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                Select check out date & time
              </Text>
              {Platform.OS === "ios" ? (
                <DateTimePicker
                  value={exitCheckOutDate}
                  mode="datetime"
                  display="spinner"
                  onChange={(_, d) => d && setExitCheckOutDate(d)}
                  accentColor={theme.colors.primary}
                  themeVariant="dark"
                />
              ) : (
                <Pressable
                  onPress={() =>
                    openAndroidDateTimePicker((d) => setExitCheckOutDate(d))
                  }
                  style={[styles.exitDateSurface, { backgroundColor: theme.colors.surfaceVariant }]}
                >
                  <Icon source="calendar-clock" size={20} color={theme.colors.primary} />
                  <Text variant="bodyMedium" style={[styles.exitDateText, { color: theme.colors.onSurface }]}>
                    {exitCheckOutDate.toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </Text>
                  <Icon source="chevron-down" size={20} color={theme.colors.onSurfaceVariant} />
                </Pressable>
              )}
              <Text variant="labelSmall" style={[styles.exitRemarksLabel, { color: theme.colors.onSurfaceVariant }]}>
                Remarks (optional)
              </Text>
              <TextInput
                mode="outlined"
                placeholder="Add remarks..."
                value={exitRemarks}
                onChangeText={setExitRemarks}
                multiline
                numberOfLines={3}
                style={styles.exitRemarksInput}
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
                textColor={theme.colors.onSurface}
              />
              <View style={styles.exitModalActions}>
                <Button
                  mode="outlined"
                  onPress={() => {
                    setExitVehicle(null);
                    setExitRemarks("");
                    setShowExitModal(false);
                  }}
                  style={styles.exitModalBtn}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleExitConfirm}
                  icon="exit-to-app"
                  style={styles.exitModalBtn}
                >
                  Check Out
                </Button>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

function VehicleList({
  data,
  refreshing,
  onRefresh,
  theme,
  router,
  emptyMessage,
  onExitPress,
}: {
  data: Vehicle[];
  refreshing: boolean;
  onRefresh: () => void;
  theme: ReturnType<typeof useTheme>;
  router: ReturnType<typeof useRouter>;
  emptyMessage: string;
  onExitPress: (vehicle: Vehicle) => void;
}) {
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Surface style={[styles.emptyIconWrap, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
            <Icon source="car-side" size={64} color={theme.colors.primary} />
          </Surface>
          <Text variant="titleMedium" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
            {emptyMessage}
          </Text>
          <Text variant="bodyMedium" style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
            Tap the + button to add a vehicle
          </Text>
          <Button
            mode="contained"
            icon="plus"
            onPress={() => router.push("/(tabs)/(home)/add")}
            style={styles.emptyButton}
          >
            Add Vehicle
          </Button>
        </View>
      }
      renderItem={({ item }) => {
            const imgUri =
              item.image && typeof item.image === "string"
                ? getFileUrl(item, item.image)
                : "";
            const s =
              item.status ??
              computeStatus({
                Check_Out_Date: item.Check_Out_Date,
                Dock_Out_DateTime: item.Dock_Out_DateTime,
                Assigned_Dock: item.Assigned_Dock,
                Dock_In_DateTime: item.Dock_In_DateTime,
              });
            const statusColor = STATUS_COLORS[s as VehicleStatus] ?? STATUS_COLORS.CheckedOut;
            return (
              <View style={styles.cardPressable}>
                <Card style={[styles.vehicleCard, { backgroundColor: theme.colors.surface }]} mode="elevated">
                  <Card.Content style={styles.cardContent}>
                    <Pressable
                      style={({ pressed }) => [styles.cardMainPressable, pressed && styles.cardPressed]}
                      onPress={() => router.push({ pathname: "/(tabs)/(home)/vehicle/[id]", params: { id: item.id, vehicleno: item.vehicleno } })}
                    >
                      {imgUri ? (
                        <Image source={{ uri: imgUri }} style={styles.cardImage} />
                      ) : (
                        <Surface style={[styles.cardImagePlaceholder, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
                          <Icon source="car" size={20} color={theme.colors.primary} />
                        </Surface>
                      )}
                      <View style={styles.cardInfo}>
                        <Text variant="titleSmall" style={{ color: theme.colors.onSurface }} numberOfLines={1}>
                          {item.vehicleno}
                        </Text>
                        <Text variant="bodySmall" style={styles.cardMeta} numberOfLines={1}>
                          {item.Type ?? "—"} • {item.Transport || "—"}
                        </Text>
                        {item.Check_In_Date && (
                          <Text variant="labelSmall" style={[styles.cardCheckIn, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                            {formatCheckInDate(item.Check_In_Date)}
                          </Text>
                        )}
                      </View>
                      <Chip
                        style={[styles.statusChip, { backgroundColor: statusColor }]}
                        textStyle={[styles.statusChipText, { color: STATUS_TEXT_COLORS[s as VehicleStatus] ?? "#FFFFFF" }]}
                      >
                        {s.replace(/([A-Z])/g, " $1").trim().toUpperCase()}
                      </Chip>
                    </Pressable>
                    {s === "DockedOut" && (
                      <IconButton
                        icon="exit-to-app"
                        size={22}
                        iconColor={theme.colors.primary}
                        onPress={() => onExitPress(item)}
                        style={styles.exitIconBtn}
                      />
                    )}
                  </Card.Content>
                </Card>
              </View>
            );
          }}
        />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeTop: { backgroundColor: "#2C2C2E" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 0 },
  headerRightExpanded: { flex: 1, minWidth: 0 },
  headerSearchbar: { flex: 1, borderRadius: 12, backgroundColor: "#3A3A3C", elevation: 0, marginRight: 4 },
  headerIconBtn: { margin: 0 },
  avatar: { backgroundColor: "#3A3A3C" },
  headerName: { color: "#FFFFFF", fontWeight: "600" },
  headerSub: { color: "#A0A0A0", marginTop: 2 },
  searchInput: { color: "#FFFFFF" },
  hero: { paddingHorizontal: 20, paddingBottom: 16 },
  heroContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroTitle: { color: "#FFFFFF", fontWeight: "600" },
  heroSubtitle: { color: "#8CE02A", fontSize: 14 },
  typeTabs: { marginHorizontal: 20, marginBottom: 12 },
  pager: { flex: 1 },
  pagerPage: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  emptyIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: { marginBottom: 8 },
  emptySubtitle: { marginBottom: 24, textAlign: "center" },
  emptyButton: { borderRadius: 12 },
  cardPressable: { marginBottom: 8 },
  cardMainPressable: { flex: 1, flexDirection: "row", alignItems: "center" },
  cardPressed: { opacity: 0.9 },
  exitIconBtn: { margin: 0 },
  vehicleCard: { borderRadius: 12, overflow: "hidden", elevation: 0 },
  cardContent: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12 },
  cardImage: { width: 44, height: 44, borderRadius: 8, marginRight: 12 },
  cardImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: { flex: 1, minWidth: 0 },
  cardMeta: { marginTop: 2, color: "#A0A0A0", fontSize: 12 },
  cardCheckIn: { marginTop: 2, fontSize: 11, opacity: 0.9 },
  statusChip: { marginLeft: 8 },
  statusChipText: { fontWeight: "600", fontSize: 10 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    borderRadius: 16,
  },
  exitModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  exitModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  exitModalTitle: { fontWeight: "600", marginBottom: 4 },
  exitModalSubtitle: { marginBottom: 16 },
  exitDateSurface: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  exitDateText: { flex: 1, marginLeft: 12 },
  exitRemarksLabel: { marginBottom: 8 },
  exitRemarksInput: { marginBottom: 20 },
  exitModalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 16 },
  exitModalBtn: { minWidth: 100 },
});
