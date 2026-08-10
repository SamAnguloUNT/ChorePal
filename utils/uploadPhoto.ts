import * as FileSystem from 'expo-file-system/legacy';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../config/firebase';

export const uploadPhotoToStorage = async (
  uri: string,
  path: string
): Promise<string> => {
  try {
    // Fetch the image URI and convert to blob directly
    const response = await fetch(uri);
    const blob = await response.blob();

    // Upload to Firebase Storage
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

export const uriToBase64 = async (uri: string): Promise<string> => {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
};