import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function ProfileOptionsScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.option}
        onPress={() => navigation.navigate('ProfileInfo')}
      >
        <Text style={styles.optionText}>Thông tin</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.option}
        onPress={() => navigation.navigate('ChangePassword')}
      >
        <Text style={styles.optionText}>Quản lý tài khoản</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  option: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#ddd' },
  optionText: { fontSize: 18, color: '#005AE0', textAlign: 'center' },
});