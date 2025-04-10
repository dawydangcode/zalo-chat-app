import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, Image, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getProfile, updateProfile } from '../services/api';
import { AuthContext } from '../context/AuthContext';

export default function ProfileInfoScreen({ navigation }) {
  const { auth } = useContext(AuthContext);
  const { token, userId } = auth;
  const [profile, setProfile] = useState({
    name: '',
    phoneNumber: '',
    avatar: null,
    coverPhoto: null,
    dateOfBirth: null,
    gender: null,
  });
  const [editMode, setEditMode] = useState(false);
  const [day, setDay] = useState('1');
  const [month, setMonth] = useState('1');
  const [year, setYear] = useState('2000');
  const [error, setError] = useState('');

  useEffect(() => {
    if (token && userId) {
      fetchProfile();
    }
  }, [token, userId]);

  const fetchProfile = async () => {
    try {
      const { data } = await getProfile(token);
      const newProfile = {
        name: data.data.name || '',
        phoneNumber: data.data.phoneNumber || '',
        avatar: data.data.avatar || null,
        coverPhoto: data.data.coverPhoto || null,
        dateOfBirth: data.data.dateOfBirth || null,
        gender: data.data.gender || 'Nam',
      };
      if (newProfile.dateOfBirth) {
        const [y, m, d] = newProfile.dateOfBirth.split('-');
        setYear(y);
        setMonth(m.padStart(2, '0'));
        setDay(d.padStart(2, '0'));
      }
      setProfile(newProfile);
    } catch (err) {
      setError('Không thể tải profile!');
      console.error('Lỗi fetchProfile:', err.message);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const dateOfBirth = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const updates = { dateOfBirth, gender: profile.gender, name: profile.name };
      const formData = new FormData();
      Object.keys(updates).forEach((key) => {
        if (updates[key]) formData.append(key, updates[key]);
      });
      const { data } = await updateProfile(formData, token);
      if (data.success) {
        setProfile((prev) => ({
          ...prev,
          name: data.data.name || prev.name,
          dateOfBirth: data.data.dateOfBirth || null,
          gender: data.data.gender || 'Nam',
        }));
        setEditMode(false);
        setError('');
      }
    } catch (err) {
      setError('Cập nhật profile thất bại!');
      console.error('Lỗi updateProfile:', err.message);
    }
  };

  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
  const years = Array.from({ length: 126 }, (_, i) => (1900 + i).toString());

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.coverContainer}>
        {profile.coverPhoto ? (
          <Image source={{ uri: profile.coverPhoto }} style={styles.coverPhoto} />
        ) : (
          <View style={styles.coverPhotoPlaceholder}>
            <Text style={styles.avatarText}>Chưa có ảnh bìa</Text>
          </View>
        )}
        {profile.avatar ? (
          <Image source={{ uri: profile.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>Chưa có ảnh đại diện</Text>
          </View>
        )}
      </View>
      <Text style={styles.info}>Tên: {profile.name}</Text>
      <Text style={styles.info}>Số điện thoại: +{profile.phoneNumber}</Text>
      <Text style={styles.info}>Ngày sinh: {profile.dateOfBirth || 'Chưa cập nhật'}</Text>
      <Text style={styles.info}>Giới tính: {profile.gender || 'Chưa cập nhật'}</Text>

      {editMode ? (
        <>
          <TextInput
            style={styles.input}
            value={profile.name}
            onChangeText={(text) => setProfile((prev) => ({ ...prev, name: text }))}
            placeholder="Tên"
          />
          <Text style={styles.label}>Ngày sinh:</Text>
          <View style={styles.datePickerContainer}>
            <Picker selectedValue={day} onValueChange={setDay} style={styles.picker}>
              {days.map((d) => (
                <Picker.Item key={d} label={d} value={d} />
              ))}
            </Picker>
            <Picker selectedValue={month} onValueChange={setMonth} style={styles.picker}>
              {months.map((m) => (
                <Picker.Item key={m} label={m} value={m} />
              ))}
            </Picker>
            <Picker selectedValue={year} onValueChange={setYear} style={styles.picker}>
              {years.map((y) => (
                <Picker.Item key={y} label={y} value={y} />
              ))}
            </Picker>
          </View>
          <Text style={styles.label}>Giới tính:</Text>
          <Picker
            selectedValue={profile.gender || 'Nam'}
            onValueChange={(itemValue) => setProfile((prev) => ({ ...prev, gender: itemValue }))}
            style={styles.pickerSingle}
          >
            <Picker.Item label="Nam" value="Nam" />
            <Picker.Item label="Nữ" value="Nữ" />
          </Picker>
          <TouchableOpacity style={styles.button} onPress={handleUpdateProfile}>
            <Text style={styles.buttonText}>Lưu thay đổi</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setEditMode(false)}>
            <Text style={styles.cancelButtonText}>Hủy</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.button} onPress={() => setEditMode(true)}>
          <Text style={styles.buttonText}>Chỉnh sửa thông tin</Text>
        </TouchableOpacity>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  contentContainer: { paddingBottom: 100, padding: 20 },
  coverContainer: { position: 'relative', width: '100%', height: 230, marginBottom: 70 },
  coverPhoto: { width: '100%', height: '100%', borderWidth: 0, borderColor: '#f5f5f5' },
  coverPhotoPlaceholder: { width: '100%', height: '100%', borderRadius: 10, backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#f5f5f5', position: 'absolute', bottom: -60, alignSelf: 'center' },
  avatarPlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center', position: 'absolute', bottom: -60, alignSelf: 'center' },
  avatarText: { color: '#666', fontSize: 16 },
  info: { fontSize: 18, color: '#333', fontWeight: '600', marginVertical: 10 },
  label: { fontSize: 16, color: '#005AE0', marginVertical: 5 },
  input: { width: '100%', padding: 12, marginBottom: 15, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', fontSize: 16, elevation: 2 },
  datePickerContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  picker: { flex: 1, height: 50, marginHorizontal: 5, backgroundColor: '#fff', borderRadius: 8, elevation: 2 },
  pickerSingle: { width: '100%', height: 50, marginBottom: 15, backgroundColor: '#fff', borderRadius: 8, elevation: 2 },
  button: { backgroundColor: '#005AE0', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', marginBottom: 15, elevation: 3 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelButton: { borderWidth: 1, borderColor: '#e63946', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', marginBottom: 15 },
  cancelButtonText: { color: '#e63946', fontSize: 16, fontWeight: '600' },
  error: { color: '#e63946', marginBottom: 15, textAlign: 'center' },
});