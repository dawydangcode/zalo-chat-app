import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  getReceivedFriendRequests,
  getSentFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
} from '../services/api';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api'; // Import default export

export default function ContactsScreen() {
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const { auth, logout } = useContext(AuthContext);
  const navigation = useNavigation();

  useEffect(() => {
    if (auth.token && auth.userId) {
      fetchReceivedRequests(auth.token);
      fetchSentRequests(auth.token);
      fetchFriendsList(auth.token);
    } else {
      Alert.alert('Lỗi', 'Vui lòng đăng nhập lại.');
      navigation.navigate('Login');
    }
  }, [auth.token, auth.userId]);

  const fetchReceivedRequests = async (authToken) => {
    try {
      const response = await getReceivedFriendRequests(authToken);
      console.log('Phản hồi từ API getReceivedFriendRequests:', response.data);
      if (Array.isArray(response.data)) {
        setReceivedRequests(response.data);
      } else {
        throw new Error('Dữ liệu trả về không đúng định dạng.');
      }
    } catch (error) {
      console.error('Lỗi khi lấy danh sách yêu cầu kết bạn:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else if (error.response?.status === 500) {
        Alert.alert(
          'Lỗi',
          error.response?.data?.error || 'Không thể lấy danh sách yêu cầu kết bạn do lỗi hệ thống. Vui lòng thử lại sau.'
        );
      } else {
        Alert.alert(
          'Lỗi',
          error.message || 'Có lỗi xảy ra khi lấy danh sách yêu cầu kết bạn. Vui lòng thử lại.'
        );
      }
    }
  };

  const fetchSentRequests = async (authToken) => {
    try {
      const response = await getSentFriendRequests(authToken);
      console.log('Phản hồi từ API getSentFriendRequests:', response.data);
      if (Array.isArray(response.data)) {
        setSentRequests(response.data);
      } else {
        throw new Error('Dữ liệu trả về không đúng định dạng.');
      }
    } catch (error) {
      console.error('Lỗi khi lấy danh sách yêu cầu đã gửi:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else if (error.response?.status === 500) {
        Alert.alert(
          'Lỗi',
          error.response?.data?.error || 'Không thể lấy danh sách yêu cầu đã gửi do lỗi hệ thống. Vui lòng thử lại sau.'
        );
      } else {
        Alert.alert(
          'Lỗi',
          error.message || 'Có lỗi xảy ra khi lấy danh sách yêu cầu đã gửi. Vui lòng thử lại.'
        );
      }
    }
  };

  const fetchFriendsList = async (authToken) => {
    try {
      const response = await api.get('/friends/list', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      console.log('Phản hồi từ API getFriendsList:', response.data);
      if (Array.isArray(response.data)) {
        setFriendsList(response.data);
      } else {
        throw new Error('Dữ liệu trả về không đúng định dạng.');
      }
    } catch (error) {
      console.error('Lỗi khi lấy danh sách bạn bè:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else if (error.response?.status === 500) {
        Alert.alert(
          'Lỗi',
          error.response?.data?.error || 'Không thể lấy danh sách bạn bè do lỗi hệ thống. Vui lòng thử lại sau.'
        );
      } else {
        Alert.alert(
          'Lỗi',
          error.message || 'Có lỗi xảy ra khi lấy danh sách bạn bè. Vui lòng thử lại.'
        );
      }
    }
  };

  const acceptFriendRequestHandler = async (requestId) => {
    try {
      if (!requestId || typeof requestId !== 'string') {
        throw new Error('ID yêu cầu không hợp lệ.');
      }
      const response = await acceptFriendRequest(requestId, auth.token);
      if (response.data && response.data.success) {
        Alert.alert('Thành công', 'Đã chấp nhận yêu cầu kết bạn!');
        await Promise.all([
          fetchReceivedRequests(auth.token),
          fetchSentRequests(auth.token),
          fetchFriendsList(auth.token),
        ]);
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
      } else if (error.response?.status === 404) {
        Alert.alert('Lỗi', 'Yêu cầu kết bạn không tồn tại. Đang làm mới danh sách...');
        await Promise.all([
          fetchReceivedRequests(auth.token),
          fetchSentRequests(auth.token),
          fetchFriendsList(auth.token),
        ]);
      } else if (error.response?.status === 500) {
        Alert.alert(
          'Lỗi',
          error.response?.data?.error || 'Không thể chấp nhận yêu cầu kết bạn do lỗi hệ thống. Vui lòng liên hệ quản trị viên hoặc thử lại sau.'
        );
      } else {
        Alert.alert('Lỗi', error.message || 'Có lỗi xảy ra khi chấp nhận yêu cầu kết bạn.');
      }
    }
  };

  const rejectFriendRequestHandler = async (requestId) => {
    try {
      if (!requestId || typeof requestId !== 'string') {
        throw new Error('ID yêu cầu không hợp lệ.');
      }
      const response = await rejectFriendRequest(requestId, auth.token);
      if (response.data && response.data.success) {
        Alert.alert('Thành công', 'Đã từ chối yêu cầu kết bạn!');
        await Promise.all([
          fetchReceivedRequests(auth.token),
          fetchSentRequests(auth.token),
          fetchFriendsList(auth.token),
        ]);
      } else {
        throw new Error(response.data.message || 'Không thể từ chối yêu cầu kết bạn.');
      }
    } catch (error) {
      console.error('Lỗi khi từ chối yêu cầu kết bạn:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else if (error.response?.status === 404) {
        Alert.alert('Lỗi', 'Yêu cầu kết bạn không tồn tại. Đang làm mới danh sách...');
        await Promise.all([
          fetchReceivedRequests(auth.token),
          fetchSentRequests(auth.token),
          fetchFriendsList(auth.token),
        ]);
      } else if (error.response?.status === 500) {
        Alert.alert(
          'Lỗi',
          error.response?.data?.error || 'Không thể từ chối yêu cầu kết bạn do lỗi hệ thống. Vui lòng liên hệ quản trị viên hoặc thử lại sau.'
        );
      } else {
        Alert.alert('Lỗi', error.message || 'Có lỗi xảy ra khi từ chối yêu cầu kết bạn.');
      }
    }
  };

  const cancelFriendRequestHandler = async (requestId) => {
    try {
      if (!requestId || typeof requestId !== 'string') {
        throw new Error('ID yêu cầu không hợp lệ.');
      }
      const response = await cancelFriendRequest(requestId, auth.token);
      if (response.data && response.data.success) {
        Alert.alert('Thành công', 'Đã hủy yêu cầu kết bạn!');
        await Promise.all([
          fetchReceivedRequests(auth.token),
          fetchSentRequests(auth.token),
          fetchFriendsList(auth.token),
        ]);
      } else {
        throw new Error(response.data.message || 'Không thể hủy yêu cầu kết bạn.');
      }
    } catch (error) {
      console.error('Lỗi khi hủy yêu cầu kết bạn:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else if (error.response?.status === 404) {
        Alert.alert('Lỗi', 'Yêu cầu kết bạn không tồn tại. Đang làm mới danh sách...');
        await Promise.all([
          fetchReceivedRequests(auth.token),
          fetchSentRequests(auth.token),
          fetchFriendsList(auth.token),
        ]);
      } else if (error.response?.status === 500) {
        Alert.alert(
          'Lỗi',
          error.response?.data?.error || 'Không thể hủy yêu cầu kết bạn do lỗi hệ thống. Vui lòng liên hệ quản trị viên hoặc thử lại sau.'
        );
      } else {
        Alert.alert('Lỗi', error.message || 'Có lỗi xảy ra khi hủy yêu cầu kết bạn.');
      }
    }
  };

  const checkReciprocalRequest = (receivedRequest) => {
    return sentRequests.find(
      (sentReq) => sentReq.receiverInfo.userId === receivedRequest.senderInfo.userId
    );
  };

  const renderFriendItem = ({ item }) => (
    <View style={styles.requestItem}>
      <View style={styles.requestInfo}>
        <Image
          source={{ uri: item.user.avatar || 'https://via.placeholder.com/50' }}
          style={styles.requestAvatar}
        />
        <View>
          <Text style={styles.requestName}>{item.user.name || 'Không có tên'}</Text>
          <Text style={styles.requestPhone}>{item.user.phoneNumber || ''}</Text>
        </View>
      </View>
    </View>
  );

  const renderReceivedRequestItem = ({ item }) => {
    const reciprocalRequest = checkReciprocalRequest(item);
    return (
      <View style={styles.requestItem}>
        <View style={styles.requestInfo}>
          <Image
            source={{ uri: item.senderInfo?.avatar || 'https://via.placeholder.com/50' }}
            style={styles.requestAvatar}
          />
          <View>
            <Text style={styles.requestName}>{item.senderInfo?.name || 'Không có tên'}</Text>
            <Text style={styles.requestPhone}>{item.senderInfo?.phoneNumber || ''}</Text>
            {reciprocalRequest && (
              <Text style={styles.reciprocalText}>
                Bạn và {item.senderInfo?.name} đã gửi yêu cầu kết bạn cho nhau!
              </Text>
            )}
          </View>
        </View>
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => acceptFriendRequestHandler(item.requestId)}
          >
            <Text style={styles.actionText}>Chấp nhận</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => rejectFriendRequestHandler(item.requestId)}
          >
            <Text style={styles.actionText}>Từ chối</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSentRequestItem = ({ item }) => (
    <View style={styles.requestItem}>
      <View style={styles.requestInfo}>
        <Image
          source={{ uri: item.receiverInfo?.avatar || 'https://via.placeholder.com/50' }}
          style={styles.requestAvatar}
        />
        <View>
          <Text style={styles.requestName}>{item.receiverInfo?.name || 'Không có tên'}</Text>
          <Text style={styles.requestPhone}>{item.receiverInfo?.phoneNumber || ''}</Text>
        </View>
      </View>
      <View style={styles.requestActions}>
        <View style={[styles.statusButton, styles.sentButton]}>
          <Text style={styles.actionText}>Đã gửi</Text>
        </View>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() =>
            Alert.alert(
              'Xác nhận',
              'Bạn có chắc muốn hủy yêu cầu kết bạn này không?',
              [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Đồng ý', onPress: () => cancelFriendRequestHandler(item.requestId) },
              ]
            )
          }
        >
          <Text style={styles.actionText}>Hủy</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Danh bạ</Text>
      {friendsList.length > 0 ? (
        <FlatList
          data={friendsList}
          renderItem={renderFriendItem}
          keyExtractor={(item) => item.friendId}
          style={styles.requestList}
        />
      ) : (
        <Text style={styles.noRequests}>Chưa có bạn bè nào.</Text>
      )}

      <Text style={styles.sectionTitle}>Yêu cầu kết bạn nhận được</Text>
      {receivedRequests.length > 0 ? (
        <FlatList
          data={receivedRequests}
          renderItem={renderReceivedRequestItem}
          keyExtractor={(item) => item.requestId}
          style={styles.requestList}
        />
      ) : (
        <Text style={styles.noRequests}>Chưa có yêu cầu kết bạn nào.</Text>
      )}

      <Text style={styles.sectionTitle}>Yêu cầu kết bạn đã gửi</Text>
      {sentRequests.length > 0 ? (
        <FlatList
          data={sentRequests}
          renderItem={renderSentRequestItem}
          keyExtractor={(item) => item.requestId}
          style={styles.requestList}
        />
      ) : (
        <Text style={styles.noRequests}>Chưa gửi yêu cầu kết bạn nào.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: '#fff' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 10 },
  requestList: { flex: 1 },
  requestItem: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  requestAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  requestName: { fontSize: 16, fontWeight: 'bold' },
  requestPhone: { fontSize: 14, color: '#666' },
  reciprocalText: { fontSize: 14, color: '#007bff', marginTop: 5 },
  requestActions: { flexDirection: 'row' },
  acceptButton: { backgroundColor: '#28a745', padding: 8, borderRadius: 5, marginRight: 5 },
  rejectButton: { backgroundColor: '#dc3545', padding: 8, borderRadius: 5 },
  statusButton: { padding: 8, borderRadius: 5, marginRight: 5 },
  sentButton: { backgroundColor: '#6c757d' },
  cancelButton: { backgroundColor: '#dc3545', padding: 8, borderRadius: 5 },
  actionText: { color: '#fff', fontSize: 14 },
  noRequests: { textAlign: 'center', marginVertical: 10, color: '#666' },
});