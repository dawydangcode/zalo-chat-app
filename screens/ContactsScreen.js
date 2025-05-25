import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  getFriends,
  getReceivedFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getSentFriendRequests,
  cancelFriendRequest,
} from '../services/api';
import { AuthContext } from '../context/AuthContext';

const ContactsScreen = () => {
  const [friends, setFriends] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequestIds, setSentRequestIds] = useState({});
  const [sentRequests, setSentRequests] = useState([]);
  const navigation = useNavigation();
  const { auth, logout } = useContext(AuthContext);

  useFocusEffect(
    React.useCallback(() => {
      const fetchData = async () => {
        try {
          if (auth.token) {
            await Promise.all([
              fetchFriends(auth.token),
              fetchReceivedRequests(auth.token),
              fetchSentRequests(auth.token),
            ]);
          } else {
            Alert.alert('Lỗi', 'Vui lòng đăng nhập lại.');
            navigation.navigate('Login');
          }
        } catch (error) {
          console.error('Lỗi khi lấy dữ liệu:', error);
          Alert.alert('Lỗi', 'Không thể lấy dữ liệu.');
        }
      };
      fetchData();
    }, [auth.token])
  );

  const fetchFriends = async (authToken) => {
    try {
      if (!authToken) throw new Error('Không tìm thấy token xác thực.');
      const response = await getFriends(authToken);
      if (Array.isArray(response.data)) {
        const uniqueFriends = [];
        const friendIds = new Set();
        for (const friend of response.data) {
          if (friend.friendId && !friendIds.has(friend.friendId)) {
            friendIds.add(friend.friendId);
            uniqueFriends.push(friend);
          }
        }
        console.log('Friends (filtered):', uniqueFriends);
        setFriends(uniqueFriends || []);
      } else {
        Alert.alert('Lỗi', 'Dữ liệu bạn bè không hợp lệ.');
        setFriends([]);
      }
    } catch (error) {
      console.error('Lỗi khi lấy danh sách bạn bè:', error);
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else {
        Alert.alert('Lỗi', `Không thể lấy danh sách bạn bè: ${error.message}`);
        setFriends([]);
      }
    }
  };

  const fetchReceivedRequests = async (authToken) => {
    try {
      if (!authToken) throw new Error('Không tìm thấy token xác thực.');
      const response = await getReceivedFriendRequests(authToken);
      if (Array.isArray(response.data)) {
        const uniqueRequests = [];
        const requestIds = new Set();
        for (const req of response.data) {
          if (req.requestId && !requestIds.has(req.requestId)) {
            requestIds.add(req.requestId);
            uniqueRequests.push(req);
          }
        }
        console.log('Received requests (filtered):', uniqueRequests);
        setReceivedRequests(uniqueRequests || []);
      } else {
        Alert.alert('Lỗi', 'Dữ liệu yêu cầu kết bạn nhận được không hợp lệ.');
        setReceivedRequests([]);
      }
    } catch (error) {
      console.error('Lỗi khi lấy danh sách yêu cầu nhận được:', error);
      Alert.alert('Lỗi', `Không thể lấy danh sách yêu cầu nhận được: ${error.message}`);
      setReceivedRequests([]);
    }
  };

  const fetchSentRequests = async (authToken) => {
    try {
      if (!authToken) throw new Error('Không tìm thấy token xác thực.');
      const response = await getSentFriendRequests(authToken);
      if (Array.isArray(response.data)) {
        const sentRequests = response.data || [];
        const newSentRequestIds = {};
        const sentRequestDetails = sentRequests.map((req) => ({
          userId: req.receiverInfo?.userId || '',
          requestId: req.requestId || '',
          name: req.receiverInfo?.name || 'Không có tên',
          avatar: req.receiverInfo?.avatar || 'https://via.placeholder.com/50',
        }));
        sentRequests.forEach((req) => {
          if (req.receiverInfo?.userId && req.requestId) {
            newSentRequestIds[req.receiverInfo.userId] = req.requestId;
          }
        });
        console.log('Sent requests (filtered):', sentRequestDetails);
        setSentRequestIds(newSentRequestIds);
        setSentRequests(sentRequestDetails);
        return sentRequestDetails;
      } else {
        Alert.alert('Lỗi', 'Dữ liệu yêu cầu kết bạn không hợp lệ.');
        setSentRequestIds({});
        setSentRequests([]);
        return [];
      }
    } catch (error) {
      console.error('Lỗi khi lấy danh sách yêu cầu đã gửi:', error);
      setSentRequestIds({});
      setSentRequests([]);
      Alert.alert('Lỗi', `Không thể lấy danh sách yêu cầu đã gửi: ${error.message}`);
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
      return [];
    }
  };

  const acceptFriendRequestHandler = async (requestId) => {
    try {
      const response = await acceptFriendRequest(requestId, auth.token);
      if (response.status === 200 && (response.data.success || response.data.message === 'Đã chấp nhận kết bạn')) {
        Alert.alert('Thành công', 'Bạn đã chấp nhận yêu cầu kết bạn!');
        setReceivedRequests((prev) => prev.filter((req) => req.requestId !== requestId));
        await fetchFriends(auth.token);
        await fetchReceivedRequests(auth.token);
      } else {
        throw new Error(response.data.message || 'Không thể chấp nhận yêu cầu kết bạn.');
      }
    } catch (error) {
      console.error('Lỗi khi chấp nhận yêu cầu kết bạn:', error);
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else if (error.response?.status === 409) {
        Alert.alert('Thông báo', 'Yêu cầu kết bạn này đã được xử lý trước đó.');
        setReceivedRequests((prev) => prev.filter((req) => req.requestId !== requestId));
        await fetchReceivedRequests(auth.token);
      } else {
        Alert.alert('Lỗi', error.response?.data?.message || error.message || 'Có lỗi xảy ra khi chấp nhận yêu cầu kết bạn.');
      }
    }
  };

  const rejectFriendRequestHandler = async (requestId, senderId) => {
    try {
      const response = await rejectFriendRequest(requestId, auth.token);
      if (response.status === 200 && response.data.success) {
        setReceivedRequests((prev) => prev.filter((req) => req.requestId !== requestId));
        await fetchReceivedRequests(auth.token);
      } else {
        throw new Error(response.data.message || 'Không thể từ chối yêu cầu kết bạn.');
      }
    } catch (error) {
      console.error('Lỗi khi từ chối yêu cầu kết bạn:', error);
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else if (error.response?.status === 409) {
        Alert.alert('Thông báo', 'Yêu cầu kết bạn này đã được xử lý trước đó.');
        setReceivedRequests((prev) => prev.filter((req) => req.requestId !== requestId));
        await fetchReceivedRequests(auth.token);
      } else {
        Alert.alert('Lỗi', error.response?.data?.message || error.message || 'Có lỗi xảy ra khi từ chối yêu cầu kết bạn.');
      }
    }
  };

  const cancelFriendRequestHandler = async (requestId, targetUserId) => {
    try {
      if (!auth.token) throw new Error('Không tìm thấy token xác thực.');
      if (!requestId || typeof requestId !== 'string') {
        throw new Error('ID yêu cầu không hợp lệ.');
      }
      await cancelFriendRequest(requestId, auth.token);

      // Hủy thành công hoặc lỗi, kiểm tra danh sách yêu cầu
      const updatedRequests = await fetchSentRequests(auth.token);
      const isRequestCanceled = !updatedRequests.some((req) => req.requestId === requestId);

      if (isRequestCanceled) {
        setSentRequestIds((prev) => {
          const newSentRequestIds = { ...prev };
          delete newSentRequestIds[targetUserId];
          return newSentRequestIds;
        });
        setSentRequests((prev) => prev.filter((req) => req.requestId !== requestId));
        Alert.alert('Thành công', 'Yêu cầu kết bạn đã được hủy.');
      } else {
        throw new Error('Không thể hủy yêu cầu kết bạn.');
      }
    } catch (error) {
      console.error('Lỗi khi hủy yêu cầu kết bạn:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      // Xử lý lỗi 401 riêng
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else {
        // Kiểm tra danh sách yêu cầu cho các lỗi khác (bao gồm 500 và 404)
        const updatedRequests = await fetchSentRequests(auth.token);
        const isRequestCanceled = !updatedRequests.some((req) => req.requestId === requestId);

        if (isRequestCanceled) {
          setSentRequestIds((prev) => {
            const newSentRequestIds = { ...prev };
            delete newSentRequestIds[targetUserId];
            return newSentRequestIds;
          });
          setSentRequests((prev) => prev.filter((req) => req.requestId !== requestId));
          Alert.alert('Thành công', 'Yêu cầu kết bạn đã được hủy.');
        } else {
          Alert.alert(
            'Lỗi',
            'Có lỗi xảy ra khi hủy yêu cầu kết bạn. Vui lòng thử lại sau.'
          );
        }
      }
    }
  };

  const renderFriendItem = ({ item }) => (
    <View style={styles.friendItem}>
      <Image
        source={{ uri: item.user?.avatar || 'https://via.placeholder.com/50' }}
        style={styles.friendAvatar}
      />
      <Text style={styles.friendName}>{item.user?.name || 'Không có tên'}</Text>
    </View>
  );

  const renderSentRequestItem = ({ item }) => {
    const { requestId, userId, name, avatar } = item;

    if (!requestId || !userId) {
      console.warn('Dữ liệu yêu cầu không hợp lệ:', item);
      return null;
    }

    return (
      <View style={styles.requestItem}>
        <View style={styles.requestInfo}>
          <Image
            source={{ uri: avatar }}
            style={styles.requestAvatar}
            defaultSource={{ uri: 'https://via.placeholder.com/50' }}
          />
          <Text style={styles.requestName}>{name}</Text>
        </View>
        <View style={styles.requestActions}>
          <View style={[styles.statusButton, styles.pendingButton]}>
            <Text style={styles.addFriendText}>Đã gửi</Text>
          </View>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() =>
              Alert.alert(
                'Xác nhận',
                'Bạn có chắc muốn hủy yêu cầu kết bạn này không?',
                [
                  { text: 'Hủy', style: 'cancel' },
                  { text: 'Đồng ý', onPress: () => cancelFriendRequestHandler(requestId, userId) },
                ]
              )
            }
          >
            <Text style={styles.addFriendText}>Hủy</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderRequestItem = ({ item }) => (
    <View style={styles.requestItem}>
      <View style={styles.requestInfo}>
        <Image
          source={{ uri: item.senderInfo?.avatar || 'https://via.placeholder.com/50' }}
          style={styles.requestAvatar}
        />
        <Text style={styles.requestName}>{item.senderInfo?.name || 'Không có tên'}</Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => acceptFriendRequestHandler(item.requestId)}
        >
          <Text style={styles.addFriendText}>Chấp nhận</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => rejectFriendRequestHandler(item.requestId, item.senderInfo.userId)}
        >
          <Text style={styles.addFriendText}>Từ chối</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Danh bạ</Text>
      </View>

      <View style={styles.listSection}>
        {receivedRequests.length > 0 && (
          <FlatList
            data={receivedRequests}
            renderItem={renderRequestItem}
            keyExtractor={(item) => item.requestId}
            style={styles.requestList}
            ListHeaderComponent={<Text style={styles.listTitle}>Danh sách yêu cầu nhận được</Text>}
          />
        )}

        {sentRequests.length > 0 && (
          <FlatList
            data={sentRequests}
            renderItem={renderSentRequestItem}
            keyExtractor={(item) => `${item.requestId}-${item.userId}`}
            style={styles.requestList}
            ListHeaderComponent={<Text style={styles.listTitle}>Danh sách yêu cầu đã gửi</Text>}
          />
        )}

        {friends.length > 0 && (
          <FlatList
            data={friends}
            renderItem={renderFriendItem}
            keyExtractor={(item) => item.friendId}
            style={styles.friendList}
            ListHeaderComponent={<Text style={styles.listTitle}>Danh sách bạn bè</Text>}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 15,
    backgroundColor: '#0068ff',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginVertical: 10,
  },
  friendList: {
    marginBottom: 20,
  },
  friendItem: {
    flexDirection: 'row',
    paddingVertical: 10,
    alignItems: 'center',
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 15,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  requestList: {
    marginBottom: 20,
  },
  requestItem: {
    flexDirection: 'row',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 15,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  requestActions: {
    flexDirection: 'row',
  },
  acceptButton: {
    backgroundColor: '#28a745',
    padding: 8,
    borderRadius: 15,
    marginRight: 5,
  },
  rejectButton: {
    backgroundColor: '#dc3545',
    padding: 8,
    borderRadius: 15,
    marginRight: 5,
  },
  statusButton: {
    padding: 8,
    borderRadius: 15,
    marginRight: 5,
  },
  pendingButton: {
    backgroundColor: '#6c757d',
    padding: 8,
    borderRadius: 15,
  },
  cancelButton: {
    backgroundColor: '#dc3545',
    padding: 8,
    borderRadius: 15,
  },
  addFriendText: {
    color: '#fff',
    fontSize: 14,
  },
});

export default ContactsScreen;