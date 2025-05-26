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

// Hàm tính thời gian tương đối (ví dụ: "5 phút trước", "2 giờ trước")
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
  onPin,
  onUnpin,
  isPinnedBanner = false,
}) => {
  if (!message) {
    console.warn('MessageItem nhận được tin nhắn không xác định');
    return null;
  }

  // Tạo ảnh đại diện mặc định nếu không có ảnh đại diện
  const generatePlaceholderAvatar = (name) => {
    const colors = ['#FF6633', '#FFB399', '#FF33FF', '#FFFF99', '#00B3E6'];
    const firstChar = name?.charAt(0)?.toUpperCase() || 'U';
    const color = colors[firstChar.charCodeAt(0) % colors.length];
    return `https://placehold.co/40x40/${color.replace('#', '')}/ffffff?text=${firstChar}`;
  };

  // Thông tin người gửi
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

  // Xử lý chuyển tiếp tin nhắn
  const handleForward = () => {
    if (!message.messageId) {
      console.warn('Không tìm thấy messageId để chuyển tiếp:', message);
      Alert.alert('Lỗi', 'Không thể chuyển tiếp tin nhắn này.');
      return;
    }
    Alert.prompt('Chuyển tiếp', 'Nhập ID người nhận:', (receiverId) => {
      if (receiverId) {
        onForward(message.messageId, receiverId);
        setShowActions(false);
      }
    });
  };

  // Xử lý thu hồi tin nhắn
  const handleRecall = () => {
    if (!message.messageId) {
      console.warn('Không tìm thấy messageId để thu hồi:', message);
      Alert.alert('Lỗi', 'Không thể thu hồi tin nhắn này.');
      return;
    }
    onRecall(message.messageId);
    setShowActions(false);
  };

  // Xử lý xóa tin nhắn
  const handleDelete = () => {
    if (message.status === 'recalled') {
      Alert.alert('Thông báo', 'Tin nhắn đã được thu hồi, không thể xóa.');
      return;
    }
    if (!message.messageId) {
      console.warn('Không tìm thấy messageId để xóa:', message);
      Alert.alert('Lỗi', 'Không thể xóa tin nhắn này.');
      return;
    }
    Alert.alert(
      'Xác nhận',
      'Bạn có chắc chắn muốn xóa tin nhắn này không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          onPress: () => onDelete(message.messageId),
        },
      ],
      { cancelable: true }
    );
    setShowActions(false);
  };

  // Xử lý ghim tin nhắn
  const handlePin = () => {
    if (!message.messageId) {
      console.warn('Không tìm thấy messageId để ghim:', message);
      Alert.alert('Lỗi', 'Không thể ghim tin nhắn này.');
      return;
    }
    console.log('Pinning message with messageId:', message.messageId);
    onPin(message.messageId);
    setShowActions(false);
  };

  // Xử lý bỏ ghim tin nhắn
  const handleUnpin = () => {
    if (!message.messageId) {
      console.warn('Không tìm thấy messageId để bỏ ghim:', message);
      Alert.alert('Lỗi', 'Không thể bỏ ghim tin nhắn này.');
      return;
    }
    console.log('Unpinning message with messageId:', message.messageId);
    onUnpin(message.messageId);
    setShowActions(false);
  };

  // Xử lý mở tài liệu
  const handleOpenDocument = async () => {
    try {
      const url = Array.isArray(message.mediaUrl) ? message.mediaUrl[0] : message.mediaUrl;
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Lỗi', 'Không thể mở tài liệu. URL không được hỗ trợ.');
      }
    } catch (err) {
      console.error('Lỗi mở tài liệu:', err);
      Alert.alert('Lỗi', 'Không thể mở tài liệu. Vui lòng thử lại.');
    }
  };

  // Chuyển đổi chế độ toàn màn hình cho video
  const toggleFullScreenVideo = () => {
    setIsVideoFullScreen(!isVideoFullScreen);
  };

  const videoHtml = `
    <video width="100%" height="100%" controls>
      <source src="${Array.isArray(message.mediaUrl) ? message.mediaUrl[0] : message.mediaUrl}" type="${message.mimeType || 'video/mp4'}">
      Your browser does not support the video tag.
    </video>
  `;

  const fullScreenVideoHtml = `
    <video width="100%" height="100%" controls autoplay>
      <source src="${Array.isArray(message.mediaUrl) ? message.mediaUrl[0] : message.mediaUrl}" type="${message.mimeType || 'video/mp4'}">
      Your browser does not support the video tag.
    </video>
  `;

  // Hiển thị tin nhắn trong bảng ghim (pinned banner)
  if (isPinnedBanner) {
    return (
      <TouchableOpacity
        onLongPress={() => setShowActions(!showActions)}
        activeOpacity={0.8}
        style={styles.pinnedBannerContainer}
      >
        <View style={styles.pinnedBannerContent}>
          {message.status === 'recalled' ? (
            <Text style={styles.recalled}>(Tin nhắn đã thu hồi)</Text>
          ) : (
            <>
              {message.type === 'text' && (
                <Text style={styles.pinnedBannerText}>
                  {typeof message.content === 'string'
                    ? message.content
                    : '(Không có nội dung)'}
                </Text>
              )}
              {message.type === 'image' && message.mediaUrl && (
                <Text style={styles.pinnedBannerText}>[Hình ảnh]</Text>
              )}
              {message.type === 'video' && message.mediaUrl && (
                <Text style={styles.pinnedBannerText}>[Video]</Text>
              )}
              {(message.type === 'pdf' ||
                message.type === 'zip' ||
                message.type === 'file') &&
                message.mediaUrl && (
                  <Text style={styles.pinnedBannerText}>
                    📎 {message.fileName || 'Tệp đính kèm'}
                  </Text>
                )}
            </>
          )}
          {showActions && (
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
              {message.isPinned ? (
                <TouchableOpacity onPress={handleUnpin}>
                  <Text style={styles.actionText}>Bỏ ghim</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handlePin}>
                  <Text style={styles.actionText}>Ghim</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // Hiển thị tin nhắn trong khung trò chuyện chính
  return (
    <TouchableOpacity
      onLongPress={() => setShowActions(!showActions)}
      activeOpacity={0.8}
    >
      <View
        style={[
          styles.messageWrapper,
          isCurrentUser ? styles.rightWrapper : styles.leftWrapper,
          message.isPinned ? styles.pinnedWrapper : null,
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
              console.log('Lỗi tải ảnh đại diện:', e.nativeEvent.error);
              setAvatarLoadError(true);
            }}
          />
        )}
        <View
          style={[
            styles.messageContainer,
            isCurrentUser ? styles.right : styles.left,
            message.isPinned ? styles.pinnedContainer : null,
          ]}
        >
          {isGroup && !isCurrentUser && (
            <Text style={styles.senderName}>{sender.name}</Text>
          )}
          {message.status === 'recalled' ? (
            <Text style={styles.recalled}>(Tin nhắn đã thu hồi)</Text>
          ) : (
            <View>
              {/* Biểu tượng ghim chỉ hiển thị trong bảng ghim (isPinnedBanner = true) */}
              {isPinnedBanner && message.isPinned && (
                <Ionicons
                  name="pin"
                  size={16}
                  color="#FFD700"
                  style={styles.pinnedIcon}
                />
              )}
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
                    <ScrollView
                      showsHorizontalScrollIndicator={false}
                      style={styles.imageContainer}
                      horizontal
                    >
                      {message.mediaUrl.map((url, index) => (
                        <TouchableOpacity
                          onPress={() => onImagePress(message.mediaUrl, index)}
                          key={index}
                        >
                          <Image
                            source={{ uri: url }}
                            style={[styles.messageImage, { marginRight: 5 }]}
                            onError={(e) => {
                              console.log('Lỗi tải hình ảnh:', e.nativeEvent.error);
                              setImageLoadError(true);
                            }}
                          />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <TouchableOpacity
                      onPress={() => onImagePress([message.mediaUrl], 0)}
                    >
                      <Image
                        source={{ uri: message.mediaUrl }}
                        style={styles.messageImage}
                        onError={(e) => {
                          console.log('Lỗi tải hình ảnh:', e.nativeEvent.error);
                          setImageLoadError(true);
                        }}
                      />
                    </TouchableOpacity>
                  )}
                  {imageLoadError && (
                    <Text style={styles.errorText}>Không thể tải hình ảnh</Text>
                  )}
                </>
              )}
              {message.type === 'video' && message.mediaUrl && (
                <>
                  {imageLoadError ? (
                    <Text style={styles.errorText}>Không thể tải video</Text>
                  ) : (
                    <TouchableOpacity onPress={toggleFullScreenVideo}>
                      <WebView
                        source={{ html: videoHtml }}
                        style={styles.messageVideo}
                        onError={() => {
                          console.log('Lỗi tải video trong WebView');
                          setImageLoadError(true);
                        }}
                        allowsInlineMediaPlayback
                        mediaPlaybackRequiresUserAction={false}
                      />
                    </TouchableOpacity>
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
              {showActions && (
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
                  {message.isPinned ? (
                    <TouchableOpacity onPress={handleUnpin}>
                      <Text style={styles.actionText}>Bỏ ghim</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={handlePin}>
                      <Text style={styles.actionText}>Ghim</Text>
                    </TouchableOpacity>
                  )}
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
              allowsInlineMediaPlayback
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
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

// Định nghĩa các kiểu dáng (styles)
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
  pinnedWrapper: {
    backgroundColor: '#FFF8E1', // Màu nền vàng nhạt cho tin nhắn được ghim
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
    backgroundColor: '#fff', // Màu nền trắng cho tin nhắn bên trái
    borderRadius: 15,
  },
  right: {
    backgroundColor: '#e1f0ff', // Màu nền xanh nhạt cho tin nhắn bên phải
    borderRadius: 15,
  },
  pinnedContainer: {
    borderWidth: 1,
    borderColor: '#FFD700', // Viền vàng cho tin nhắn được ghim
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
    padding: 6,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    maxWidth: '100%',
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  actionText: {
    marginHorizontal: 6,
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    flexShrink: 1,
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
  pinnedIcon: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  pinnedBannerContainer: {
    flex: 1,
  },
  pinnedBannerContent: {
    flex: 1,
  },
  pinnedBannerText: {
    fontSize: 14,
    color: '#000',
  },
});

export default MessageItem;