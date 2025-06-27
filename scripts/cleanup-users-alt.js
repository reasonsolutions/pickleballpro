// Import the Firebase config and Firestore from the project
const { db } = require('../src/firebase/config');
const { collection, query, where, getDocs, deleteDoc } = require('firebase/firestore');

async function deleteInvalidUsers() {
  console.log('Starting cleanup of invalid user documents...');
  
  try {
    // Get users with null email
    const usersRef = collection(db, 'users');
    const nullEmailQuery = query(usersRef, where('email', '==', null));
    const nullEmailSnapshot = await getDocs(nullEmailQuery);
    
    // Get users with empty string email
    const emptyEmailQuery = query(usersRef, where('email', '==', ''));
    const emptyEmailSnapshot = await getDocs(emptyEmailQuery);
    
    let nullCount = 0;
    let emptyCount = 0;
    
    // Process null email documents
    console.log('Deleting documents with null email:');
    for (const doc of nullEmailSnapshot.docs) {
      console.log(`Deleting document with ID: ${doc.id}`);
      await deleteDoc(doc.ref);
      nullCount++;
    }
    
    // Process empty email documents
    console.log('Deleting documents with empty email:');
    for (const doc of emptyEmailSnapshot.docs) {
      console.log(`Deleting document with ID: ${doc.id}`);
      await deleteDoc(doc.ref);
      emptyCount++;
    }
    
    console.log(`Successfully deleted ${nullCount} documents with null email`);
    console.log(`Successfully deleted ${emptyCount} documents with empty email`);
    console.log(`Total: ${nullCount + emptyCount} invalid user documents deleted`);
    
  } catch (error) {
    console.error('Error deleting invalid users:', error);
  }
}

deleteInvalidUsers();