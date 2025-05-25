// components/Chat/MessageItem.js
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Text,
  Alert,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Hàm hiển thị thời gian tương đối
const getRelativeTime = (timestamp) => {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffInSeconds = Math.floor((now - messageTime) / 1000);

  if (isNaN(messageTime.getTime())) {
    return '';
  }

  if (diffInSeconds < 60) {
    return `${diffInSeconds} giây trước`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} phút trước`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} giờ trước`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} ngày trước`;
  } else {
    return messageTime.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
};

const MessageItem = ({
  message,
  currentUserId,
  onRecall,
  onDelete,
  onForward,
  isGroup,
  onImagePress,
}) => {
  if (!message) {
    console.warn('MessageItem nhận được tin nhắn không xác định');
    return null;
  }

  const generatePlaceholderAvatar = (name) => {
    const colors = ['#FF6633', '#FFB399', '#FF33FF', '#FFFF99', '#00B3E6'];
    const firstChar = name?.charAt(0)?.toUpperCase() || 'U';
    const color = colors[firstChar.charCodeAt(0) % colors.length];
    return `https://placehold.co/40x40/${color.replace('#', '')}/ffffff?text=${firstChar}`;
  };

  const sender = {
    name:
      message.sender?.name ||
      message.senderName ||
      (message.senderId === currentUserId ? 'Bạn' : 'Người dùng'),
    avatar:
      message.sender?.avatar ||
      message.senderAvatar ||
      generatePlaceholderAvatar(
        message.sender?.name || message.senderName || 'Người dùng'
      ),
  };

  const isCurrentUser = message.senderId === currentUserId;
  const [imageLoadError, setImageLoadError] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isVideoFullScreen, setIsVideoFullScreen] = useState(false);

  const handleForward = () => {
    Alert.prompt('Chuyển tiếp', 'Nhập ID người nhận:', (receiverId) => {
      if (receiverId) {
        onForward(message.messageId || message.id || message.tempId, receiverId);
        setShowActions(false);
      }
    });
  };

  const handleRecall = () => {
    onRecall(message.messageId || message.id || message.tempId);
    setShowActions(false);
  };

  const handleDelete = () => {
    if (message.status === 'recalled') {
      Alert.alert('Thông báo', 'Tin nhắn đã được thu hồi, không thể xóa.');
      return;
    }
    Alert.alert(
      'Xác nhận',
      'Bạn có chắc chắn muốn xóa tin nhắn này không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          onPress: () => onDelete(message.messageId || message.id || message.tempId),
        },
      ],
      { cancelable: true }
    );
    setShowActions(false);
  };

  const handleOpenDocument = async () => {
    try {
      const supported = await Linking.canOpenURL(message.mediaUrl);
      if (supported) {
        await Linking.openURL(message.mediaUrl);
      } else {
        Alert.alert('Lỗi', 'Không thể mở tài liệu. URL không được hỗ trợ.');
      }
    } catch (err) {
      console.error('Lỗi mở tài liệu:', err);
      Alert.alert('Lỗi', 'Không thể mở tài liệu. Vui lòng thử lại.');
    }
  };

  const toggleFullScreenVideo = () => {
    setIsVideoFullScreen(!isVideoFullScreen);
  };

  const videoHtml = `
    <video width="100%" height="100%" controls>
      <source src="${message.mediaUrl}" type="${message.mimeType || 'video/mp4'}">
      Your browser does not support the video tag.
    </video>
  `;

  const fullScreenVideoHtml = `
    <video width="100%" height="100%" controls autoplay>
      <source src="${message.mediaUrl}" type="${message.mimeType || 'video/mp4'}">
      Your browser does not support the video tag.
    </video>
  `;

  return (
    <TouchableOpacity
      onLongPress={() => isCurrentUser && setShowActions(!showActions)}
      activeOpacity={0.8}
    >
      <View
        style={[
          styles.messageWrapper,
          isCurrentUser ? styles.rightWrapper : styles.leftWrapper,
        ]}
      >
        {!isCurrentUser && (
          <Image
            source={{
              uri: avatarLoadError
                ? generatePlaceholderAvatar(sender.name)
                : sender.avatar,
            }}
            style={styles.avatar}
            onError={(e) => {
              setAvatarLoadError(true);
              console.log('Lỗi tải ảnh đại diện:', e.nativeEvent.error);
            }}
          />
        )}
        <View
          style={[
            styles.messageContainer,
            isCurrentUser ? styles.right : styles.left,
          ]}
        >
          {isGroup && !isCurrentUser && (
            <Text style={styles.senderName}>{sender.name}</Text>
          )}
          {message.status === 'recalled' ? (
            <Text style={styles.recalled}>(Tin nhắn đã thu hồi)</Text>
          ) : (
            <View>
              {message.type === 'text' && (
                <Text
                  style={[
                    styles.messageText,
                    isCurrentUser ? styles.rightText : styles.leftText,
                  ]}
                >
                  {typeof message.content === 'string'
                    ? message.content
                    : '(Không có nội dung)'}
                </Text>
              )}
              {message.type === 'image' && message.mediaUrl && (
                <>
                  {Array.isArray(message.mediaUrl) && message.mediaUrl.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageContainer}>
                      {message.mediaUrl.map((url, index) => (
                        <TouchableOpacity
                          key={index}
                          onPress={() => onImagePress(message.mediaUrl, index)}
                        >
                          <Image
                            source={{ uri: url }}
                            style={[styles.messageImage, { marginRight: 5 }]}
                            onError={(e) => {
                              setImageLoadError(true);
                              console.log('Lỗi tải hình ảnh:', e.nativeEvent.error);
                            }}
                          />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <TouchableOpacity onPress={() => onImagePress([message.mediaUrl], 0)}>
                      <Image
                        source={{ uri: message.mediaUrl }}
                        style={styles.messageImage}
                        onError={(e) => {
                          setImageLoadError(true);
                          console.log('Lỗi tải hình ảnh:', e.nativeEvent.error);
                        }}
                      />
                    </TouchableOpacity>
                  )}
                  {imageLoadError && <Text style={styles.errorText}>Không thể tải hình ảnh</Text>}
                </>
              )}
              {message.type === 'video' && message.mediaUrl && (
                <>
                  {imageLoadError ? (
                    <Text style={styles.errorText}>Không thể tải video</Text>
                  ) : (
                    <WebView
                      source={{ html: videoHtml }}
                      style={styles.messageVideo}
                      onError={() => {
                        setImageLoadError(true);
                        console.log('Lỗi tải video trong WebView');
                      }}
                    />
                  )}
                </>
              )}
              {(message.type === 'pdf' ||
                message.type === 'zip' ||
                message.type === 'file') &&
                message.mediaUrl && (
                  <TouchableOpacity onPress={handleOpenDocument}>
                    <Text style={styles.linkText}>
                      📎 {message.fileName || 'Tệp đính kèm'}
                    </Text>
                  </TouchableOpacity>
                )}
              <Text style={styles.timestamp}>
                {message.timestamp ? getRelativeTime(message.timestamp) : ''}
              </Text>
              {isCurrentUser && showActions && (
                <View style={styles.actions}>
                  <TouchableOpacity onPress={handleRecall}>
                    <Text style={styles.actionText}>Thu hồi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDelete}>
                    <Text style={styles.actionText}>Xóa</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleForward}>
                    <Text style={styles.actionText}>Chuyển tiếp</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          {message.status === 'error' && (
            <Text style={styles.errorText}>Lỗi gửi tin nhắn</Text>
          )}
        </View>
      </View>
      {isVideoFullScreen && message.mediaUrl && (
        <Modal visible={isVideoFullScreen} animationType="fade">
          <View style={styles.fullScreenContainer}>
            <WebView
              source={{ html: fullScreenVideoHtml }}
              style={styles.fullScreenVideo}
              onError={() => console.log('Lỗi tải video toàn màn hình trong WebView')}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={toggleFullScreenVideo}
            >
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  messageWrapper: {
    marginVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  leftWrapper: {
    justifyContent: 'flex-start',
  },
  rightWrapper: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
  },
  messageContainer: {
    padding: 10,
    borderRadius: 15,
    maxWidth: '75%',
  },
  left: {
    backgroundColor: '#fff',
    borderRadius: 15,
  },
  right: {
    backgroundColor: '#e1f0ff',
    borderRadius: 15,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
  },
  leftText: {
    color: '#000',
  },
  rightText: {
    color: '#000',
  },
  messageImage: {
    width: 180,
    height: 180,
    borderRadius: 10,
    marginVertical: 5,
  },
  imageContainer: {
    flexDirection: 'row',
    marginVertical: 5,
  },
  messageVideo: {
    width: 180,
    height: 180,
    borderRadius: 10,
    marginVertical: 5,
    alignSelf: 'center',
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenVideo: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
  },
  recalled: {
    fontStyle: 'italic',
    color: '#888',
    fontSize: 14,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 15,
    textDecorationLine: 'underline',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  actionText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    color: '#ff3b30',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'left',
  },
});

export default MessageItem;