import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import { Icon, type IconName } from '../../src/components/Icon';
import { colors, type } from '../../src/theme/tokens';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { title: string; icon: IconName }> = {
  index: { title: 'Home', icon: 'home' },
  companies: { title: 'Companies', icon: 'briefcase' },
  settings: { title: 'Settings', icon: 'settings' },
};

function TabBar({ state, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.ground, borderTopWidth: 1, borderTopColor: colors.rule, paddingBottom: insets.bottom }}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const tab = TABS[route.name];
        if (!tab) return null;
        const onPress = () => {
          const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <Pressable
            key={route.key} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }}
            style={({ pressed }) => ({
              flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2,
              backgroundColor: pressed ? colors.pressed : colors.ground,
            })}
          >
            {focused && <View style={{ position: 'absolute', top: -1, left: '20%', right: '20%', height: 2, backgroundColor: colors.accent }} />}
            <Icon name={tab.icon} size={20} color={focused ? colors.text : colors.muted} />
            <Text maxFontSizeMultiplier={1.6} style={[type.bubble, { color: focused ? colors.text : colors.muted }]}>{tab.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={p => <TabBar {...p} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.ground } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="companies" options={{ title: 'Companies' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
