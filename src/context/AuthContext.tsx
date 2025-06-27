import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User, UserCredential } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import * as authService from '../firebase/auth';
import * as firestoreService from '../firebase/firestore';
import type { User as UserModel } from '../firebase/models';

interface AuthContextType {
  currentUser: User | null;
  userData: UserModel | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    role?: 'player' | 'facility_manager' | 'brand',
    additionalInfo?: {
      dateOfBirth?: string;
      gender?: 'Male' | 'Female' | 'Other';
      duprProfileLink?: string;
      facilityName?: string;
    }
  ) => Promise<UserCredential>;
  signIn: (email: string, password: string, role?: 'player' | 'facility_manager' | 'brand') => Promise<UserCredential>;
  signInWithGoogle: () => Promise<UserCredential>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (displayName: string, photoURL?: string) => Promise<void>;
  updateUserEmail: (email: string) => Promise<void>;
  updateUserPassword: (password: string) => Promise<void>;
  refreshUserData: () => Promise<void>;
  switchRole: (role: 'player' | 'facility_manager' | 'brand') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserModel | null>(null);
  const [loading, setLoading] = useState(true);

  async function signUp(
    email: string,
    password: string,
    displayName: string,
    role: 'player' | 'facility_manager' | 'brand' = 'player',
    additionalInfo?: {
      dateOfBirth?: string;
      gender?: 'Male' | 'Female' | 'Other';
      duprProfileLink?: string;
      facilityName?: string;
    }
  ) {
    try {
      // The original implementation would create the user and update Firestore
      // Let's make sure we return the UserCredential and handle errors properly
      const userCredential = await authService.signUpWithEmail(
        email,
        password,
        displayName,
        role,
        additionalInfo
      );
      
      // Force refresh user data after signup
      if (userCredential.user) {
        const userData = await authService.getCurrentUserData(userCredential.user.uid);
        setUserData(userData);
      }
      
      return userCredential;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  }

  async function signIn(email: string, password: string, role?: 'player' | 'facility_manager' | 'brand') {
    const userCredential = await authService.signInWithEmail(email, password, role);
    
    // If a specific role was requested, refresh the user data to ensure it has the role
    if (role && userCredential.user) {
      const userData = await authService.getCurrentUserData(userCredential.user.uid);
      
      if (userData) {
        // Update the active role and legacy role
        userData.activeRole = role;
        userData.role = role;
        
        // Ensure the role exists in roles
        if (!userData.roles) {
          userData.roles = {};
        }
        userData.roles[role] = true;
        
        // Update user data
        setUserData(userData);
      }
    }
    
    return userCredential;
  }

  async function signInWithGoogle() {
    try {
      const userCredential = await authService.signInWithGoogleProvider();
      
      // Force refresh user data after Google sign in
      if (userCredential.user) {
        const userData = await authService.getCurrentUserData(userCredential.user.uid);
        setUserData(userData);
      }
      
      return userCredential;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  }

  async function logout() {
    return authService.signOutUser();
  }

  async function resetPassword(email: string) {
    return authService.resetUserPassword(email);
  }

  async function updateUserProfile(displayName: string, photoURL?: string) {
    if (currentUser) {
      await authService.updateUserProfile(currentUser, { displayName, photoURL });
      await refreshUserData();
    } else {
      throw new Error('No user is signed in');
    }
  }

  async function updateUserEmail(email: string) {
    if (currentUser) {
      await authService.updateUserEmail(currentUser, email);
      await refreshUserData();
    } else {
      throw new Error('No user is signed in');
    }
  }

  async function updateUserPassword(password: string) {
    if (currentUser) {
      await authService.updateUserPassword(currentUser, password);
    } else {
      throw new Error('No user is signed in');
    }
  }
  
  async function switchRole(role: 'player' | 'facility_manager' | 'brand') {
    if (!currentUser) {
      throw new Error('No user is signed in');
    }
    
    if (!userData) {
      await refreshUserData();
    }
    
    if (!userData) {
      throw new Error('User data not available');
    }
    
    // Check if user has the requested role
    if (!userData.roles || !userData.roles[role]) {
      throw new Error(`You don't have the ${role} role. Please register for this role first.`);
    }
    
    // Update active role in Firestore
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
      activeRole: role,
      role: role // Keep the legacy role property in sync
    });
    
    // Refresh user data
    await refreshUserData();
  }

  async function refreshUserData() {
    if (currentUser) {
      const data = await authService.getCurrentUserData(currentUser.uid);
      
      // Ensure backward compatibility with role property
      if (data && data.activeRole && !data.role) {
        data.role = data.activeRole;
      } else if (data && data.roles && !data.activeRole && !data.role) {
        // If no active role is set but roles exist, use the first available role
        if (data.roles.player) {
          data.activeRole = 'player';
          data.role = 'player';
        } else if (data.roles.facility_manager) {
          data.activeRole = 'facility_manager';
          data.role = 'facility_manager';
        } else if (data.roles.brand) {
          data.activeRole = 'brand';
          data.role = 'brand';
        }
      }
      
      setUserData(data);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          const userData = await authService.getCurrentUserData(user.uid);
          
          // Ensure backward compatibility with role property
          if (userData && userData.activeRole && !userData.role) {
            userData.role = userData.activeRole;
          } else if (userData && userData.roles && !userData.activeRole && !userData.role) {
            // If no active role is set but roles exist, use the first available role
            if (userData.roles.player) {
              userData.activeRole = 'player';
              userData.role = 'player';
            } else if (userData.roles.facility_manager) {
              userData.activeRole = 'facility_manager';
              userData.role = 'facility_manager';
            } else if (userData.roles.brand) {
              userData.activeRole = 'brand';
              userData.role = 'brand';
            }
          }
          
          setUserData(userData);
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userData,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    logout,
    resetPassword,
    updateUserProfile,
    updateUserEmail,
    updateUserPassword,
    refreshUserData,
    switchRole
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}