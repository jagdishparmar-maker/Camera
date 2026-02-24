import { create } from "@/lib/database";
import type { VehicleStatus } from "@/lib/vehicle-types";
import { computeStatus } from "@/lib/vehicle-types";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
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
  Button,
  Icon,
  List,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { pb } from "@/lib/pocketbase";

const COLLECTION = "vehicles";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_PREVIEW_HEIGHT = Math.min(SCREEN_WIDTH - 32, 320);

export default function AddVehicleScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [checkInDate, setCheckInDate] = useState(new Date());
  const [vehicleno, setVehicleno] = useState("");
  const [transport, setTransport] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [customer, setCustomer] = useState("");
  const [driverName, setDriverName] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
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
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    const vNo = vehicleno.trim();
    const trans = transport.trim();
    const cust = customer.trim();

    if (!vNo) {
      Alert.alert("Required", "Enter vehicle number.");
      return;
    }
    if (!trans) {
      Alert.alert("Required", "Enter transport.");
      return;
    }
    if (!imageUri) {
      Alert.alert("Required", "Capture or select an image.");
      return;
    }
    if (!cust) {
      Alert.alert("Required", "Enter customer name.");
      return;
    }

    setSubmitting(true);
    try {
      const filename = imageUri.split("/").pop() ?? "image.jpg";
      const match = filename.match(/\.(jpe?g|png|gif|webp)$/i);
      const ext = match ? match[1].toLowerCase() : "jpg";
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;

      const currentUserId = pb.authStore.record?.id ?? null;

      const payload: Record<string, unknown> = {
        vehicleno: vNo,
        image: { uri: imageUri, type: mime, name: filename },
        Check_In_Date: checkInDate.toISOString(),
        Transport: trans,
        Customer: cust,
        Driver_Name: driverName.trim() || undefined,
        Contact_No: contactNo.trim() || undefined,
        ...(currentUserId && {
          Checked_In_By: currentUserId,
          Checked_Out_By: currentUserId,
        }),
      };

      payload.status = computeStatus({}) as VehicleStatus;

      await create(COLLECTION, payload);
      router.back();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save vehicle.";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    vehicleno,
    transport,
    imageUri,
    customer,
    driverName,
    contactNo,
    checkInDate,
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={[styles.formScrollContent, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <List.Section style={styles.listSection}>
          <List.Subheader style={styles.subheader}>Add Vehicle</List.Subheader>
          <View style={styles.formSection}>
            {/* 1. Check In Date */}
            <Text variant="labelSmall" style={styles.fieldLabel}>1. Check In Date & Time *</Text>
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
                  onChange={(_, d) => {
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

            {/* 2. Vehicle Number */}
            <Text variant="labelSmall" style={styles.fieldLabel}>2. Vehicle Number *</Text>
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

            {/* 3. Transport */}
            <Text variant="labelSmall" style={styles.fieldLabel}>3. Transport *</Text>
            <TextInput
              mode="flat"
              dense
              placeholder="Transport company"
              value={transport}
              onChangeText={setTransport}
              left={<TextInput.Icon icon="truck" />}
              style={styles.input}
            />

            {/* 4. Image */}
            <Text variant="labelSmall" style={styles.fieldLabel}>4. Image *</Text>
            <Surface style={[styles.imagePicker, imageUri && styles.imagePickerFull]} elevation={0}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="contain" />
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

            {/* 5. Customer */}
            <Text variant="labelSmall" style={styles.fieldLabel}>5. Customer *</Text>
            <TextInput
              mode="flat"
              dense
              placeholder="Customer name"
              value={customer}
              onChangeText={setCustomer}
              left={<TextInput.Icon icon="account" />}
              style={styles.input}
            />

            {/* 6. Driver Name (optional) */}
            <Text variant="labelSmall" style={styles.fieldLabel}>6. Driver Name (optional)</Text>
            <TextInput
              mode="flat"
              dense
              placeholder="Driver name"
              value={driverName}
              onChangeText={setDriverName}
              left={<TextInput.Icon icon="account" />}
              style={styles.input}
            />

            {/* 7. Contact (optional) */}
            <Text variant="labelSmall" style={styles.fieldLabel}>7. Contact (optional)</Text>
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
          </View>
        </List.Section>

        <Button
          mode="contained"
          compact
          onPress={handleSubmit}
          disabled={submitting}
          loading={submitting}
          icon="content-save"
          style={styles.submitButton}
        >
          Save Vehicle
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  formScroll: { flex: 1 },
  formScrollContent: { paddingBottom: 24 },
  listSection: { marginTop: -8 },
  subheader: { paddingHorizontal: 0, paddingVertical: 4 },
  formSection: { paddingHorizontal: 16, paddingBottom: 16, gap: 6 },
  fieldLabel: { marginBottom: 4 },
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
    borderRadius: 10,
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
  imagePreview: { width: "100%", height: "100%" },
  imagePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  imagePlaceholderText: { opacity: 0.6, fontSize: 12 },
  submitButton: { marginTop: 8, marginHorizontal: 16, marginBottom: 20, borderRadius: 10 },
});
