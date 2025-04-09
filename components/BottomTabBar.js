import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const tabLabels = {
  Messages: 'Tin nhắn',
  Contacts: 'Danh bạ',
  Discover: 'Khám phá',
  Diary: 'Nhật ký',
  Profile: 'Cá nhân',
};

export default function BottomTabBar({ state, descriptors, navigation }) {
  return (
    <View style={styles.container}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = tabLabels[route.name];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tab}
          >
            <Text style={[styles.label, isFocused ? styles.focused : null]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  tab: { alignItems: 'center' },
  label: { fontSize: 12, color: '#666' },
  focused: { color: '#007AFF', fontWeight: 'bold' },
});