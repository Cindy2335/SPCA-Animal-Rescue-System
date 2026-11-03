import React, { useState } from 'react'
import { useAuth } from '@/src/context/AuthContext';
import { router, useLocalSearchParams } from 'expo-router';
import LoginScreen from '@/src/screens/LoginScreen';
import { loginUser } from '@/src/services/api';
import { trackLoginSucceeded } from '@/src/services/analytics';


function Login(){
  const {login} = useAuth();
  const params = useLocalSearchParams<{ redirect?: string; animalId?: string }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <LoginScreen
        OnLogin = {async (input) => {
            setError(null);
            setLoading(true);
            try {
              const session = await loginUser(input);
              login(session);
              void trackLoginSucceeded();
              if (params.redirect === "/adoption-application" && params.animalId) {
                router.replace({
                  pathname: "/adoption-application",
                  params: { animalId: params.animalId },
                });
              } else {
                router.replace("/(tabs)/home");
              }
            } catch (e) {
              setError(e instanceof Error ? e.message : "Login failed");
            } finally {
              setLoading(false);
            }
        }}
        OnGoToRegister={() => router.push({ pathname: "/register", params })}
        OnContinueAsGuest={() => router.replace("/(tabs)/home")}
        error={error}
        loading={loading}
    />  
  );
}

export default Login


