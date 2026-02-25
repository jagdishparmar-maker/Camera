import { getFullList, getOne, update } from "@/lib/database";
import { getFileUrl } from "@/lib/storage";
import type { Vehicle, VehicleStatus } from "@/lib/vehicle-types";
import { computeStatus, formatDateTime, STATUS_COLORS, STATUS_TEXT_COLORS } from "@/lib/vehicle-types";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Chip,
  Icon,
  IconButton,
  List,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";

const COLLECTION = "vehicles";
const DOCK_COUNT = 10;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

function DetailItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number | undefined;
  icon: string;
}) {
  const display = value != null && value !== "" ? String(value) : "—";
  return (
    <List.Item
      title={display}
      description={label}
      left={(props) => <List.Icon {...props} icon={icon} />}
      titleNumberOfLines={2}
    />
  );
}

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullImageVisible, setFullImageVisible] = useState(false);
  const [assignDockVisible, setAssignDockVisible] = useState(false);
  const [vehiclesByDock, setVehiclesByDock] = useState<Record<number, Vehicle>>({});
  const [assigning, setAssigning] = useState(false);
  const [loadingDocks, setLoadingDocks] = useState(false);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const loadVehicle = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const record = await getOne<Vehicle>(COLLECTION, id, {
        expand: "Checked_In_By,Checked_Out_By",
      });
      setVehicle(record);
    } catch (err) {
      console.error(err);
      setVehicle(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadVehicle();
  }, [loadVehicle]);

  const handleAssignDock = useCallback(
    async (dockNum: number) => {
      if (!id) return;
      setAssigning(true);
      try {
        const dockInTime = new Date().toISOString();
        await update<Vehicle>(COLLECTION, id, {
          Assigned_Dock: dockNum,
          Dock_In_DateTime: dockInTime,
          status: "DockedIn",
        });
        setAssignDockVisible(false);
        await loadVehicle();
      } catch (err) {
        console.error(err);
      } finally {
        setAssigning(false);
      }
    },
    [id, loadVehicle]
  );

  const getVehicleShareText = useCallback((v: Vehicle) => {
    const lines = [
      `Vehicle: ${v.vehicleno}`,
      `Type: ${v.Type ?? "—"}`,
      `Transport: ${v.Transport ?? "—"}`,
      `Customer: ${v.Customer ?? "—"}`,
      `Driver: ${v.Driver_Name ?? "—"}`,
      v.Check_In_Date ? `Check In: ${formatDateTime(v.Check_In_Date)}` : null,
      v.Assigned_Dock != null ? `Dock: ${v.Assigned_Dock}` : null,
    ].filter(Boolean);
    return lines.join("\n");
  }, []);

  const handleShare = useCallback(async () => {
    if (!vehicle) return;
    const shareText = getVehicleShareText(vehicle);
    try {
      if (vehicle.image && typeof vehicle.image === "string") {
        const imageUrl = getFileUrl(vehicle, vehicle.image);
        const filename = `vehicle-${vehicle.vehicleno.replace(/\s/g, "-")}.jpg`;
        const cachePath = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.downloadAsync(imageUrl, cachePath);
        const fileUrl = cachePath.startsWith("file://") ? cachePath : `file://${cachePath}`;
        if (Platform.OS === "ios") {
          await Share.share({
            message: shareText,
            url: fileUrl,
            title: "Vehicle Details",
          });
        } else {
          try {
            await Share.share({
              message: shareText,
              url: fileUrl,
              title: "Vehicle Details",
            });
          } catch {
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
              await Sharing.shareAsync(cachePath, {
                mimeType: "image/jpeg",
                dialogTitle: shareText,
              });
            } else {
              Share.share({ message: shareText, title: "Vehicle Details" });
            }
          }
        }
      } else {
        Share.share({ message: shareText, title: "Vehicle Details" });
      }
    } catch (err) {
      console.error(err);
      Share.share({ message: shareText, title: "Vehicle Details" }).catch(() => {
        Alert.alert("Error", "Could not open share dialog.");
      });
    }
  }, [vehicle, getVehicleShareText]);

  useEffect(() => {
    if (!vehicle) return;
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon="share-variant"
          size={22}
          iconColor="#FFFFFF"
          onPress={handleShare}
        />
      ),
    });
  }, [vehicle, navigation, handleShare]);

  const openAssignDock = useCallback(async () => {
    setAssignDockVisible(true);
    setLoadingDocks(true);
    try {
      const list = await getFullList<Vehicle>(COLLECTION, {
        expand: "Checked_In_By,Checked_Out_By",
      });
      const vehicles = Array.isArray(list) ? list : [];
      const occupied = vehicles
        .filter((v) => {
          const dock = v.Assigned_Dock;
          if (dock == null || dock < 1 || dock > DOCK_COUNT) return false;
          const s =
            v.status ??
            computeStatus({
              Check_Out_Date: v.Check_Out_Date,
              Dock_Out_DateTime: v.Dock_Out_DateTime,
              Assigned_Dock: v.Assigned_Dock,
              Dock_In_DateTime: v.Dock_In_DateTime,
            });
          return s !== "CheckedOut";
        })
        .reduce<Record<number, Vehicle>>((acc, v) => {
          acc[v.Assigned_Dock!] = v;
          return acc;
        }, {});
      setVehiclesByDock(occupied);
    } catch (err) {
      console.error(err);
      setVehiclesByDock({});
    } finally {
      setLoadingDocks(false);
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (!vehicle) {
    return null;
  }

  const detailStatus =
    vehicle.status ??
    computeStatus({
      Check_Out_Date: vehicle.Check_Out_Date,
      Dock_Out_DateTime: vehicle.Dock_Out_DateTime,
      Assigned_Dock: vehicle.Assigned_Dock,
      Dock_In_DateTime: vehicle.Dock_In_DateTime,
    });
  const detailStatusColor = STATUS_COLORS[detailStatus as VehicleStatus] ?? STATUS_COLORS.CheckedOut;
  const detailStatusTextColor = STATUS_TEXT_COLORS[detailStatus as VehicleStatus] ?? "#FFFFFF";

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {vehicle.image && (
        <View style={styles.hero}>
          <Pressable style={styles.heroImageWrap} onPress={() => setFullImageVisible(true)}>
            <Image
              source={{ uri: getFileUrl(vehicle, vehicle.image) }}
              style={styles.heroImage}
            />
          </Pressable>
          <View style={styles.heroOverlay}>
            <Chip
              style={[styles.statusChip, { backgroundColor: detailStatusColor }]}
              textStyle={[styles.statusText, { color: detailStatusTextColor }]}
            >
              {detailStatus.replace(/([A-Z])/g, " $1").trim().toUpperCase()}
            </Chip>
          </View>
        </View>
      )}
      <View style={styles.body}>
        <List.Section>
          <List.Subheader>Vehicle Info</List.Subheader>
          <DetailItem label="Vehicle" value={vehicle.vehicleno} icon="car" />
          <DetailItem label="Type" value={vehicle.Type} icon="swap-vertical" />
          <DetailItem
            label="Check In"
            value={vehicle.Check_In_Date ? formatDateTime(vehicle.Check_In_Date) : undefined}
            icon="calendar-clock"
          />
        </List.Section>
        <List.Section>
          <List.Subheader>Parties</List.Subheader>
          <DetailItem label="Transport" value={vehicle.Transport} icon="truck" />
          <DetailItem label="Customer" value={vehicle.Customer} icon="account" />
          <DetailItem label="Driver" value={vehicle.Driver_Name} icon="account" />
          <DetailItem label="Contact" value={vehicle.Contact_No} icon="phone" />
        </List.Section>
        <List.Section>
          <List.Subheader>Dock & Check Out</List.Subheader>
          {detailStatus === "CheckedIn" && (
            <List.Item
              title="Assign Dock"
              description="Assign a dock number and set status to Dock In"
              left={(props) => <List.Icon {...props} icon="warehouse" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={openAssignDock}
              style={styles.assignDockItem}
            />
          )}
          <DetailItem
            label="Assigned Dock"
            value={vehicle.Assigned_Dock != null ? String(vehicle.Assigned_Dock) : undefined}
            icon="warehouse"
          />
          <DetailItem
            label="Dock In"
            value={vehicle.Dock_In_DateTime ? formatDateTime(vehicle.Dock_In_DateTime) : undefined}
            icon="calendar"
          />
          <DetailItem
            label="Dock Out"
            value={vehicle.Dock_Out_DateTime ? formatDateTime(vehicle.Dock_Out_DateTime) : undefined}
            icon="calendar"
          />
          <DetailItem
            label="Check Out"
            value={vehicle.Check_Out_Date ? formatDateTime(vehicle.Check_Out_Date) : undefined}
            icon="calendar-check"
          />
        </List.Section>
        <List.Section>
          <List.Subheader>Share</List.Subheader>
          <List.Item
            title="Share to WhatsApp, Facebook..."
            description="Share image and vehicle details"
            left={(props) => <List.Icon {...props} icon="share-variant" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleShare}
            style={styles.assignDockItem}
          />
        </List.Section>
        <List.Section>
          <List.Subheader>Other</List.Subheader>
          <DetailItem label="Remarks" value={vehicle.Remarks} icon="note" />
          <DetailItem
            label="Checked In By"
            value={
              typeof vehicle.expand?.Checked_In_By === "object"
                ? vehicle.expand.Checked_In_By?.name ??
                  vehicle.expand.Checked_In_By?.email ??
                  vehicle.Checked_In_By
                : vehicle.Checked_In_By
            }
            icon="account-check"
          />
          <DetailItem
            label="Checked Out By"
            value={
              typeof vehicle.expand?.Checked_Out_By === "object"
                ? vehicle.expand.Checked_Out_By?.name ??
                  vehicle.expand.Checked_Out_By?.email ??
                  vehicle.Checked_Out_By
                : vehicle.Checked_Out_By
            }
            icon="account-check"
          />
        </List.Section>
      </View>

      <Modal
        visible={fullImageVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFullImageVisible(false)}
      >
        <Pressable
          style={styles.fullImageBackdrop}
          onPress={() => setFullImageVisible(false)}
        >
          <View style={styles.fullImageContainer}>
            <Image
              source={{ uri: getFileUrl(vehicle, vehicle.image) }}
              style={styles.fullImage}
              resizeMode="contain"
            />
            <IconButton
              icon="close"
              size={24}
              iconColor="#FFFFFF"
              style={[styles.fullImageClose, { top: insets.top + 8 }]}
              onPress={() => setFullImageVisible(false)}
            />
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={assignDockVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !assigning && setAssignDockVisible(false)}
      >
        <Pressable
          style={styles.dialogBackdrop}
          onPress={() => !assigning && setAssignDockVisible(false)}
        >
          <Pressable
            style={[styles.dialogContent, { backgroundColor: theme.colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.dialogHeader}>
              <Text variant="titleMedium" style={[styles.dialogTitle, { color: theme.colors.onSurface }]}>
                Assign Dock
              </Text>
              <IconButton
                icon="close"
                size={20}
                iconColor={theme.colors.onSurfaceVariant}
                onPress={() => !assigning && setAssignDockVisible(false)}
                style={styles.dialogCloseBtn}
              />
            </View>
            <Text variant="bodySmall" style={[styles.dialogSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Tap a free dock to assign {vehicle.vehicleno}
            </Text>
            {loadingDocks ? (
              <View style={styles.dockGridLoader}>
                <ActivityIndicator size="small" />
              </View>
            ) : (
              <View style={styles.dockGrid}>
                {Array.from({ length: DOCK_COUNT }, (_, i) => i + 1).map((dockNum) => {
                  const occupiedVehicle = vehiclesByDock[dockNum];
                  const isFree = !occupiedVehicle;
                  return (
                    <Pressable
                      key={dockNum}
                      onPress={() => isFree && !assigning && handleAssignDock(dockNum)}
                      disabled={!isFree || assigning}
                      style={({ pressed }) => [
                        styles.dockSlot,
                        pressed && isFree && styles.dockSlotPressed,
                      ]}
                    >
                      <Surface
                        style={[
                          styles.dockSlotSurface,
                          {
                            backgroundColor: isFree
                              ? theme.colors.primaryContainer
                              : theme.colors.surfaceVariant,
                            opacity: isFree ? 1 : 0.7,
                          },
                        ]}
                        elevation={0}
                      >
                        <Text
                          variant="labelMedium"
                          style={[
                            styles.dockSlotLabel,
                            {
                              color: isFree ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant,
                            },
                          ]}
                        >
                          DOCK{dockNum}
                        </Text>
                        {isFree ? (
                          <Icon source="plus" size={14} color={theme.colors.primary} />
                        ) : (
                          <Text
                            variant="labelSmall"
                            style={{ color: theme.colors.onSurfaceVariant }}
                            numberOfLines={1}
                          >
                            {occupiedVehicle.vehicleno}
                          </Text>
                        )}
                      </Surface>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  hero: { width: "100%", aspectRatio: 16 / 9, position: "relative" },
  heroImageWrap: { flex: 1, width: "100%", height: "100%" },
  heroImage: { width: "100%", height: "100%", resizeMode: "cover" },
  fullImageBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  fullImageClose: {
    position: "absolute",
    right: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  heroOverlay: { position: "absolute", bottom: 16, left: 16 },
  statusChip: { paddingHorizontal: 12 },
  statusText: { fontWeight: "700" },
  body: { paddingTop: 8 },
  assignDockItem: { backgroundColor: "transparent" },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dialogContent: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    padding: 16,
  },
  dialogHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  dialogTitle: { fontWeight: "600" },
  dialogCloseBtn: { margin: -8 },
  dialogSubtitle: { marginBottom: 12 },
  dockGridLoader: { paddingVertical: 32, alignItems: "center" },
  dockGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dockSlot: { width: "31%" },
  dockSlotPressed: { opacity: 0.8 },
  dockSlotSurface: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  dockSlotLabel: { fontWeight: "600", marginBottom: 2 },
});
