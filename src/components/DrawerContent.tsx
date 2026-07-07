/**
 * DrawerContent — left-side drawer with menu items.
 *
 * Currently a single placeholder item ("Settings"). Will host POI selection
 * and Loxone config in a follow-up task.
 */
import { StyleSheet, Text, View } from 'react-native';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography } from '../constants/designSystem';

export function DrawerContent(props: any) {
  const insets = useSafeAreaInsets();
  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + Spacing.lg },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.appName}>Meteoblick</Text>
      </View>
      <DrawerItem
        label="Settings"
        icon={({ size }: { size: number }) => (
          <Text style={[styles.itemIcon, { fontSize: size }]}>⚙️</Text>
        )}
        onPress={() => {
          // Close drawer first so it's hidden when the Settings modal slides in.
          props.navigation.closeDrawer();
          // Settings is registered in the nested Stack ("Main"), so we must
          // navigate into the parent route and target the screen there.
          props.navigation.navigate('Main', { screen: 'Settings' });
        }}
        labelStyle={styles.itemLabel}
      />
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  appName: {
    ...Typography.title3,
    color: Colors.label.primary,
  },
  itemIcon: {
    color: Colors.label.primary,
  },
  itemLabel: {
    ...Typography.body,
    color: Colors.label.primary,
  },
});