import { getFullList, update } from "@/lib/database";
import { useRealtime } from "@/hooks/use-realtime";
import type { Vehicle } from "@/lib/vehicle-types";
import { computeStatus } from "@/lib/vehicle-types";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, Icon, Surface, Text, useTheme } from "react-native-paper";

const COLLECTION = "vehicles";
const DOCK_COUNT = 10;

export default function DockScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dockingOutId, setDockingOutId] = useState<string | null>(null);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  useRealtime<Vehicle>(COLLECTION, (action) => {
    if (action === "create" || action === "update" || action === "delete") {
      loadVehicles();
    }
  });

  const handleDockOut = useCallback(
    async (vehicle: Vehicle) => {
      setDockingOutId(vehicle.id);
      try {
        const dockOutTime = new Date().toISOString();
        await update<Vehicle>(COLLECTION, vehicle.id, {
          Assigned_Dock: null,
          status: "DockedOut",
          Dock_Out_DateTime: dockOutTime,
        });
        await loadVehicles();
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to dock out vehicle. Please try again.");
      } finally {
        setDockingOutId(null);
      }
    },
    [loadVehicles]
  );

  const onOccupiedDockPress = useCallback(
    (vehicle: Vehicle, dockNum: number) => {
      Alert.alert(
        "Dock Out Vehicle",
        `Dock out ${vehicle.vehicleno} from DOCK${dockNum}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "View Details",
            onPress: () =>
              router.push({
                pathname: "/(tabs)/(home)/vehicle/[id]",
                params: { id: vehicle.id, vehicleno: vehicle.vehicleno },
              }),
          },
          {
            text: "Dock Out",
            onPress: () => handleDockOut(vehicle),
          },
        ]
      );
    },
    [router, handleDockOut]
  );

  const vehiclesByDock = vehicles
    .filter((v) => {
      const dock = v.Assigned_Dock;
      if (dock == null || dock < 1 || dock > DOCK_COUNT) return false;
      const s = v.status ?? computeStatus({
        Check_Out_Date: v.Check_Out_Date,
        Dock_Out_DateTime: v.Dock_Out_DateTime,
        Assigned_Dock: v.Assigned_Dock,
        Dock_In_DateTime: v.Dock_In_DateTime,
      });
      return s !== "CheckedOut";
    })
    .reduce<Record<number, Vehicle>>((acc, v) => {
      const dock = v.Assigned_Dock!;
      acc[dock] = v;
      return acc;
    }, {});

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView edges={["top"]} style={styles.safeTop}>
        <View style={styles.header}>
          <Text variant="titleLarge" style={styles.headerTitle}>
            Dock Layout
          </Text>
          <Text variant="labelMedium" style={styles.headerSub}>
            DOCK1 – DOCK{DOCK_COUNT}
          </Text>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {Array.from({ length: DOCK_COUNT }, (_, i) => i + 1).map((dockNum) => {
              const vehicle = vehiclesByDock[dockNum];
              const isOccupied = !!vehicle;
              return (
                <Pressable
                  key={dockNum}
                  onPress={() => {
                    if (vehicle) {
                      onOccupiedDockPress(vehicle, dockNum);
                    }
                  }}
                  disabled={!!vehicle && dockingOutId === vehicle.id}
                  style={({ pressed }) => [
                    styles.dockPressable,
                    pressed && styles.dockPressed,
                  ]}
                >
                  <Card
                    style={[
                      styles.dockCard,
                      {
                        backgroundColor: isOccupied
                          ? theme.colors.surface
                          : theme.colors.surfaceVariant,
                      },
                    ]}
                    mode="elevated"
                  >
                    <Card.Content style={[styles.dockContent, { position: "relative" }]}>
                      {vehicle && dockingOutId === vehicle.id && (
                        <View style={[styles.dockOutOverlay, { backgroundColor: theme.colors.surface }]}>
                          <ActivityIndicator size="small" />
                          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                            Docking out...
                          </Text>
                        </View>
                      )}
                      <View style={styles.dockHeader}>
                        <Surface
                          style={[
                            styles.dockBadge,
                            {
                              backgroundColor: isOccupied
                                ? theme.colors.primary
                                : theme.colors.surfaceVariant,
                            },
                          ]}
                          elevation={0}
                        >
                          <Text
                            variant="labelLarge"
                            style={[
                              styles.dockLabel,
                              {
                                color: isOccupied
                                  ? "#1A1A1A"
                                  : theme.colors.onSurfaceVariant,
                              },
                            ]}
                          >
                            DOCK{dockNum}
                          </Text>
                        </Surface>
                        {isOccupied && (
                          <Icon
                            source="car"
                            size={20}
                            color={theme.colors.primary}
                          />
                        )}
                      </View>
                      {isOccupied ? (
                        <View style={styles.vehicleInfo}>
                          <Text
                            variant="titleMedium"
                            style={[styles.vehicleno, { color: theme.colors.onSurface }]}
                            numberOfLines={1}
                          >
                            {vehicle.vehicleno}
                          </Text>
                          <Text
                            variant="bodySmall"
                            style={[styles.customer, { color: theme.colors.onSurfaceVariant }]}
                            numberOfLines={1}
                          >
                            {vehicle.Customer ?? "—"}
                          </Text>
                          <Text
                            variant="labelSmall"
                            style={[styles.type, { color: theme.colors.primary }]}
                          >
                            {vehicle.Type ?? "—"}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.emptyInfo}>
                          <Text
                            variant="bodyMedium"
                            style={{ color: theme.colors.onSurfaceVariant }}
                          >
                            Available
                          </Text>
                        </View>
                      )}
                    </Card.Content>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeTop: { backgroundColor: "#2C2C2E" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 0,
  },
  headerTitle: { color: "#FFFFFF", fontWeight: "600", fontSize: 22 },
  headerSub: { color: "#A0A0A0", marginTop: 2, fontSize: 12 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 32 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  dockPressable: { width: "48%" },
  dockPressed: { opacity: 0.9 },
  dockCard: {
    borderRadius: 14,
    overflow: "hidden",
    elevation: 0,
    minHeight: 110,
  },
  dockContent: { padding: 12 },
  dockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dockLabel: { fontWeight: "600", fontSize: 11 },
  vehicleInfo: { gap: 2 },
  dockOutOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    zIndex: 1,
  },
  vehicleno: { fontWeight: "600", fontSize: 14 },
  customer: { fontSize: 12 },
  type: { marginTop: 2, fontWeight: "600", fontSize: 11 },
  emptyInfo: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
});
