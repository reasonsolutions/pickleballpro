import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './fonts.css'
import './whiteTextOverride.css'
import { initializeDatabase } from './firebase'
import { setupTestData } from './scripts/setupTestData'

// Initialize the database in development mode only once
// This creates a test account and sample data if they don't exist
if (import.meta.env.DEV) {
  // Use localStorage to prevent repeated initialization on refresh
  if (!localStorage.getItem('initializationAttempted')) {
    console.log('Development mode detected - initializing database with test data');
    localStorage.setItem('initializationAttempted', 'true');
    
    initializeDatabase()
      .then(() => {
        console.log('Database initialization completed successfully');
        console.log('Test account created with email: test@pickleballpro.com and password: Test123!');
      })
      .catch((error) => {
        console.error('Error initializing database:', error);
      });
  } else {
    console.log('Database already initialized in this session, skipping initialization');
  }
}

// Expose the initialization functions to the window for manual triggering if needed
if (import.meta.env.DEV) {
  // @ts-ignore
  window.initializeDatabase = initializeDatabase;
  // @ts-ignore
  window.setupTestData = setupTestData;
  console.log('You can manually initialize the database by running: window.initializeDatabase()');
  console.log('You can set up court booking test data by running: window.setupTestData()');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
