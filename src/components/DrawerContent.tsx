/**
 * DrawerContent — left-side drawer with menu items.
 *
 * Currently a single placeholder item ("Settings"). Will host POI selection
 * and Loxone config in a follow-up task.
 */
import { StyleSheet, Text, View } from 'react-native';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Typography } from '../constants/designSystem';
import { useColors } from '../hooks/useColors';

export function DrawerContent(props: any) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + Spacing.lg, backgroundColor: colors.background.primary },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.appName, { color: colors.label.primary }]}>Meteoblick</Text>
      </View>
      <DrawerItem
        label="Settings"
        icon={({ size }: { size: number }) => (
          <Text style={[styles.itemIcon, { fontSize: size, color: colors.label.primary }]}>⚙️</Text>
        )}
        onPress={() => {
          // Close drawer first so it's hidden when the Settings modal slides in.
          props.navigation.closeDrawer();
          // Settings is registered in the nested Stack ("Main"), so we must
          // navigate into the parent route and target the screen there.
          props.navigation.navigate('Main', { screen: 'Settings' });
        }}
        labelStyle={[styles.itemLabel, { color: colors.label.primary }]}
      />
      <DrawerItem
        label="Debug"
        icon={({ size }: { size: number }) => (
          <Text style={[styles.itemIcon, { fontSize: size, color: colors.label.primary }]}>🛠️</Text>
        )}
        onPress={() => {
          props.navigation.closeDrawer();
          // Debug is a Stack modal inside "Main", so navigate into the parent
          // route and target the screen there.
          props.navigation.navigate('Main', { screen: 'Debug' });
        }}
        labelStyle={[styles.itemLabel, { color: colors.label.primary }]}
      />
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  appName: {
    ...Typography.title3,
  },
  itemIcon: {
  },
  itemLabel: {
    ...Typography.body,
  },
});