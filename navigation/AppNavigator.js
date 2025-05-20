import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProfileOptionsScreen from '../screens/ProfileOptionsScreen';
import ProfileInfoScreen from '../screens/ProfileInfoScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ContactsScreen from '../screens/ContactsScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import DiaryScreen from '../screens/DiaryScreen';
import ChatScreen from '../screens/ChatScreen';
import BottomTabBar from '../components/BottomTabBar';
import ContactDetailsScreen from '../screens/ContactDetailsScreen';

// Kiểm tra xem ContactDetailsScreen có được nhập đúng không
console.log('ContactDetailsScreen:', ContactDetailsScreen);

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs({ route }) {
  return (
    <Tab.Navigator tabBar={(props) => <BottomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Contacts" component={ContactsScreen} />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Diary" component={DiaryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} initialParams={route.params} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="ProfileOptions" component={ProfileOptionsScreen} options={{ title: 'Tùy chọn' }} />
        <Stack.Screen name="ProfileInfo" component={ProfileInfoScreen} options={{ title: 'Thông tin cá nhân' }} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Đổi mật khẩu' }} />
        <Stack.Screen name="ContactDetails" component={ContactDetailsScreen} options={{ title: 'Chi tiết liên hệ' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}