import { StyleSheet, View } from "react-native";
import { List, useTheme } from "react-native-paper";

export default function SettingsScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <List.Section>
        <List.Subheader>Settings</List.Subheader>
        <List.Item
          title="Notifications"
          description="Configure notification preferences"
          left={(props) => <List.Icon {...props} icon="bell-outline" />}
        />
        <List.Item
          title="About"
          description="App version and info"
          left={(props) => <List.Icon {...props} icon="information-outline" />}
        />
      </List.Section>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
});
