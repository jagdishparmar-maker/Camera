import { getOne, update } from "@/lib/database";
import { getFileUrl } from "@/lib/storage";
import type { Vehicle, VehicleStatus } from "@/lib/vehicle-types";
import { computeStatus, formatDateTime, STATUS_COLORS, STATUS_TEXT_COLORS } from "@/lib/vehicle-types";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Button,
  Chip,
  IconButton,
  List,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

const COLLECTION = "vehicles";
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
  const [dockNumber, setDockNumber] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

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

  const handleAssignDock = useCallback(async () => {
    if (!id) return;
    const num = parseInt(dockNumber.trim(), 10);
    if (isNaN(num) || num < 1 || num > 10) {
      setAssignError("Enter a dock number between 1 and 10");
      return;
    }
    setAssignError(null);
    setAssigning(true);
    try {
      const dockInTime = new Date().toISOString();
      await update<Vehicle>(COLLECTION, id, {
        Assigned_Dock: num,
        Dock_In_DateTime: dockInTime,
        status: "DockedIn",
      });
      setAssignDockVisible(false);
      setDockNumber("");
      await loadVehicle();
    } catch (err) {
      console.error(err);
      setAssignError("Failed to assign dock. Please try again.");
    } finally {
      setAssigning(false);
    }
  }, [id, dockNumber, loadVehicle]);

  const openAssignDock = useCallback(() => {
    setAssignError(null);
    setDockNumber(vehicle?.Assigned_Dock != null ? String(vehicle.Assigned_Dock) : "");
    setAssignDockVisible(true);
  }, [vehicle?.Assigned_Dock]);

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
            <Pressable style={[styles.dialogContent, { backgroundColor: theme.colors.surface }]} onPress={(e) => e.stopPropagation()}>
              <Text variant="titleMedium" style={[styles.dialogTitle, { color: theme.colors.onSurface }]}>
                Assign Dock
              </Text>
              <Text variant="bodyMedium" style={[styles.dialogSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                Enter dock number (1–10). Status will be set to Dock In & Dock In time will be updated.
              </Text>
              <TextInput
                mode="outlined"
                label="Dock Number"
                value={dockNumber}
                onChangeText={setDockNumber}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="1–10"
                error={!!assignError}
                disabled={assigning}
                style={styles.dockInput}
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
                textColor={theme.colors.onSurface}
              />
              {assignError && (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                  {assignError}
                </Text>
              )}
              <View style={styles.dialogActions}>
                <Button
                  mode="outlined"
                  onPress={() => !assigning && setAssignDockVisible(false)}
                  disabled={assigning}
                  style={styles.dialogButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleAssignDock}
                  loading={assigning}
                  disabled={assigning}
                  icon="check"
                  style={styles.dialogButton}
                >
                  Assign
                </Button>
              </View>
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
    padding: 20,
  },
  dialogTitle: { marginBottom: 8, fontWeight: "600" },
  dialogSubtitle: { marginBottom: 16 },
  dockInput: { marginBottom: 8 },
  errorText: { marginBottom: 8 },
  dialogActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  dialogButton: { minWidth: 100 },
});
