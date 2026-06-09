import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PaperProvider } from 'react-native-paper';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Respiration from './pages/Respiration';
import Environment from './pages/Environment';
import SleepRecords from './pages/SleepRecords';
import Settings from './pages/Settings';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

const Stack = createNativeStackNavigator();

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Login');

  useEffect(() => {
    const checkAuth = async () => {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        setInitialRoute('Dashboard');
      } else {
        setInitialRoute('Login');
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a6340" />
      </View>
    );
  }

  return (
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerStyle: { backgroundColor: '#1a6340' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        >
          <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={Register} options={{ headerShown: false }} />
          <Stack.Screen name="Dashboard" component={Dashboard} options={{ title: '睡眠监测' }} />
          <Stack.Screen name="Respiration" component={Respiration} options={{ title: '呼吸监测' }} />
          <Stack.Screen name="Environment" component={Environment} options={{ title: '环境监测' }} />
          <Stack.Screen name="SleepRecords" component={SleepRecords} options={{ title: '睡眠记录' }} />
          <Stack.Screen name="Settings" component={Settings} options={{ title: '设置' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5',
  },
});

export default App;
