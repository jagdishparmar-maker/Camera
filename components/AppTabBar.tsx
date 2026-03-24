import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { CommonActions } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Platform, StyleSheet } from "react-native";
import { BottomNavigation, Icon, useTheme } from "react-native-paper";

/**
 * Material Design 3 bottom bar for Expo Router + React Navigation tabs.
 */
export function AppTabBar({
  navigation,
  state,
  descriptors,
  insets,
}: BottomTabBarProps) {
  const theme = useTheme();
  const barBg =
    theme.colors.elevation?.level2 ?? theme.colors.surface ?? theme.colors.background;

  return (
    <BottomNavigation.Bar
      navigationState={state}
      safeAreaInsets={insets}
      shifting={false}
      labeled
      activeColor={theme.colors.primary}
      inactiveColor={theme.colors.onSurfaceVariant}
      activeIndicatorStyle={{
        backgroundColor: theme.colors.primaryContainer,
        borderRadius: 22,
      }}
      style={[
        styles.bar,
        {
          backgroundColor: barBg,
          borderTopColor: theme.colors.outlineVariant,
        },
      ]}
      onTabPress={({ route, preventDefault }) => {
        if (Platform.OS !== "web") {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        const event = navigation.emit({
          type: "tabPress",
          target: route.key,
          canPreventDefault: true,
        });
        if (event.defaultPrevented) {
          preventDefault();
        } else {
          navigation.dispatch({
            ...CommonActions.navigate(route.name, route.params),
            target: state.key,
          });
        }
      }}
      renderIcon={({ route, focused, color }) => {
        const { options } = descriptors[route.key] ?? {};
        return (
          options?.tabBarIcon?.({ focused, color, size: 24 }) ?? (
            <Icon source="circle-outline" size={24} color={color} />
          )
        );
      }}
      getLabelText={({ route }) => {
        const { options } = descriptors[route.key] ?? {};
        const label =
          typeof options?.tabBarLabel === "string"
            ? options.tabBarLabel
            : typeof options?.title === "string"
              ? options.title
              : route.name;
        return label ?? "";
      }}
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
