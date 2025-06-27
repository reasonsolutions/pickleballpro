const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteInvalidUsers() {
  console.log('Starting cleanup of invalid user documents...');
  
  try {
    // Get users with null email
    const nullEmailQuery = await db.collection('users')
      .where('email', '==', null)
      .get();
    
    // Get users with empty string email
    const emptyEmailQuery = await db.collection('users')
      .where('email', '==', '')
      .get();
    
    const nullEmailDocs = nullEmailQuery.docs;
    const emptyEmailDocs = emptyEmailQuery.docs;
    
    console.log(`Found ${nullEmailDocs.length} documents with null email`);
    console.log(`Found ${emptyEmailDocs.length} documents with empty email`);
    
    // Delete documents with null email
    const nullDeletePromises = nullEmailDocs.map(doc => {
      console.log(`Deleting document with ID: ${doc.id}`);
      return doc.ref.delete();
    });
    
    // Delete documents with empty email
    const emptyDeletePromises = emptyEmailDocs.map(doc => {
      console.log(`Deleting document with ID: ${doc.id}`);
      return doc.ref.delete();
    });
    
    // Wait for all deletions to complete
    await Promise.all([...nullDeletePromises, ...emptyDeletePromises]);
    
    console.log(`Successfully deleted ${nullEmailDocs.length + emptyEmailDocs.length} invalid user documents`);
  } catch (error) {
    console.error('Error deleting invalid users:', error);
  } finally {
    // Exit the process
    process.exit();
  }
}

deleteInvalidUsers();