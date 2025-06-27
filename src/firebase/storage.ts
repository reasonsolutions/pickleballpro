import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  listAll,
  uploadString,
  uploadBytesResumable,
  getMetadata
} from 'firebase/storage';
import { storage } from './config';

/**
 * Upload a file to Firebase Storage
 * @param path Storage path
 * @param file File to upload
 * @returns Download URL
 */
export const uploadFile = async (
  path: string, 
  file: File
): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

/**
 * Upload a file with progress tracking
 * @param path Storage path
 * @param file File to upload
 * @param progressCallback Callback function for progress updates
 * @returns Promise that resolves with download URL
 */
export const uploadFileWithProgress = (
  path: string,
  file: File,
  progressCallback?: (progress: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (progressCallback) {
            progressCallback(progress);
          }
        },
        (error) => {
          console.error('Error uploading file:', error);
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        }
      );
    } catch (error) {
      console.error('Error initiating upload:', error);
      reject(error);
    }
  });
};

/**
 * Upload a data URL (e.g., canvas or image preview) to Firebase Storage
 * @param path Storage path
 * @param dataUrl Data URL string
 * @param contentType MIME type
 * @returns Download URL
 */
export const uploadDataUrl = async (
  path: string, 
  dataUrl: string,
  contentType: string = 'image/jpeg'
): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    await uploadString(storageRef, dataUrl, 'data_url');
    return getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error uploading data URL:', error);
    throw error;
  }
};

/**
 * Get the download URL for a file in Firebase Storage
 * @param path Storage path
 * @returns Download URL
 */
export const getFileUrl = async (path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    return getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error getting file URL:', error);
    throw error;
  }
};

/**
 * Delete a file from Firebase Storage
 * @param path Storage path
 */
export const deleteFile = async (path: string): Promise<void> => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

/**
 * Get all files in a directory
 * @param path Storage path to directory
 * @returns Array of download URLs
 */
export const listFiles = async (path: string): Promise<string[]> => {
  try {
    const storageRef = ref(storage, path);
    const listResult = await listAll(storageRef);
    
    const urls = await Promise.all(
      listResult.items.map(item => getDownloadURL(item))
    );
    
    return urls;
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
};

/**
 * Check if a file exists in Firebase Storage
 * @param path Storage path
 * @returns Boolean indicating if file exists
 */
export const fileExists = async (path: string): Promise<boolean> => {
  try {
    const storageRef = ref(storage, path);
    await getMetadata(storageRef);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Upload a user profile image
 * @param userId User ID
 * @param file Image file
 * @returns Download URL
 */
export const uploadUserProfileImage = async (
  userId: string, 
  file: File
): Promise<string> => {
  const path = `users/${userId}/profile.jpg`;
  return uploadFile(path, file);
};

/**
 * Upload a court image
 * @param courtId Court ID
 * @param file Image file
 * @returns Download URL
 */
export const uploadCourtImage = async (
  courtId: string, 
  file: File
): Promise<string> => {
  const path = `public/courts/${courtId}.jpg`;
  return uploadFile(path, file);
};

/**
 * Upload a tournament image
 * @param tournamentId Tournament ID
 * @param file Image file
 * @returns Download URL
 */
export const uploadTournamentImage = async (
  tournamentId: string,
  file: File
): Promise<string> => {
  const path = `tournaments/${tournamentId}/cover.jpg`;
  return uploadFile(path, file);
};

/**
 * Upload multiple tournament images
 * @param tournamentId Tournament ID
 * @param files Array of image files
 * @returns Array of download URLs
 */
export const uploadTournamentImages = async (
  tournamentId: string,
  files: File[]
): Promise<string[]> => {
  const uploadPromises = files.map((file, index) => {
    const path = `tournaments/${tournamentId}/image_${index}.jpg`;
    return uploadFile(path, file);
  });
  
  return Promise.all(uploadPromises);
};

/**
 * Upload a product image
 * @param productId Product ID
 * @param file Image file
 * @returns Download URL
 */
export const uploadProductImage = async (
  productId: string, 
  file: File
): Promise<string> => {
  const path = `public/products/${productId}.jpg`;
  return uploadFile(path, file);
};