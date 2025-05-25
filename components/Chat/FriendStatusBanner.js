// components/Chat/FriendStatusBanner.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const FriendStatusBanner = ({
  friendStatus,
  handleAddFriendRequest,
  handleCancelRequest,
  handleAcceptRequest,
}) => {
  if (friendStatus === 'friend') return null;

  return (
    <View style={styles.friendStatusBanner}>
      {friendStatus === 'stranger' && (
        <>
          <Text style={styles.bannerText}>Gửi yêu cầu kết bạn tới người này</Text>
          <TouchableOpacity onPress={handleAddFriendRequest} style={styles.bannerButton}>
            <Text style={styles.bannerButtonText}>Gửi kết bạn</Text>
          </TouchableOpacity>
        </>
      )}
      {friendStatus === 'pending_sent' && (
        <>
          <Text style={styles.bannerText}>Bạn đã gửi yêu cầu kết bạn và đang chờ xác nhận</Text>
          <TouchableOpacity onPress={handleCancelRequest} style={[styles.bannerButton, { backgroundColor: '#ff3b30' }]}>
            <Text style={styles.bannerButtonText}>Hủy yêu cầu</Text>
          </TouchableOpacity>
        </>
      )}
      {friendStatus === 'pending_received' && (
        <>
          <Text style={styles.bannerText}>Người này đã gửi lời mời kết bạn</Text>
          <TouchableOpacity onPress={handleAcceptRequest} style={styles.bannerButton}>
            <Text style={styles.bannerButtonText}>Đồng ý</Text>
          </TouchableOpacity>
        </>
      )}
      {friendStatus === 'blocked' && (
        <Text style={styles.bannerText}>Bạn đã chặn người này. Hãy bỏ chặn để nhắn tin.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  friendStatusBanner: {
    backgroundColor: '#fff',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    alignItems: 'center',
  },
  bannerText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
  },
  bannerButton: {
    backgroundColor: '#0068ff',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  bannerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default FriendStatusBanner;