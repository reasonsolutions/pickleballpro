import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { storage } from '../firebase/config';
import { RiUpload2Line } from 'react-icons/ri';
import { updateDocById } from '../firebase/firestore';

export default function Settings() {
  const { currentUser, userData, refreshUserData } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  // Using type assertion for properties not in the User interface yet
  const [facilityStatus, setFacilityStatus] = useState((userData as any)?.isOnline !== false);
  
  // Time settings
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('20:00');
  
  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Profile photo
  const [photoURL, setPhotoURL] = useState(userData?.photoURL || '');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved time settings if available
  useEffect(() => {
    if (userData) {
      // Using type assertion for properties not in the User interface yet
      setOpenTime((userData as any).openTime || '08:00');
      setCloseTime((userData as any).closeTime || '20:00');
      setFacilityStatus((userData as any).isOnline !== false);
    }
  }, [userData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const uploadProfilePhoto = async () => {
    if (!uploadedFile || !currentUser) return;
    
    try {
      setIsLoading(true);
      setMessage({ type: '', text: '' });
      
      const storageRef = ref(storage, `profile_photos/${currentUser.uid}`);
      await uploadBytes(storageRef, uploadedFile);
      const downloadURL = await getDownloadURL(storageRef);
      
      // Update user profile and Firestore document
      await updateDocById('users', currentUser.uid, {
        photoURL: downloadURL
      });
      
      // Refresh user data to update UI
      await refreshUserData();
      
      setPhotoURL(downloadURL);
      setMessage({ type: 'success', text: 'Profile photo updated successfully!' });
      setUploadedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      setMessage({ type: 'error', text: 'Failed to upload profile photo. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const saveTimeSettings = async () => {
    if (!currentUser) return;
    
    try {
      setIsLoading(true);
      setMessage({ type: '', text: '' });
      
      await updateDocById('users', currentUser.uid, {
        openTime,
        closeTime
      });
      
      // Refresh user data to update UI
      await refreshUserData();
      
      setMessage({ type: 'success', text: 'Facility hours updated successfully!' });
    } catch (error) {
      console.error('Error updating facility hours:', error);
      setMessage({ type: 'error', text: 'Failed to update facility hours. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async () => {
    if (!currentUser || !currentUser.email) return;
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }
    
    try {
      setIsLoading(true);
      setMessage({ type: '', text: '' });
      
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );
      
      await reauthenticateWithCredential(currentUser, credential);
      
      // Update password
      await updatePassword(currentUser, newPassword);
      
      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to change password. Please ensure your current password is correct.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFacilityStatus = async () => {
    if (!currentUser) return;
    
    try {
      setIsLoading(true);
      setMessage({ type: '', text: '' });
      
      const newStatus = !facilityStatus;
      
      await updateDocById('users', currentUser.uid, {
        isOnline: newStatus
      });
      
      // Refresh user data to update UI
      await refreshUserData();
      
      setFacilityStatus(newStatus);
      setMessage({ 
        type: 'success', 
        text: `Facility is now ${newStatus ? 'online' : 'offline'}!` 
      });
    } catch (error) {
      console.error('Error updating facility status:', error);
      setMessage({ type: 'error', text: 'Failed to update facility status. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-satoshi-bold mb-8">Facility Settings</h1>
      
      {message.text && (
        <div className={`p-4 mb-6 rounded-lg glass-effect backdrop-blur-sm border ${
          message.type === 'error'
            ? 'bg-red-100/30 text-red-700 border-red-200/50'
            : 'bg-green-100/30 text-green-700 border-green-200/50'
        }`}>
          {message.text}
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Facility Hours */}
        <div className="glass-effect p-6 rounded-xl backdrop-blur-sm bg-white/30 border border-white/20 shadow-lg">
          <h2 className="text-xl font-satoshi-bold mb-4">Facility Hours</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-satoshi-medium mb-1">Opening Time</label>
              <input
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="w-full p-2 glass-input border border-white/20 bg-white/10 rounded-lg focus:ring-primary-500 focus:border-primary-500 backdrop-blur-sm text-gray-700"
              />
            </div>
            
            <div>
              <label className="block text-sm font-satoshi-medium mb-1">Closing Time</label>
              <input
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="w-full p-2 glass-input border border-white/20 bg-white/10 rounded-lg focus:ring-primary-500 focus:border-primary-500 backdrop-blur-sm text-gray-700"
              />
            </div>
            
            <button
              onClick={saveTimeSettings}
              disabled={isLoading}
              className="w-full glass-button py-2 px-4 rounded-lg transition-all disabled:opacity-50 bg-primary-600/80 hover:bg-primary-700/90 text-white backdrop-blur-sm border border-white/10"
            >
              {isLoading ? 'Saving...' : 'Save Hours'}
            </button>
          </div>
        </div>
        
        {/* Profile Photo */}
        <div className="glass-effect p-6 rounded-xl backdrop-blur-sm bg-white/30 border border-white/20 shadow-lg">
          <h2 className="text-xl font-satoshi-bold mb-4">Profile Photo</h2>
          <div className="flex flex-col items-center space-y-4">
            <div className="w-32 h-32 rounded-full glass-effect backdrop-blur-sm bg-gray-200/30 border border-white/30 overflow-hidden shadow-md">
              {photoURL ? (
                <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary-100 text-primary-600">
                  <span className="text-4xl font-satoshi-bold">
                    {userData?.displayName?.charAt(0) || 'U'}
                  </span>
                </div>
              )}
            </div>
            
            <div className="w-full">
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer glass-effect backdrop-blur-sm bg-white/10 hover:bg-white/20 transition-all border-white/30">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <RiUpload2Line className="w-8 h-8 mb-3 text-primary-500" />
                    <p className="mb-2 text-sm text-gray-700">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-600">PNG, JPG or JPEG (MAX. 2MB)</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
              
              {uploadedFile && (
                <p className="mt-2 text-sm text-gray-500">
                  Selected: {uploadedFile.name}
                </p>
              )}
              
              <button
                onClick={uploadProfilePhoto}
                disabled={isLoading || !uploadedFile}
                className="mt-4 w-full glass-button py-2 px-4 rounded-lg transition-all disabled:opacity-50 bg-primary-600/80 hover:bg-primary-700/90 text-white backdrop-blur-sm border border-white/10"
              >
                {isLoading ? 'Uploading...' : 'Upload Photo'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Change Password */}
        <div className="glass-effect p-6 rounded-xl backdrop-blur-sm bg-white/30 border border-white/20 shadow-lg">
          <h2 className="text-xl font-satoshi-bold mb-4">Change Password</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-satoshi-medium mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full p-2 glass-input border border-white/20 bg-white/10 rounded-lg focus:ring-primary-500 focus:border-primary-500 backdrop-blur-sm text-gray-700"
              />
            </div>
            
            <div>
              <label className="block text-sm font-satoshi-medium mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-2 glass-input border border-white/20 bg-white/10 rounded-lg focus:ring-primary-500 focus:border-primary-500 backdrop-blur-sm text-gray-700"
              />
            </div>
            
            <div>
              <label className="block text-sm font-satoshi-medium mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2 glass-input border border-white/20 bg-white/10 rounded-lg focus:ring-primary-500 focus:border-primary-500 backdrop-blur-sm text-gray-700"
              />
            </div>
            
            <button
              onClick={changePassword}
              disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
              className="w-full glass-button py-2 px-4 rounded-lg transition-all disabled:opacity-50 bg-primary-600/80 hover:bg-primary-700/90 text-white backdrop-blur-sm border border-white/10"
            >
              {isLoading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>
        
        {/* Facility Status */}
        <div className="glass-effect p-6 rounded-xl backdrop-blur-sm bg-white/30 border border-white/20 shadow-lg">
          <h2 className="text-xl font-satoshi-bold mb-4">Facility Status</h2>
          <div className="flex items-center justify-between">
            <span className="font-satoshi-medium">
              Your facility is currently {facilityStatus ? 'Online' : 'Offline'}
            </span>
            
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={facilityStatus}
                onChange={toggleFacilityStatus}
                className="sr-only peer"
                disabled={isLoading}
              />
              <div className="w-11 h-6 glass-effect backdrop-blur-sm bg-gray-200/30 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300/50 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600/80 shadow-inner"></div>
            </label>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {facilityStatus 
              ? 'When online, users can book courts and see your facility.'
              : 'When offline, your facility will be hidden from searches and booking will be disabled.'}
          </p>
        </div>
      </div>
    </div>
  );
}