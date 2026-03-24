import { useNotification } from "@/contexts/NotificationContext";
import { VehicleListCard } from "@/components/VehicleListCard";
import { getFullList, update } from "@/lib/database";
import { useRealtime } from "@/hooks/use-realtime";
import type { Vehicle } from "@/lib/vehicle-types";
import { computeStatus } from "@/lib/vehicle-types";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import PagerView from "react-native-pager-view";
import {
  ActivityIndicator,
  Button,
  Icon,
  Searchbar,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

const COLLECTION = "vehicles";

export default function AllVehiclesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { showNotification } = useNotification();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeTab, setTypeTab] = useState<"Inward" | "Outward">("Inward");
  const pagerRef = useRef<PagerView>(null);
  const [exitVehicle, setExitVehicle] = useState<Vehicle | null>(null);
  const [exitCheckOutDate, setExitCheckOutDate] = useState(new Date());
  const [exitRemarks, setExitRemarks] = useState("");
  const [showExitModal, setShowExitModal] = useState(false);

  const filteredVehicles = searchQuery.trim()
    ? vehicles.filter(
        (v) =>
          v.vehicleno
            .toLowerCase()
            .includes(searchQuery.toLowerCase().trim()) ||
          (v.Customer?.toLowerCase().includes(
            searchQuery.toLowerCase().trim(),
          ) ?? false) ||
          (v.Driver_Name?.toLowerCase().includes(
            searchQuery.toLowerCase().trim(),
          ) ?? false) ||
          (v.Transport?.toLowerCase().includes(
            searchQuery.toLowerCase().trim(),
          ) ?? false),
      )
    : vehicles;

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
      const v = record as Vehicle;
      showNotification(`New vehicle checked in: ${v.vehicleno ?? "—"}`, {
        label: "View",
        onPress: () =>
          router.push({
            pathname: "/(tabs)/(home)/vehicle/[id]",
            params: { id: v.id, vehicleno: v.vehicleno ?? "" },
          }),
      });
      loadVehicles(true);
    } else if (action === "update") {
      setVehicles((prev) =>
        prev.map((v) => (v.id === record.id ? { ...v, ...record } : v)),
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
        setExitVehicle(null);
        setExitRemarks("");
        setShowExitModal(false);
        await loadVehicles(true);
        showNotification("Vehicle checked out successfully.");
      } catch (err) {
        console.error(err);
        Alert.alert(
          "Check out failed",
          "Could not update the vehicle. Check your connection and try again.",
        );
      }
    },
    [loadVehicles, showNotification],
  );

  const openAndroidDateTimePicker = useCallback(
    (onSelect: (d: Date) => void) => {
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
    },
    [],
  );

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

  const openVehicleDetail = useCallback(
    (v: Vehicle) => {
      router.push({
        pathname: "/(tabs)/(home)/vehicle/[id]",
        params: { id: v.id, vehicleno: v.vehicleno },
      });
    },
    [router],
  );

  const renderVehicleItem = useCallback(
    ({ item }: { item: Vehicle }) => {
      const s =
        item.status ??
        computeStatus({
          Check_Out_Date: item.Check_Out_Date,
          Dock_Out_DateTime: item.Dock_Out_DateTime,
          Assigned_Dock: item.Assigned_Dock,
          Dock_In_DateTime: item.Dock_In_DateTime,
        });
      return (
        <VehicleListCard
          item={item}
          onPressDetail={openVehicleDetail}
          onCheckOut={handleExitPress}
          showCheckOut={s === "DockedOut"}
        />
      );
    },
    [openVehicleDetail, handleExitPress],
  );

  const ListEmpty = () => (
    <View style={styles.emptyState}>
      <Surface
        style={[
          styles.emptyIconWrap,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
        elevation={0}
      >
        <Icon source="car-side" size={64} color={theme.colors.primary} />
      </Surface>
      <Text
        variant="titleMedium"
        style={[styles.emptyTitle, { color: theme.colors.onSurface }]}
      >
        {typeTab === "Inward" ? "No inward vehicles" : "No outward vehicles"}
      </Text>
      <Text
        variant="bodyMedium"
        style={[
          styles.emptySubtitle,
          { color: theme.colors.onSurfaceVariant },
        ]}
      >
        {searchQuery.trim()
          ? "No matches for your search"
          : "Tap the + button on home to add a vehicle"}
      </Text>
    </View>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.safeTop}>
        <Searchbar
          placeholder="Search vehicles..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
          elevation={0}
        />
        <SegmentedButtons
          value={typeTab}
          onValueChange={(v) => {
            const tab = v as "Inward" | "Outward";
            setTypeTab(tab);
            pagerRef.current?.setPage(tab === "Inward" ? 0 : 1);
          }}
          buttons={[
            {
              value: "Inward",
              label: `Inward (${inwardVehicles.length})`,
              icon: "arrow-down",
            },
            {
              value: "Outward",
              label: `Outward (${outwardVehicles.length})`,
              icon: "arrow-up",
            },
          ]}
          style={styles.typeTabs}
        />
      </View>

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
            <FlatList
              data={inwardVehicles}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={ListEmpty}
              renderItem={renderVehicleItem}
            />
          </View>
          <View key="outward" style={styles.pagerPage}>
            <FlatList
              data={outwardVehicles}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={ListEmpty}
              renderItem={renderVehicleItem}
            />
          </View>
        </PagerView>
      )}

      {showExitModal && exitVehicle && (
        <Modal visible transparent animationType="slide">
          <KeyboardAvoidingView
            style={styles.exitModalAvoid}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <Pressable
              style={styles.exitModalBackdrop}
              onPress={() => {
                setExitVehicle(null);
                setExitRemarks("");
                setShowExitModal(false);
              }}
            >
              <KeyboardAwareScrollView
                keyboardShouldPersistTaps="handled"
                enableOnAndroid
                enableAutomaticScroll
                enableResetScrollToCoords={false}
                extraScrollHeight={Platform.OS === "ios" ? 28 : 40}
                extraHeight={80}
                bounces={false}
                showsVerticalScrollIndicator={false}
                style={styles.exitModalScroll}
                nestedScrollEnabled
              >
                <Pressable
                  style={[
                    styles.exitModalContent,
                    { backgroundColor: theme.colors.surface },
                  ]}
                  onPress={(e) => e.stopPropagation()}
                >
              <Text
                variant="titleMedium"
                style={[
                  styles.exitModalTitle,
                  { color: theme.colors.onSurface },
                ]}
              >
                Check Out {exitVehicle.vehicleno}
              </Text>
              <Text
                variant="bodySmall"
                style={[
                  styles.exitModalSubtitle,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Select check out date & time
              </Text>
              {Platform.OS === "ios" ? (
                <DateTimePicker
                  value={exitCheckOutDate}
                  mode="datetime"
                  display="spinner"
                  onChange={(_d, d) => d && setExitCheckOutDate(d)}
                  accentColor={theme.colors.primary}
                  themeVariant="dark"
                />
              ) : (
                <Pressable
                  onPress={() =>
                    openAndroidDateTimePicker((d) => setExitCheckOutDate(d))
                  }
                  style={[
                    styles.exitDateSurface,
                    { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                >
                  <Icon
                    source="calendar-clock"
                    size={20}
                    color={theme.colors.primary}
                  />
                  <Text
                    variant="bodyMedium"
                    style={[
                      styles.exitDateText,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    {exitCheckOutDate.toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </Text>
                  <Icon
                    source="chevron-down"
                    size={20}
                    color={theme.colors.onSurfaceVariant}
                  />
                </Pressable>
              )}
              <Text
                variant="labelSmall"
                style={[
                  styles.exitRemarksLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
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
              </KeyboardAwareScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeTop: { backgroundColor: "#2C2C2E", paddingHorizontal: 16, paddingTop: 0, paddingBottom: 12 },
  searchbar: {
    borderRadius: 12,
    backgroundColor: "#3A3A3C",
    elevation: 0,
    marginBottom: 12,
  },
  typeTabs: { marginBottom: 12 },
  pager: { flex: 1 },
  pagerPage: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: { marginBottom: 8 },
  emptySubtitle: { textAlign: "center" },
  exitModalAvoid: { flex: 1 },
  exitModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  exitModalScroll: { width: "100%", maxHeight: "92%" },
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
  exitModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
  },
  exitModalBtn: { minWidth: 100 },
});
