import { getFileUrl } from "@/lib/storage";
import type { Vehicle, VehicleStatus } from "@/lib/vehicle-types";
import {
  computeStatus,
  STATUS_COLORS,
  STATUS_TEXT_COLORS,
} from "@/lib/vehicle-types";
import { Image, Linking, Pressable, StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  Chip,
  Divider,
  Icon,
  IconButton,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";

function formatCheckInShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusLabel(s: VehicleStatus): string {
  return s.replace(/([A-Z])/g, " $1").trim().toUpperCase();
}

type Props = {
  item: Vehicle;
  onPressDetail: (item: Vehicle) => void;
  onCheckOut: (item: Vehicle) => void;
  /** Only true when status is DockedOut (gate checkout after dock exit). */
  showCheckOut: boolean;
};

export function VehicleListCard({
  item,
  onPressDetail,
  onCheckOut,
  showCheckOut,
}: Props) {
  const theme = useTheme();
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
  const statusColor =
    STATUS_COLORS[s as VehicleStatus] ?? STATUS_COLORS.CheckedOut;
  const statusTextColor =
    STATUS_TEXT_COLORS[s as VehicleStatus] ?? "#FFFFFF";

  const party =
    item.Customer?.trim() ||
    item.Driver_Name?.trim() ||
    "No customer on file";
  const phoneRaw = item.Contact_No?.replace(/[\s-]/g, "").trim();
  const canDial = !!phoneRaw;

  const hasDock = item.Assigned_Dock != null;
  const typeIsOutward = item.Type === "Outward";

  const showActions = showCheckOut || canDial;

  return (
    <View style={styles.cardWrap}>
      <Card
        style={[styles.card, { backgroundColor: theme.colors.surface }]}
        mode="elevated"
      >
        <Card.Content style={styles.cardInner}>
          <Pressable
            style={({ pressed }) => [
              styles.mainTap,
              pressed && styles.mainTapPressed,
            ]}
            onPress={() => onPressDetail(item)}
          >
            <View style={styles.thumbCol}>
              {imgUri ? (
                <Image source={{ uri: imgUri }} style={styles.thumb} />
              ) : (
                <Surface
                  style={[
                    styles.thumbPlaceholder,
                    { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                  elevation={0}
                >
                  <Icon
                    source="truck-outline"
                    size={26}
                    color={theme.colors.primary}
                  />
                </Surface>
              )}
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text
                  variant="titleMedium"
                  numberOfLines={1}
                  style={[styles.vehicleno, { color: theme.colors.onSurface }]}
                >
                  {item.vehicleno}
                </Text>
                <Chip
                  compact
                  style={[
                    styles.statusChip,
                    { backgroundColor: statusColor, flexShrink: 0 },
                  ]}
                  textStyle={[styles.statusChipText, { color: statusTextColor }]}
                >
                  {statusLabel(s as VehicleStatus)}
                </Chip>
              </View>
              <Text
                variant="bodyMedium"
                numberOfLines={1}
                style={[styles.party, { color: theme.colors.onSurfaceVariant }]}
              >
                {party}
              </Text>
              <View style={styles.metaRow}>
                <Icon
                  source={typeIsOutward ? "arrow-up" : "arrow-down"}
                  size={16}
                  color={theme.colors.primary}
                />
                <Text
                  variant="bodySmall"
                  numberOfLines={1}
                  style={[
                    styles.metaText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {item.Type ?? "—"} · {item.Transport?.trim() || "—"}
                </Text>
              </View>
              <View style={styles.timeRow}>
                <Icon
                  source="clock-outline"
                  size={15}
                  color={theme.colors.outline}
                />
                <Text
                  variant="labelSmall"
                  numberOfLines={1}
                  style={[
                    styles.timeText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  In:{" "}
                  {item.Check_In_Date
                    ? formatCheckInShort(item.Check_In_Date)
                    : "—"}
                </Text>
              </View>
              {hasDock ? (
                <View
                  style={[
                    styles.dockPill,
                    { backgroundColor: theme.colors.secondaryContainer },
                  ]}
                >
                  <Icon
                    source="warehouse"
                    size={14}
                    color={theme.colors.onSecondaryContainer}
                  />
                  <Text
                    variant="labelMedium"
                    style={{ color: theme.colors.onSecondaryContainer }}
                  >
                    Dock {String(item.Assigned_Dock)}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>

          {showActions ? (
            <>
              <Divider style={styles.divider} />
              <View style={styles.actionRow}>
                {showCheckOut ? (
                  <Button
                    mode="contained-tonal"
                    icon="exit-to-app"
                    compact
                    onPress={() => onCheckOut(item)}
                    style={styles.checkOutBtn}
                    contentStyle={styles.checkOutBtnContent}
                  >
                    Check out
                  </Button>
                ) : null}
                {canDial ? (
                  <IconButton
                    icon="phone"
                    mode="contained-tonal"
                    size={22}
                    onPress={() => {
                      Linking.openURL(`tel:${phoneRaw}`).catch(() => {});
                    }}
                    accessibilityLabel="Call contact"
                  />
                ) : null}
                <IconButton
                  icon="warehouse"
                  mode="outlined"
                  size={22}
                  onPress={() => onPressDetail(item)}
                  accessibilityLabel="Open vehicle — assign dock"
                />
              </View>
            </>
          ) : null}
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrap: { marginBottom: 12 },
  card: { borderRadius: 14, overflow: "hidden", elevation: 0 },
  cardInner: { paddingVertical: 12, paddingHorizontal: 12 },
  mainTap: { flexDirection: "row", alignItems: "flex-start" },
  mainTapPressed: { opacity: 0.92 },
  thumbCol: { marginRight: 12 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  thumbPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  vehicleno: { flex: 1, fontWeight: "700" },
  statusChip: { maxHeight: 28 },
  statusChipText: { fontWeight: "700", fontSize: 10, marginVertical: 0 },
  party: { fontWeight: "500", marginBottom: 6 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  metaText: { flex: 1 },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeText: { flex: 1 },
  dockPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  divider: { marginTop: 12, marginBottom: 4 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  checkOutBtn: { flexGrow: 1, flexShrink: 1, minWidth: 120 },
  checkOutBtnContent: { flexDirection: "row-reverse" },
});
