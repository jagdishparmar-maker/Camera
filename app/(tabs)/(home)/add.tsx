import { FormScreenScroll } from "@/components/FormScreenScroll";
import { create, getFullList, remove, update } from "@/lib/database";
import type { VehicleStatus } from "@/lib/vehicle-types";
import { computeStatus } from "@/lib/vehicle-types";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  Pressable,
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
  Menu,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { pb } from "@/lib/pocketbase";

const COLLECTION = "vehicles";
const CUSTOMERS_COLLECTION = "customers";

type CustomerRecord = { id: string; customer_name: string };
type FlowStep = 1 | 2 | 3;
type UploadState = "idle" | "uploading" | "done" | "error";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_PREVIEW_HEIGHT = Math.min(SCREEN_WIDTH - 32, 200);
const PLACEHOLDER_TRANSPORT = "Pending";

function fileMetaFromUri(uri: string) {
  const filename = uri.split("/").pop() ?? "image.jpg";
  const match = filename.match(/\.(jpe?g|png|gif|webp)$/i);
  const ext = match ? match[1].toLowerCase() : "jpg";
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
  return { filename, mime };
}

export default function AddVehicleScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [flowStep, setFlowStep] = useState<FlowStep>(1);
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [draftRecordId, setDraftRecordId] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFullList<CustomerRecord>(CUSTOMERS_COLLECTION, { sort: "customer_name" })
      .then((list) => {
        if (!cancelled) setCustomers(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setCustomers([]);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const buildCreatePayload = useCallback(
    (uri: string, tempVehicleno: string) => {
      const { filename, mime } = fileMetaFromUri(uri);
      if (!selectedCustomer) throw new Error("Customer required");
      const cust = selectedCustomer.customer_name;
      const currentUserId = pb.authStore.record?.id ?? null;
      const payload: Record<string, unknown> = {
        vehicleno: tempVehicleno,
        image: { uri, type: mime, name: filename },
        Check_In_Date: checkInDate.toISOString(),
        Type: type,
        Transport: PLACEHOLDER_TRANSPORT,
        Customer: cust,
        Driver_Name: driverName.trim() || undefined,
        Contact_No: contactNo.trim() || undefined,
        ...(currentUserId && {
          Checked_In_By: currentUserId,
          Checked_Out_By: currentUserId,
        }),
      };
      payload.status = computeStatus({}) as VehicleStatus;
      return payload;
    },
    [checkInDate, type, selectedCustomer, driverName, contactNo],
  );

  const startBackgroundUpload = useCallback(
    async (uri: string) => {
      if (!selectedCustomer) {
        setUploadState("error");
        setUploadError("Select a customer first.");
        return;
      }
      setUploadState("uploading");
      setUploadError(null);
      const tempVehicleno = `TMP-${Date.now()}`;
      try {
        const payload = buildCreatePayload(uri, tempVehicleno);
        const rec = await create<{ id: string }>(COLLECTION, payload);
        setDraftRecordId(rec.id);
        setUploadState("done");
      } catch (err: unknown) {
        setDraftRecordId(null);
        setUploadState("error");
        const msg = err instanceof Error ? err.message : "Upload failed";
        setUploadError(msg);
      }
    },
    [buildCreatePayload, selectedCustomer],
  );

  const replaceImageOnDraft = useCallback(
    async (uri: string) => {
      if (!draftRecordId) return;
      const { filename, mime } = fileMetaFromUri(uri);
      setUploadState("uploading");
      setUploadError(null);
      try {
        await update(COLLECTION, draftRecordId, {
          image: { uri, type: mime, name: filename },
        });
        setUploadState("done");
      } catch (err: unknown) {
        setUploadState("error");
        const msg = err instanceof Error ? err.message : "Failed to update image";
        setUploadError(msg);
      }
    },
    [draftRecordId],
  );

  const applyImageUri = useCallback(
    (uri: string) => {
      if (uploadState === "uploading") {
        Alert.alert("Please wait", "Image upload in progress.");
        return;
      }
      setImageUri(uri);
      if (flowStep === 2) {
        setFlowStep(3);
      }
      if (draftRecordId) {
        void replaceImageOnDraft(uri);
      } else {
        void startBackgroundUpload(uri);
      }
    },
    [flowStep, draftRecordId, uploadState, replaceImageOnDraft, startBackgroundUpload],
  );

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
      applyImageUri(result.assets[0].uri);
    }
  }, [applyImageUri]);

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
      applyImageUri(result.assets[0].uri);
    }
  }, [applyImageUri]);

  const retryUpload = useCallback(() => {
    if (!imageUri || !selectedCustomer) return;
    void startBackgroundUpload(imageUri);
  }, [imageUri, selectedCustomer, startBackgroundUpload]);

  const goBackStep = useCallback(async () => {
    if (flowStep === 2) {
      if (draftRecordId) {
        try {
          await remove(COLLECTION, draftRecordId);
        } catch {
          /* ignore */
        }
      }
      setDraftRecordId(null);
      setImageUri(null);
      setUploadState("idle");
      setUploadError(null);
      setFlowStep(1);
      return;
    }
    if (flowStep === 3) {
      setFlowStep(2);
    }
  }, [flowStep, draftRecordId]);

  const proceedFromStep1 = useCallback(() => {
    if (!selectedCustomer) {
      Alert.alert("Required", "Select a customer.");
      return;
    }
    setFlowStep(2);
  }, [selectedCustomer]);

  const handleSubmit = useCallback(async () => {
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
    if (!imageUri) {
      Alert.alert("Required", "Capture or select an image.");
      return;
    }
    if (!cust) {
      Alert.alert("Required", "Select a customer.");
      return;
    }
    if (!draftRecordId && uploadState === "uploading") {
      Alert.alert("Please wait", "Image is still uploading to the server.");
      return;
    }

    setSubmitting(true);
    try {
      const { filename, mime } = fileMetaFromUri(imageUri);
      const currentUserId = pb.authStore.record?.id ?? null;

      const commonFields: Record<string, unknown> = {
        vehicleno: vNo,
        Check_In_Date: checkInDate.toISOString(),
        Type: type,
        Transport: trans,
        Customer: cust,
        Driver_Name: driverName.trim() || undefined,
        Contact_No: contactNo.trim() || undefined,
        ...(currentUserId && {
          Checked_In_By: currentUserId,
          Checked_Out_By: currentUserId,
        }),
      };
      commonFields.status = computeStatus({}) as VehicleStatus;

      if (draftRecordId) {
        await update(COLLECTION, draftRecordId, commonFields);
      } else {
        const payload: Record<string, unknown> = {
          ...commonFields,
          image: { uri: imageUri, type: mime, name: filename },
        };
        await create(COLLECTION, payload);
      }
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
    selectedCustomer,
    driverName,
    contactNo,
    checkInDate,
    type,
    router,
    draftRecordId,
    uploadState,
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

  const stepTitle =
    flowStep === 1 ? "Type & customer" : flowStep === 2 ? "Vehicle photo" : "Details";

  return (
    <View style={styles.container}>
      <FormScreenScroll>
        <List.Section style={styles.listSection}>
          <View style={styles.screenHeader}>
            <Text variant="headlineSmall" style={styles.screenTitle}>
              Add Vehicle
            </Text>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Step {flowStep} of 3 — {stepTitle}
            </Text>
          </View>

          {flowStep > 1 && (
            <Button
              mode="text"
              icon="arrow-left"
              onPress={() => void goBackStep()}
              style={styles.backRow}
              compact
            >
              Back
            </Button>
          )}

          {/* Step 1: Inward / Outward + customer */}
          {flowStep === 1 && (
            <View style={styles.formSection}>
              <Text variant="titleSmall" style={styles.stepHeading}>
                Vehicle type
              </Text>
              <View style={styles.bigTypeRow}>
                <Pressable
                  onPress={() => setType("Inward")}
                  style={({ pressed }) => [
                    styles.bigTypeBtn,
                    type === "Inward" && styles.bigTypeBtnSelected,
                    { borderColor: theme.colors.primary },
                    pressed && styles.dateSurfacePressed,
                  ]}
                >
                  <Surface
                    style={[
                      styles.bigTypeInner,
                      type === "Inward" && { backgroundColor: theme.colors.primaryContainer },
                    ]}
                    elevation={0}
                  >
                    <Icon
                      source="arrow-down-bold"
                      size={40}
                      color={type === "Inward" ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    />
                    <Text
                      variant="titleMedium"
                      style={[
                        styles.bigTypeLabel,
                        type === "Inward" && { color: theme.colors.primary },
                      ]}
                    >
                      Inward
                    </Text>
                    <Text variant="bodySmall" style={styles.bigTypeHint}>
                      Arriving / entry
                    </Text>
                  </Surface>
                </Pressable>
                <Pressable
                  onPress={() => setType("Outward")}
                  style={({ pressed }) => [
                    styles.bigTypeBtn,
                    type === "Outward" && styles.bigTypeBtnSelected,
                    { borderColor: theme.colors.primary },
                    pressed && styles.dateSurfacePressed,
                  ]}
                >
                  <Surface
                    style={[
                      styles.bigTypeInner,
                      type === "Outward" && { backgroundColor: theme.colors.primaryContainer },
                    ]}
                    elevation={0}
                  >
                    <Icon
                      source="arrow-up-bold"
                      size={40}
                      color={type === "Outward" ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    />
                    <Text
                      variant="titleMedium"
                      style={[
                        styles.bigTypeLabel,
                        type === "Outward" && { color: theme.colors.primary },
                      ]}
                    >
                      Outward
                    </Text>
                    <Text variant="bodySmall" style={styles.bigTypeHint}>
                      Leaving / exit
                    </Text>
                  </Surface>
                </Pressable>
              </View>

              <Text variant="titleSmall" style={[styles.stepHeading, styles.customerHeading]}>
                Customer *
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
                          style={[
                            styles.dateSurfaceText,
                            !selectedCustomer && { opacity: 0.6 },
                          ]}
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
                {customers.length === 0 ? (
                  <List.Item title="No customers" description="Add customers in PocketBase" />
                ) : (
                  customers.map((c) => (
                    <Menu.Item
                      key={c.id}
                      onPress={() => {
                        setSelectedCustomer(c);
                        setCustomerMenuVisible(false);
                      }}
                      title={c.customer_name}
                    />
                  ))
                )}
              </Menu>

              <Button
                mode="contained"
                icon="arrow-right"
                onPress={proceedFromStep1}
                style={styles.stepContinue}
                contentStyle={styles.stepContinueContent}
              >
                Continue to photo
              </Button>
            </View>
          )}

          {/* Step 2: Image only */}
          {flowStep === 2 && (
            <View style={styles.formSection}>
              <Text variant="bodyMedium" style={styles.stepIntro}>
                Capture or choose a photo. After you pick one, you can enter vehicle details while the
                image uploads.
              </Text>
              <Surface style={[styles.imagePicker, imageUri && styles.imagePickerFull]} elevation={0}>
                {imageUri ? (
                  <View style={styles.imagePreviewWrap}>
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                  </View>
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Icon source="camera" size={40} color={theme.colors.primary} />
                    <Text variant="bodyMedium" style={styles.imagePlaceholderText}>
                      Photo required
                    </Text>
                  </View>
                )}
              </Surface>
              <View style={styles.imageActions}>
                <Button
                  mode="contained-tonal"
                  icon="camera"
                  onPress={capturePhoto}
                  style={styles.imageActionBtn}
                  disabled={uploadState === "uploading"}
                >
                  Capture
                </Button>
                <Button
                  mode="contained-tonal"
                  icon="image"
                  onPress={pickImage}
                  style={styles.imageActionBtn}
                  disabled={uploadState === "uploading"}
                >
                  Select
                </Button>
              </View>
            </View>
          )}

          {/* Step 3: Remaining fields (upload runs in parallel) */}
          {flowStep === 3 && (
            <View style={styles.formSection}>
              <Surface style={[styles.imagePicker, styles.imagePickerCompact]} elevation={0}>
                {imageUri ? (
                  <View style={styles.imagePreviewWrap}>
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                  </View>
                ) : null}
              </Surface>
              <View style={styles.imageActions}>
                <Button
                  mode="outlined"
                  icon="camera"
                  onPress={capturePhoto}
                  style={styles.imageActionBtn}
                  compact
                  disabled={uploadState === "uploading"}
                >
                  Retake
                </Button>
                <Button
                  mode="outlined"
                  icon="image"
                  onPress={pickImage}
                  style={styles.imageActionBtn}
                  compact
                  disabled={uploadState === "uploading"}
                >
                  Change photo
                </Button>
              </View>

              {uploadState === "uploading" && (
                <Surface style={styles.uploadBanner} elevation={0}>
                  <ActivityIndicator color={theme.colors.primary} />
                  <Text variant="bodySmall" style={styles.uploadBannerText}>
                    Uploading image… you can fill the form below while this finishes.
                  </Text>
                </Surface>
              )}
              {uploadState === "done" && (
                <Surface style={[styles.uploadBanner, styles.uploadBannerOk]} elevation={0}>
                  <Icon source="check-circle" size={20} color={theme.colors.primary} />
                  <Text variant="bodySmall" style={styles.uploadBannerText}>
                    Image saved on server. Complete the details and save.
                  </Text>
                </Surface>
              )}
              {uploadState === "error" && (
                <Surface style={[styles.uploadBanner, styles.uploadBannerErr]} elevation={0}>
                  <Icon source="alert-circle" size={20} color={theme.colors.error} />
                  <View style={styles.uploadErrBody}>
                    <Text variant="bodySmall" style={styles.uploadBannerText}>
                      {uploadError ?? "Could not upload yet."} You can retry or save at the end.
                    </Text>
                    <Button mode="text" compact onPress={retryUpload} icon="refresh">
                      Retry upload
                    </Button>
                  </View>
                </Surface>
              )}

              <Text variant="labelSmall" style={[styles.fieldLabel, { marginTop: 0 }]}>
                Check In Date & Time *
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

              <Text variant="labelSmall" style={styles.fieldLabel}>
                Vehicle number *
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
                Transport *
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
                Driver name (optional)
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
                Contact (optional)
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

              <Button
                mode="contained"
                onPress={handleSubmit}
                disabled={submitting}
                loading={submitting}
                icon="content-save"
                style={styles.submitButton}
              >
                Save Vehicle
              </Button>
            </View>
          )}
        </List.Section>
      </FormScreenScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listSection: { marginTop: 0 },
  screenHeader: { marginBottom: 8, gap: 4 },
  screenTitle: { fontWeight: "600" },
  backRow: { alignSelf: "flex-start", marginBottom: 4 },
  stepHeading: { marginTop: 12, marginBottom: 8, fontWeight: "600" },
  customerHeading: { marginTop: 20 },
  stepIntro: { marginBottom: 12, opacity: 0.85 },
  stepContinue: { marginTop: 20, borderRadius: 12 },
  stepContinueContent: { flexDirection: "row-reverse", paddingVertical: 8 },
  bigTypeRow: { flexDirection: "row", gap: 12 },
  bigTypeBtn: {
    flex: 1,
    minHeight: 140,
    borderRadius: 16,
    borderWidth: 2,
    overflow: "hidden",
  },
  bigTypeBtnSelected: {
    borderWidth: 2,
  },
  bigTypeInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 6,
    backgroundColor: "#3A3A3C",
  },
  bigTypeLabel: { textAlign: "center" },
  bigTypeHint: { opacity: 0.65, textAlign: "center" },
  formSection: { paddingBottom: 20, gap: 4 },
  fieldLabel: { marginBottom: 4, marginTop: 8 },
  input: { marginBottom: 0 },
  uploadBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#3A3A3C",
  },
  uploadBannerOk: { backgroundColor: "#2D3B2D" },
  uploadBannerErr: { alignItems: "flex-start" },
  uploadBannerText: { flex: 1, opacity: 0.95 },
  uploadErrBody: { flex: 1, gap: 4 },
  imagePickerCompact: {
    height: Math.min(160, IMAGE_PREVIEW_HEIGHT),
    minHeight: 120,
  },
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
