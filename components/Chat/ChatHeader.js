// components/Chat/ChatHeader.js
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ChatHeader = ({
  navigation,
  receiverName,
  avatar,
  isGroup,
  headerAvatarLoadError,
  setHeaderAvatarLoadError,
  handleAddMemberClick,
  showOptionsMenu,
  generatePlaceholderAvatar,
}) => {
  return {
    headerShown: true,
    headerStyle: { backgroundColor: '#0068ff' },
    headerTintColor: '#fff',
    headerLeft: () => (
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerLeft}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
    ),
    headerTitle: () => (
      <View style={styles.headerContainer}>
        <Image
          source={{
            uri: headerAvatarLoadError
              ? generatePlaceholderAvatar(receiverName || 'Không có tên')
              : avatar,
          }}
          style={styles.headerAvatar}
          onError={(e) => {
            setHeaderAvatarLoadError(true);
            console.log('Lỗi tải ảnh đại diện trong header:', e.nativeEvent.error);
          }}
        />
        <View>
          <Text style={styles.headerTitle}>
            {typeof receiverName === 'string' && receiverName ? receiverName : 'Không có tên'}
          </Text>
          <Text style={styles.headerSubtitle}>{isGroup === true ? 'Nhóm chat' : 'Người dùng'}</Text>
        </View>
      </View>
    ),
    headerRight: () => (
      <View style={styles.headerRight}>
        <TouchableOpacity onPress={handleAddMemberClick} style={styles.headerButton}>
          <Ionicons name="person-add" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={showOptionsMenu} style={styles.headerButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    ),
  };
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLeft: {
    marginLeft: 10,
  },
  headerRight: {
    flexDirection: 'row',
    marginRight: 10,
  },
  headerButton: {
    marginLeft: 10,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    fontStyle: 'italic',
  },
});

export default ChatHeader;