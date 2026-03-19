import { getFullList, getOne, update } from "@/lib/database";
import { getFileUrl } from "@/lib/storage";
import type { Vehicle, VehicleStatus } from "@/lib/vehicle-types";
import { computeStatus } from "@/lib/vehicle-types";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import {
  ActivityIndicator,
  Button,
  Icon,
  List,
  Menu,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

const COLLECTION = "vehicles";
const CUSTOMERS_COLLECTION = "customers";

type CustomerRecord = { id: string; customer_name: string };
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_PREVIEW_HEIGHT = Math.min(SCREEN_WIDTH - 32, 200);

export default function EditVehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkInDate, setCheckInDate] = useState(new Date());
  const [vehicleno, setVehicleno] = useState("");
  const [transport, setTransport] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [customerMenuVisible, setCustomerMenuVisible] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [type, setType] = useState<"Inward" | "Outward">("Inward");
  const [remarks, setRemarks] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadVehicle = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const record = await getOne<Vehicle>(COLLECTION, id, {
        expand: "Checked_In_By,Checked_Out_By",
      });
      setVehicleno(record.vehicleno ?? "");
      setTransport(record.Transport ?? "");
      setType((record.Type as "Inward" | "Outward") ?? "Inward");
      setDriverName(record.Driver_Name ?? "");
      setContactNo(record.Contact_No ?? "");
      setRemarks(record.Remarks ?? "");
      if (record.Check_In_Date) {
        setCheckInDate(new Date(record.Check_In_Date));
      }
      if (record.image && typeof record.image === "string") {
        setImageUri(getFileUrl(record, record.image));
      }
      const custName = record.Customer ?? "";
      if (custName) {
        setSelectedCustomer({ id: "", customer_name: custName });
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not load vehicle.");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadVehicle();
  }, [loadVehicle]);

  useEffect(() => {
    let cancelled = false;
    getFullList<CustomerRecord>(CUSTOMERS_COLLECTION, { sort: "customer_name" })
      .then((list) => {
        if (!cancelled) setCustomers(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setCustomers([]);
      });
    return () => { cancelled = true; };
  }, []);

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
      exif: true,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  }, []);

  const capturePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow camera access to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
      exif: true,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!id) return;
    const vNo = vehicleno.trim();
    const trans = transport.trim();
    const cust = selectedCustomer?.customer_name ?? "";

    if (!vNo) {
      Alert.alert("Required", "Enter vehicle number.");
      return;
    }
    if (!trans) {
      Alert.alert("Required", "Enter transport.");
      return;
    }
    if (!cust) {
      Alert.alert("Required", "Select a customer.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        vehicleno: vNo,
        Type: type,
        Transport: trans,
        Customer: cust,
        Driver_Name: driverName.trim() || undefined,
        Contact_No: contactNo.trim() || undefined,
        Remarks: remarks.trim() || undefined,
        Check_In_Date: checkInDate.toISOString(),
      };

      if (imageUri?.startsWith("file://")) {
        const filename = imageUri.split("/").pop() ?? "image.jpg";
        const match = filename.match(/\.(jpe?g|png|gif|webp)$/i);
        const ext = match ? match[1].toLowerCase() : "jpg";
        const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
        payload.image = { uri: imageUri, type: mime, name: filename };
      }

      payload.status = computeStatus({}) as VehicleStatus;

      await update<Vehicle>(COLLECTION, id, payload);
      router.back();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update vehicle.";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    id,
    vehicleno,
    transport,
    imageUri,
    selectedCustomer,
    driverName,
    contactNo,
    remarks,
    checkInDate,
    type,
    router,
  ]);

  const formatDateTime = (d: Date) =>
    d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const openAndroidDateTimePicker = useCallback(
    (currentValue: Date, onSelect: (d: Date) => void) => {
      DateTimePickerAndroid.open({
        value: currentValue,
        mode: "date",
        display: "default",
        onChange: (_e, date) => {
          if (date) {
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

  const handleDatePress = useCallback(() => {
    if (Platform.OS === "android") {
      openAndroidDateTimePicker(checkInDate, setCheckInDate);
    } else {
      setShowDatePicker(true);
    }
  }, [checkInDate, openAndroidDateTimePicker]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formScrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <List.Section style={styles.listSection}>
          <List.Subheader style={styles.subheader}>Edit Vehicle</List.Subheader>
          <View style={styles.formSection}>
            <Text variant="labelSmall" style={[styles.fieldLabel, { marginTop: 0 }]}>
              1. Check In Date & Time *
            </Text>
            <Pressable onPress={handleDatePress} style={({ pressed }) => [pressed && styles.dateSurfacePressed]}>
              <Surface style={styles.dateSurface} elevation={0}>
                <View style={styles.dateSurfaceContent}>
                  <Icon source="calendar-clock" size={18} color={theme.colors.primary} />
                  <Text variant="bodyMedium" style={styles.dateSurfaceText}>
                    {formatDateTime(checkInDate)}
                  </Text>
                </View>
                <Icon source="chevron-down" size={18} color={theme.colors.onSurfaceVariant} />
              </Surface>
            </Pressable>
            {showDatePicker && Platform.OS === "ios" && (
              <View style={styles.datePickerWrap}>
                <DateTimePicker
                  value={checkInDate}
                  mode="datetime"
                  display="spinner"
                  onChange={(_e, d) => {
                    if (d) setCheckInDate(d);
                    setShowDatePicker(false);
                  }}
                  accentColor={theme.colors.primary}
                  themeVariant="dark"
                />
                <Button mode="contained-tonal" onPress={() => setShowDatePicker(false)} style={styles.doneBtn}>
                  Done
                </Button>
              </View>
            )}

            <Text variant="labelSmall" style={styles.fieldLabel}>
              2. Type *
            </Text>
            <SegmentedButtons
              value={type}
              onValueChange={(v) => setType(v as "Inward" | "Outward")}
              buttons={[
                { value: "Inward", label: "Inward", icon: "arrow-down" },
                { value: "Outward", label: "Outward", icon: "arrow-up" },
              ]}
              style={styles.typeSegmented}
            />

            <Text variant="labelSmall" style={styles.fieldLabel}>
              3. Vehicle Number *
            </Text>
            <TextInput
              mode="flat"
              dense
              placeholder="e.g. MH12AB1234"
              value={vehicleno}
              onChangeText={setVehicleno}
              autoCapitalize="characters"
              left={<TextInput.Icon icon="car" />}
              style={styles.input}
            />

            <Text variant="labelSmall" style={styles.fieldLabel}>
              4. Transport *
            </Text>
            <TextInput
              mode="flat"
              dense
              placeholder="Transport company"
              value={transport}
              onChangeText={setTransport}
              left={<TextInput.Icon icon="truck" />}
              style={styles.input}
            />

            <Text variant="labelSmall" style={styles.fieldLabel}>
              5. Image (optional – change to update)
            </Text>
            <Surface style={[styles.imagePicker, imageUri && styles.imagePickerFull]} elevation={0}>
              {imageUri ? (
                <View style={styles.imagePreviewWrap}>
                  <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                </View>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Icon source="camera" size={32} color={theme.colors.primary} />
                  <Text variant="bodySmall" style={styles.imagePlaceholderText}>
                    Capture or select
                  </Text>
                </View>
              )}
            </Surface>
            <View style={styles.imageActions}>
              <Button
                mode="outlined"
                icon="camera"
                onPress={capturePhoto}
                style={styles.imageActionBtn}
                compact
              >
                Capture
              </Button>
              <Button
                mode="outlined"
                icon="image"
                onPress={pickImage}
                style={styles.imageActionBtn}
                compact
              >
                Select
              </Button>
            </View>

            <Text variant="labelSmall" style={styles.fieldLabel}>
              6. Customer *
            </Text>
            <Menu
              visible={customerMenuVisible}
              onDismiss={() => setCustomerMenuVisible(false)}
              anchor={
                <Pressable
                  onPress={() => setCustomerMenuVisible(true)}
                  style={({ pressed }) => [pressed && styles.dateSurfacePressed]}
                >
                  <Surface style={styles.dateSurface} elevation={0}>
                    <View style={styles.dateSurfaceContent}>
                      <Icon source="account" size={18} color={theme.colors.primary} />
                      <Text
                        variant="bodyMedium"
                        style={[styles.dateSurfaceText, !selectedCustomer && { opacity: 0.6 }]}
                      >
                        {selectedCustomer?.customer_name ?? "Select customer"}
                      </Text>
                    </View>
                    <Icon source="chevron-down" size={18} color={theme.colors.onSurfaceVariant} />
                  </Surface>
                </Pressable>
              }
              contentStyle={{ backgroundColor: theme.colors.surface }}
            >
              {customers.length === 0 && !selectedCustomer ? (
                <List.Item title="No customers" description="Add customers in PocketBase" />
              ) : (
                [
                  ...(selectedCustomer && !customers.some((c) => c.customer_name === selectedCustomer.customer_name)
                    ? [selectedCustomer]
                    : []),
                  ...customers,
                ].map((c) => (
                  <Menu.Item
                    key={c.id || c.customer_name}
                    onPress={() => {
                      setSelectedCustomer(c);
                      setCustomerMenuVisible(false);
                    }}
                    title={c.customer_name}
                  />
                ))
              )}
            </Menu>

            <Text variant="labelSmall" style={styles.fieldLabel}>
              7. Driver Name (optional)
            </Text>
            <TextInput
              mode="flat"
              dense
              placeholder="Driver name"
              value={driverName}
              onChangeText={setDriverName}
              left={<TextInput.Icon icon="account" />}
              style={styles.input}
            />

            <Text variant="labelSmall" style={styles.fieldLabel}>
              8. Contact (optional)
            </Text>
            <TextInput
              mode="flat"
              dense
              placeholder="Phone number"
              value={contactNo}
              onChangeText={setContactNo}
              keyboardType="phone-pad"
              left={<TextInput.Icon icon="phone" />}
              style={styles.input}
            />

            <Text variant="labelSmall" style={styles.fieldLabel}>
              9. Remarks (optional)
            </Text>
            <TextInput
              mode="flat"
              dense
              placeholder="Remarks"
              value={remarks}
              onChangeText={setRemarks}
              multiline
              numberOfLines={2}
              left={<TextInput.Icon icon="note" />}
              style={styles.input}
            />
          </View>
        </List.Section>

        <Button
          mode="contained"
          onPress={handleSubmit}
          disabled={submitting}
          loading={submitting}
          icon="content-save"
          style={styles.submitButton}
        >
          Save Changes
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  formScroll: { flex: 1 },
  formScrollContent: {
    paddingBottom: 120,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  listSection: { marginTop: 0 },
  subheader: { paddingHorizontal: 0, paddingVertical: 8 },
  formSection: { paddingBottom: 20, gap: 4 },
  fieldLabel: { marginBottom: 4, marginTop: 8 },
  typeSegmented: { marginBottom: 0 },
  input: { marginBottom: 0 },
  dateSurface: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#48484A",
  },
  dateSurfacePressed: { opacity: 0.8 },
  dateSurfaceContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  dateSurfaceText: { flex: 1, color: "#FFFFFF", fontSize: 14 },
  datePickerWrap: { marginTop: 6 },
  doneBtn: { marginTop: 6 },
  imagePicker: {
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#48484A",
    borderStyle: "dashed",
  },
  imagePickerFull: {
    height: IMAGE_PREVIEW_HEIGHT,
    minHeight: IMAGE_PREVIEW_HEIGHT,
  },
  imageActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  imageActionBtn: { flex: 1, borderRadius: 12, marginVertical: 0 },
  imagePreviewWrap: { width: "100%", height: "100%" },
  imagePreview: { width: "100%", height: "100%", borderRadius: 10 },
  imagePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  imagePlaceholderText: { opacity: 0.6, fontSize: 12 },
  submitButton: {
    marginTop: 24,
    marginHorizontal: 0,
    marginBottom: 24,
    borderRadius: 12,
    paddingVertical: 6,
  },
});
