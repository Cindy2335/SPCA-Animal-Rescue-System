import React, { useState } from 'react'
import { useAuth } from '@/src/context/AuthContext';
import { router, useLocalSearchParams } from 'expo-router';
import RegisterScreen from '@/src/screens/RegisterScreen';
import { registerUser } from '@/src/services/api';
import { trackSignUpSucceeded } from '@/src/services/analytics';

function Register(){
    const {login} = useAuth();
    const params = useLocalSearchParams<{ redirect?: string; animalId?: string }>();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

  return (
    <RegisterScreen
    OnRegister = {async (input)=> {
        setError(null);

        if (input.password !== input.confirmPassword) {
          setError("Passwords do not match");
          return;
        }

        setLoading(true);
        try {
          const session = await registerUser({
            fullname: input.fullname,
            email: input.email,
            password: input.password,
          });
          login(session);
          void trackSignUpSucceeded();
          if (params.redirect === "/adoption-application" && params.animalId) {
            router.replace({
              pathname: "/adoption-application",
              params: { animalId: params.animalId },
            });
          } else {
            router.replace("/(tabs)/home");
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Registration failed");
        } finally {
          setLoading(false);
        }
    }}
    OnGoToLogin={() => router.push({ pathname: "/login", params })}
    error={error}
    loading={loading}

    />
    
  );
}

export default Register


