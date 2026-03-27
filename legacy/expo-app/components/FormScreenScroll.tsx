import { useHeaderHeight } from "@react-navigation/elements";
import type { ComponentProps, ReactNode } from "react";
import { Platform, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

type Props = Omit<
  ComponentProps<typeof KeyboardAwareScrollView>,
  "enableOnAndroid" | "enableAutomaticScroll"
> & {
  children: ReactNode;
};

export function FormScreenScroll({
  children,
  style,
  contentContainerStyle,
  ...rest
}: Props) {
  const headerHeight = useHeaderHeight();

  return (
    <KeyboardAwareScrollView
      style={[styles.flex, style]}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      enableOnAndroid
      enableAutomaticScroll
      enableResetScrollToCoords={false}
      extraScrollHeight={Platform.OS === "ios" ? 32 : 48}
      extraHeight={Platform.OS === "ios" ? 96 : 120}
      keyboardOpeningTime={Platform.OS === "android" ? 250 : 0}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator
      keyboardVerticalOffset={headerHeight + (Platform.OS === "ios" ? 12 : 20)}
      nestedScrollEnabled
      {...rest}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 120, paddingHorizontal: 16, paddingTop: 8 },
});
