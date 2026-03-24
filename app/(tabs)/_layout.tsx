import { AppTabBar } from "@/components/AppTabBar";
import { Tabs } from "expo-router";
import { Icon } from "react-native-paper";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBar: (props) => <AppTabBar {...props} />,
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Icon
              source={focused ? "home" : "home-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="(search)"
        options={{
          title: "Dock",
          tabBarIcon: ({ color, focused }) => (
            <Icon
              source={focused ? "view-dashboard" : "view-dashboard-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="(settings)"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <Icon
              source={focused ? "cog" : "cog-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
