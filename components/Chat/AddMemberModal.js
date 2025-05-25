// components/Chat/AddMemberModal.js
import React from 'react';
import { Modal, View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';

const AddMemberModal = ({
  visible,
  onClose,
  searchQuery,
  setSearchQuery,
  filteredFriends,
  selectedFriend,
  setSelectedFriend,
  handleAddMember,
}) => {
  const renderFriendItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.friendItem, selectedFriend?.userId === item.userId && styles.friendItemSelected]}
      onPress={() => setSelectedFriend(item)}
    >
      <Text style={styles.friendName}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Thêm thành viên mới</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✖</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Tìm kiếm bạn bè..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Text style={styles.sectionTitle}>Danh sách bạn bè</Text>
          {filteredFriends.length > 0 ? (
            <FlatList
              data={filteredFriends}
              renderItem={renderFriendItem}
              keyExtractor={(item) => item.userId}
              style={styles.friendList}
              contentContainerStyle={styles.friendListContainer}
            />
          ) : (
            <Text style={styles.emptyText}>Không tìm thấy bạn bè.</Text>
          )}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                onClose();
                setSelectedFriend(null);
                setSearchQuery('');
              }}
            >
              <Text style={styles.modalButtonText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalButton} onPress={handleAddMember}>
              <Text style={styles.modalButtonText}>Thêm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: '80%',
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  closeButton: {
    fontSize: 20,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginVertical: 6,
  },
  friendList: {
    maxHeight: 180,
  },
  friendListContainer: {
    paddingBottom: 10,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  friendItemSelected: {
    backgroundColor: '#e1f0ff',
  },
  friendName: {
    fontSize: 14,
    color: '#000',
  },
  emptyText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginTop: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  modalButton: {
    backgroundColor: '#0068ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginHorizontal: 5,
    alignItems: 'center',
    minWidth: 80,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default AddMemberModal;