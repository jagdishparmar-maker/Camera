import { getFullList, getOne, remove, update } from "@/lib/database";
import { getFileUrl } from "@/lib/storage";
import type { Vehicle, VehicleStatus } from "@/lib/vehicle-types";
import { computeStatus, formatDateTime, STATUS_COLORS, STATUS_TEXT_COLORS } from "@/lib/vehicle-types";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
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
  Button,
  Chip,
  Divider,
  Icon,
  IconButton,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";

const COLLECTION = "vehicles";
const DOCK_COUNT = 10;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

function humanStatus(s: VehicleStatus): string {
  const m: Record<VehicleStatus, string> = {
    CheckedIn: "Checked in",
    CheckedOut: "Checked out",
    DockedIn: "At dock",
    DockedOut: "Left dock",
  };
  return m[s] ?? s;
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
  const router = useRouter();

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
    async (dockNum: number, currentVehicle: Vehicle) => {
      if (!id) return;
      if (currentVehicle.Assigned_Dock === dockNum) {
        setAssignDockVisible(false);
        return;
      }
      setAssigning(true);
      try {
        const hadDock =
          currentVehicle.Assigned_Dock != null &&
          currentVehicle.Assigned_Dock >= 1 &&
          currentVehicle.Assigned_Dock <= DOCK_COUNT;
        const wasDockedOutOnSite =
          !!currentVehicle.Dock_Out_DateTime && !currentVehicle.Check_Out_Date;

        const payload: Record<string, unknown> = {
          Assigned_Dock: dockNum,
          status: "DockedIn" as VehicleStatus,
        };
        if (!hadDock || wasDockedOutOnSite) {
          payload.Dock_In_DateTime = new Date().toISOString();
        }
        if (wasDockedOutOnSite) {
          payload.Dock_Out_DateTime = null;
        }

        await update<Vehicle>(COLLECTION, id, payload);
        setAssignDockVisible(false);
        await loadVehicle();
      } catch (err) {
        console.error(err);
        Alert.alert(
          "Could not update dock",
          err instanceof Error ? err.message : "Please try again.",
        );
      } finally {
        setAssigning(false);
      }
    },
    [id, loadVehicle],
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

  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(() => {
    if (!id) return;
    Alert.alert(
      "Delete Vehicle",
      `Are you sure you want to delete ${vehicle?.vehicleno ?? "this vehicle"}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await remove(COLLECTION, id);
              router.back();
            } catch (err) {
              console.error(err);
              Alert.alert("Error", "Could not delete vehicle.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [id, vehicle?.vehicleno, router]);

  const handleEdit = useCallback(() => {
    if (!id) return;
    router.push({
      pathname: "/(tabs)/(home)/vehicle/edit/[id]",
      params: { id },
    });
  }, [id, router]);

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

  const openDockPicker = useCallback(async () => {
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

  const onSite = !vehicle.Check_Out_Date;
  const hasDockAssigned =
    vehicle.Assigned_Dock != null &&
    vehicle.Assigned_Dock >= 1 &&
    vehicle.Assigned_Dock <= DOCK_COUNT;
  const canManageDock = onSite;

  const expandUser = (
    expand: Vehicle["expand"],
    key: "Checked_In_By" | "Checked_Out_By",
    fallback?: string,
  ) => {
    const u = expand?.[key];
    if (typeof u === "object" && u != null) {
      return u.name ?? u.email ?? fallback ?? "—";
    }
    return fallback ?? "—";
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      {vehicle.image ? (
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
              {humanStatus(detailStatus as VehicleStatus).toUpperCase()}
            </Chip>
          </View>
        </View>
      ) : (
        <Surface style={styles.heroPlaceholder} elevation={0}>
          <Icon source="car-side" size={56} color={theme.colors.primary} />
          <Text variant="headlineSmall" style={styles.heroPlaceholderTitle}>
            {vehicle.vehicleno}
          </Text>
          <Chip
            style={[styles.statusChip, { backgroundColor: detailStatusColor, marginTop: 8 }]}
            textStyle={[styles.statusText, { color: detailStatusTextColor }]}
          >
            {humanStatus(detailStatus as VehicleStatus).toUpperCase()}
          </Chip>
        </Surface>
      )}

      {/* Title strip (when photo exists) */}
      {vehicle.image ? (
        <Surface style={styles.titleStrip} elevation={0}>
          <Text variant="headlineSmall" style={styles.titleStripText}>
            {vehicle.vehicleno}
          </Text>
          {vehicle.Type ? (
            <Text variant="labelMedium" style={styles.titleStripMeta}>
              {vehicle.Type}
            </Text>
          ) : null}
        </Surface>
      ) : null}

      {/* Dock — primary operational block */}
      <Surface style={styles.card} elevation={1}>
        <Text variant="labelSmall" style={styles.cardEyebrow}>
          Dock
        </Text>
        {!onSite ? (
          <Text variant="bodyMedium" style={styles.muted}>
            Vehicle has checked out — dock actions are not available.
          </Text>
        ) : (
          <>
            <View style={styles.dockHighlightRow}>
              {hasDockAssigned ? (
                <>
                  <View style={styles.dockBig}>
                    <Text variant="displaySmall" style={styles.dockBigNum}>
                      {vehicle.Assigned_Dock}
                    </Text>
                    <Text variant="labelMedium" style={styles.muted}>
                      Assigned bay
                    </Text>
                  </View>
                  <View style={styles.dockMetaCol}>
                    {vehicle.Dock_In_DateTime ? (
                      <Text variant="bodySmall" style={styles.dockMetaLine}>
                        In: {formatDateTime(vehicle.Dock_In_DateTime)}
                      </Text>
                    ) : null}
                    {vehicle.Dock_Out_DateTime ? (
                      <Text variant="bodySmall" style={styles.dockMetaLine}>
                        Out: {formatDateTime(vehicle.Dock_Out_DateTime)}
                      </Text>
                    ) : null}
                  </View>
                </>
              ) : (
                <Text variant="bodyLarge" style={styles.noDockText}>
                  No dock assigned yet
                </Text>
              )}
            </View>
            {canManageDock ? (
              <Button
                mode="contained"
                icon={hasDockAssigned ? "swap-horizontal" : "warehouse"}
                onPress={openDockPicker}
                style={styles.dockCta}
                contentStyle={styles.dockCtaContent}
              >
                {hasDockAssigned ? "Change dock" : "Assign dock"}
              </Button>
            ) : null}
          </>
        )}
      </Surface>

      {/* People & logistics */}
      <Surface style={styles.card} elevation={1}>
        <Text variant="labelSmall" style={styles.cardEyebrow}>
          People & logistics
        </Text>
        <InfoRow icon="truck" label="Transport" value={vehicle.Transport} />
        <Divider style={styles.divider} />
        <InfoRow icon="account-tie" label="Customer" value={vehicle.Customer} highlight />
        <Divider style={styles.divider} />
        <InfoRow icon="account" label="Driver" value={vehicle.Driver_Name} />
        <Divider style={styles.divider} />
        <InfoRow icon="phone" label="Contact" value={vehicle.Contact_No} />
      </Surface>

      {/* Timeline */}
      <Surface style={styles.card} elevation={1}>
        <Text variant="labelSmall" style={styles.cardEyebrow}>
          Timeline
        </Text>
        <TimelineStep
          icon="login"
          label="Check in"
          value={vehicle.Check_In_Date ? formatDateTime(vehicle.Check_In_Date) : "—"}
          active={!!vehicle.Check_In_Date}
        />
        <TimelineStep
          icon="warehouse"
          label="Dock in"
          value={vehicle.Dock_In_DateTime ? formatDateTime(vehicle.Dock_In_DateTime) : "—"}
          active={!!vehicle.Dock_In_DateTime}
        />
        <TimelineStep
          icon="logout"
          label="Dock out"
          value={vehicle.Dock_Out_DateTime ? formatDateTime(vehicle.Dock_Out_DateTime) : "—"}
          active={!!vehicle.Dock_Out_DateTime}
        />
        <TimelineStep
          icon="exit-to-app"
          label="Check out"
          value={vehicle.Check_Out_Date ? formatDateTime(vehicle.Check_Out_Date) : "—"}
          active={!!vehicle.Check_Out_Date}
          isLast
        />
      </Surface>

      {/* Actions */}
      <Surface style={styles.card} elevation={1}>
        <Text variant="labelSmall" style={styles.cardEyebrow}>
          Actions
        </Text>
        <View style={styles.actionRow}>
          <Button mode="outlined" icon="pencil" onPress={handleEdit} style={styles.actionBtn}>
            Edit
          </Button>
          <Button mode="outlined" icon="share-variant" onPress={handleShare} style={styles.actionBtn}>
            Share
          </Button>
        </View>
        <Button
          mode="outlined"
          icon="delete-outline"
          textColor={theme.colors.error}
          onPress={handleDelete}
          disabled={deleting}
          style={styles.deleteBtn}
        >
          Delete vehicle
        </Button>
      </Surface>

      {/* Notes & audit */}
      <Surface style={[styles.card, styles.lastCard]} elevation={1}>
        <Text variant="labelSmall" style={styles.cardEyebrow}>
          Notes & audit
        </Text>
        <InfoRow icon="note-text" label="Remarks" value={vehicle.Remarks} multiline />
        <Divider style={styles.divider} />
        <InfoRow
          icon="account-check"
          label="Checked in by"
          value={expandUser(vehicle.expand, "Checked_In_By", vehicle.Checked_In_By)}
        />
        <Divider style={styles.divider} />
        <InfoRow
          icon="account-arrow-right"
          label="Checked out by"
          value={expandUser(vehicle.expand, "Checked_Out_By", vehicle.Checked_Out_By)}
        />
      </Surface>

      <Modal
        visible={fullImageVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFullImageVisible(false)}
      >
        <Pressable style={styles.fullImageBackdrop} onPress={() => setFullImageVisible(false)}>
          <View style={styles.fullImageContainer}>
            {vehicle.image ? (
              <Image
                source={{ uri: getFileUrl(vehicle, vehicle.image) }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            ) : null}
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
                {hasDockAssigned ? "Change dock" : "Assign dock"}
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
              {hasDockAssigned
                ? `Move ${vehicle.vehicleno} to another free bay. Your dock-in time is kept unless this is a new assignment.`
                : `Choose a free bay for ${vehicle.vehicleno}.`}
            </Text>
            {loadingDocks ? (
              <View style={styles.dockGridLoader}>
                <ActivityIndicator size="small" />
              </View>
            ) : (
              <View style={styles.dockGrid}>
                {Array.from({ length: DOCK_COUNT }, (_, i) => i + 1).map((dockNum) => {
                  const occupiedVehicle = vehiclesByDock[dockNum];
                  const isSelf = occupiedVehicle?.id === vehicle.id;
                  const blockedByOther = !!occupiedVehicle && !isSelf;
                  const isCurrentBay = vehicle.Assigned_Dock === dockNum;

                  return (
                    <Pressable
                      key={dockNum}
                      onPress={() => {
                        if (assigning) return;
                        if (isSelf || isCurrentBay) {
                          setAssignDockVisible(false);
                          return;
                        }
                        if (!blockedByOther) void handleAssignDock(dockNum, vehicle);
                      }}
                      disabled={blockedByOther}
                      style={({ pressed }) => [
                        styles.dockSlot,
                        pressed && !blockedByOther && styles.dockSlotPressed,
                      ]}
                    >
                      <Surface
                        style={[
                          styles.dockSlotSurface,
                          {
                            backgroundColor: blockedByOther
                              ? theme.colors.surfaceVariant
                              : isSelf || isCurrentBay
                                ? theme.colors.secondaryContainer
                                : theme.colors.primaryContainer,
                            opacity: blockedByOther ? 0.65 : 1,
                            borderWidth: isCurrentBay ? 2 : 0,
                            borderColor: theme.colors.primary,
                          },
                        ]}
                        elevation={0}
                      >
                        <Text
                          variant="labelMedium"
                          style={[
                            styles.dockSlotLabel,
                            {
                              color: blockedByOther
                                ? theme.colors.onSurfaceVariant
                                : isSelf || isCurrentBay
                                  ? theme.colors.onSecondaryContainer
                                  : theme.colors.onPrimaryContainer,
                            },
                          ]}
                        >
                          {dockNum}
                        </Text>
                        {blockedByOther ? (
                          <Text
                            variant="labelSmall"
                            style={{ color: theme.colors.onSurfaceVariant }}
                            numberOfLines={1}
                          >
                            {occupiedVehicle!.vehicleno}
                          </Text>
                        ) : isSelf || isCurrentBay ? (
                          <View style={styles.dockSlotCurrent}>
                            <Icon source="check-circle" size={14} color={theme.colors.primary} />
                            <Text
                              variant="labelSmall"
                              style={{ color: theme.colors.onSecondaryContainer, fontWeight: "700" }}
                            >
                              Current
                            </Text>
                          </View>
                        ) : (
                          <Icon source="plus" size={16} color={theme.colors.primary} />
                        )}
                      </Surface>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {assigning ? (
              <View style={styles.assigningRow}>
                <ActivityIndicator size="small" />
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Updating…
                </Text>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  highlight,
  multiline,
}: {
  icon: string;
  label: string;
  value?: string | null;
  highlight?: boolean;
  multiline?: boolean;
}) {
  const display = value != null && String(value).trim() !== "" ? String(value) : "—";
  return (
    <View style={styles.infoRow}>
      <Icon source={icon} size={20} color="#8E8E93" />
      <View style={styles.infoRowText}>
        <Text variant="labelSmall" style={styles.infoLabel}>
          {label}
        </Text>
        <Text
          variant="bodyMedium"
          numberOfLines={multiline ? 4 : 2}
          style={highlight ? styles.infoValueHighlight : styles.infoValue}
        >
          {display}
        </Text>
      </View>
    </View>
  );
}

function TimelineStep({
  icon,
  label,
  value,
  active,
  isLast,
}: {
  icon: string;
  label: string;
  value: string;
  active: boolean;
  isLast?: boolean;
}) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, active && styles.timelineDotActive]} />
        {!isLast ? <View style={[styles.timelineLine, active && styles.timelineLineActive]} /> : null}
      </View>
      <View style={styles.timelineBody}>
        <Text variant="labelSmall" style={styles.timelineLabel}>
          {label}
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.timelineValue, !active && styles.muted]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },
  hero: { width: "100%", aspectRatio: 16 / 9, position: "relative" },
  heroImageWrap: { flex: 1, width: "100%", height: "100%" },
  heroImage: { width: "100%", height: "100%", resizeMode: "cover" },
  heroPlaceholder: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: "center",
    backgroundColor: "#2C2C2E",
  },
  heroPlaceholderTitle: { color: "#FFFFFF", marginTop: 8, fontWeight: "700" },
  heroOverlay: { position: "absolute", bottom: 16, left: 16 },
  statusChip: { paddingHorizontal: 12, alignSelf: "flex-start" },
  statusText: { fontWeight: "700", fontSize: 11 },
  titleStrip: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#1C1C1E",
  },
  titleStripText: { color: "#FFFFFF", fontWeight: "700" },
  titleStripMeta: { color: "#AEAEB2", marginTop: 4 },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#2C2C2E",
  },
  lastCard: { marginBottom: 8 },
  cardEyebrow: {
    color: "#8E8E93",
    letterSpacing: 1,
    marginBottom: 12,
    fontWeight: "600",
  },
  muted: { color: "#8E8E93" },
  dockHighlightRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  dockBig: { flex: 1 },
  dockBigNum: { color: "#FFFFFF", fontWeight: "800", lineHeight: 52 },
  dockMetaCol: { flex: 1.2, paddingLeft: 8 },
  dockMetaLine: { color: "#AEAEB2", marginBottom: 4 },
  noDockText: { color: "#AEAEB2", marginBottom: 8 },
  dockCta: { borderRadius: 10 },
  dockCtaContent: { paddingVertical: 6 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 4 },
  infoRowText: { flex: 1, minWidth: 0 },
  infoLabel: { color: "#8E8E93", marginBottom: 2 },
  infoValue: { color: "#FFFFFF" },
  infoValueHighlight: { color: "#5AC8FA", fontWeight: "600" },
  divider: { backgroundColor: "#48484A", marginVertical: 8 },
  timelineRow: { flexDirection: "row", minHeight: 56 },
  timelineRail: { width: 24, alignItems: "center" },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#48484A",
    marginTop: 4,
  },
  timelineDotActive: { backgroundColor: "#5AC8FA" },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: "#48484A",
    marginVertical: 2,
  },
  timelineLineActive: { backgroundColor: "#3A3A5C" },
  timelineBody: { flex: 1, paddingBottom: 8 },
  timelineLabel: { color: "#8E8E93", marginBottom: 2 },
  timelineValue: { color: "#FFFFFF" },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  actionBtn: { flex: 1 },
  deleteBtn: { borderColor: "#FF453A33" },
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
  dockSlotPressed: { opacity: 0.85 },
  dockSlotSurface: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 64,
  },
  dockSlotLabel: { fontWeight: "700", marginBottom: 4 },
  dockSlotCurrent: { flexDirection: "row", alignItems: "center", gap: 4 },
  assigningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    justifyContent: "center",
  },
});
