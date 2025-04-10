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
    borderTopColor: '#e0e0e0',
    elevation: 8, // Bóng đổ cho Android
    shadowColor: '#000', // Bóng đổ cho iOS
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tab: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  label: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'System', // Có thể thay bằng font custom nếu muốn
  },
  focused: {
    color: '#005AE0', // Màu chủ đạo
    fontWeight: '600',
  },
});