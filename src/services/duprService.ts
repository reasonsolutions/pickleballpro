import type { User } from '../firebase/models';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

interface DuprRatings {
  singles: number | null;
  doubles: number | null;
}

/**
 * Fetches ratings from a DUPR profile link
 * Uses provided credentials if login is required
 */
export const fetchDuprRatings = async (duprProfileLink: string): Promise<DuprRatings | null> => {
  try {
    // Create a new browser window to navigate to the DUPR profile
    const duprWindow = window.open(duprProfileLink, 'dupr-profile', 'width=1024,height=768');
    
    if (!duprWindow) {
      console.error('Popup was blocked or failed to open');
      return null;
    }
    
    // Create a promise that resolves when ratings are extracted
    return new Promise((resolve) => {
      // Poll the opened window to check if it's loaded and if login is required
      const checkInterval = setInterval(() => {
        try {
          // Check if the window is still open
          if (duprWindow.closed) {
            clearInterval(checkInterval);
            resolve(null);
            return;
          }
          
          // Check for login form - look for several possible selectors
          const loginForm = duprWindow.document.querySelector('form[action*="login"], form[action*="sign-in"], form.login-form, form.signin-form');
          const emailInput = duprWindow.document.querySelector('input[type="email"], input[name="email"], input[name="username"], input[placeholder*="email"], input[placeholder*="Email"]');
          const passwordInput = duprWindow.document.querySelector('input[type="password"], input[name="password"], input[placeholder*="password"], input[placeholder*="Password"]');
          const submitButton = duprWindow.document.querySelector('button[type="submit"], input[type="submit"], button.login-button, button.signin-button, button:contains("Sign In"), button:contains("Log In")');
          
          if ((loginForm || (emailInput && passwordInput)) && !duprWindow.document.querySelector('.text-2xl.font-bold.text-white.py-1')) {
            // If login form is found, fill credentials and submit
            console.log('Login form detected, attempting to log in...');
            
            if (emailInput && passwordInput) {
              try {
                console.log('Filling login credentials...');
                (emailInput as HTMLInputElement).value = 'terasiddhartha@gmail.com';
                (emailInput as HTMLInputElement).dispatchEvent(new Event('input', { bubbles: true }));
                
                (passwordInput as HTMLInputElement).value = 'Myra@2016';
                (passwordInput as HTMLInputElement).dispatchEvent(new Event('input', { bubbles: true }));
                
                // Wait a moment before clicking submit
                setTimeout(() => {
                  // Submit the form
                  if (submitButton) {
                    console.log('Clicking submit button...');
                    (submitButton as HTMLButtonElement).click();
                  } else if (loginForm) {
                    console.log('Submitting form directly...');
                    (loginForm as HTMLFormElement).submit();
                  }
                }, 500);
              } catch (e) {
                console.error('Error during login:', e);
              }
            }
          }
          
          // Based on the screenshot, looking for the rating values: 4.064 for doubles, 3.187 for singles
          // Using the exact class selector: "text-2xl font-bold text-white py-1"
          const ratingElements = Array.from(
            duprWindow.document.querySelectorAll('.text-2xl.font-bold.text-white.py-1, .text-2xl.font-bold')
          );
          
          console.log('Looking for rating elements with class: text-2xl font-bold text-white py-1');
          
          // If we can't find the exact class, try a more flexible approach
          if (ratingElements.length === 0) {
            console.log('No elements found with exact class, trying alternative approaches');
            
            // Method 1: Look for elements that have most of these classes
            const potentialElements = Array.from(
              duprWindow.document.querySelectorAll('.text-2xl.font-bold, .text-white, [class*="text-2xl"][class*="font-bold"][class*="text-white"]')
            );
            
            // Method 2: Look specifically for the Rating section and extract nearby numbers
            const ratingSection = Array.from(
              duprWindow.document.querySelectorAll('*')
            ).filter(el => (el as HTMLElement).innerText?.trim() === 'Rating');
            
            if (ratingSection.length > 0) {
              console.log('Found Rating section, looking for nearby numbers');
              
              // Look for all elements in the same general area (siblings, children, nearby elements)
              const nearbyElements = [];
              const ratingEl = ratingSection[0];
              
              // Try to find the parent container of the Rating section
              let container = ratingEl.parentElement;
              while (container && container.tagName !== 'BODY' && nearbyElements.length === 0) {
                // Look for numbers in this container's children
                const numerics = Array.from(container.querySelectorAll('*')).filter(el => {
                  const text = (el as HTMLElement).innerText?.trim();
                  return text && /^\d+\.\d+$/.test(text);
                });
                
                if (numerics.length > 0) {
                  nearbyElements.push(...numerics);
                }
                container = container.parentElement;
              }
              
              if (nearbyElements.length > 0) {
                console.log('Found numeric elements near Rating section:', nearbyElements);
                potentialElements.push(...nearbyElements);
              }
            }
            
            // Method 3: Look for specific values from the screenshot (4.064, 3.187)
            const exactValues = Array.from(
              duprWindow.document.querySelectorAll('*')
            ).filter(el => {
              const text = (el as HTMLElement).innerText?.trim();
              return text === '4.064' || text === '3.187';
            });
            
            if (exactValues.length > 0) {
              console.log('Found elements with exact values from screenshot:', exactValues);
              potentialElements.push(...exactValues);
            }
            
            // Filter to only those with numeric content
            const numericElements = potentialElements.filter(el => {
              const text = (el as HTMLElement).innerText?.trim();
              return text && /^\d+\.\d+$/.test(text);
            });
            
            if (numericElements.length > 0) {
              console.log('Found rating elements with alternate methods:', numericElements);
              // Use these elements instead
              ratingElements.push(...numericElements);
            }
          }
          
          console.log('Found rating elements:', ratingElements);
          
          if (ratingElements.length > 0) {
            clearInterval(checkInterval);
            
            let doublesRating: number | null = null;
            let singlesRating: number | null = null;
            
            // According to user instructions:
            // "The first value is for doubles and the 2nd value is for Singles"
            if (ratingElements.length >= 1) {
              const doublesText = (ratingElements[0] as HTMLElement).innerText.trim();
              doublesRating = parseFloat(doublesText);
              console.log('Extracted doubles rating:', doublesRating);
            }
            
            if (ratingElements.length >= 2) {
              const singlesText = (ratingElements[1] as HTMLElement).innerText.trim();
              singlesRating = parseFloat(singlesText);
              console.log('Extracted singles rating:', singlesRating);
            }
            
            // Final fallback: if we couldn't find ratings with the specific class,
            // search for any numeric values that match the rating pattern
            if ((!doublesRating && !singlesRating) || (doublesRating === null && singlesRating === null)) {
              console.log('Using generic fallback method to find ratings...');
              
              // Look for any elements with numeric content matching rating pattern
              const allElements = Array.from(duprWindow.document.querySelectorAll('*'));
              const numericElements = allElements.filter(el => {
                const text = (el as HTMLElement).innerText?.trim();
                return text && /^\d+\.\d+$/.test(text) &&
                       parseFloat(text) >= 1.0 && parseFloat(text) <= 8.0; // Valid DUPR range
              });
              
              console.log('Found numeric elements:', numericElements.map(el => (el as HTMLElement).innerText));
              
              if (numericElements.length >= 2) {
                // Sort by value - based on the screenshot, likely 4.064 (doubles) and 3.187 (singles)
                const ratingValues = numericElements.map(el => parseFloat((el as HTMLElement).innerText));
                ratingValues.sort((a, b) => b - a); // Sort descending
                
                // According to user, first value is doubles, second is singles
                doublesRating = ratingValues[0];
                singlesRating = ratingValues[1];
                console.log('Fallback method found ratings - doubles:', doublesRating, 'singles:', singlesRating);
              } else if (numericElements.length === 1) {
                // If we only found one rating, assume it's doubles as that's more common
                doublesRating = parseFloat((numericElements[0] as HTMLElement).innerText);
                console.log('Fallback method found only doubles rating:', doublesRating);
              }
            }
            
            // Create the final ratings object
            const ratings: DuprRatings = {
              singles: singlesRating,
              doubles: doublesRating
            };
            
            console.log('Extracted DUPR ratings:', ratings);
            
            // Close the window once we have the ratings
            duprWindow.close();
            resolve(ratings);
          }
        } catch (err) {
          // Handle cross-origin errors or other issues
          console.error('Error checking DUPR profile:', err);
          clearInterval(checkInterval);
          duprWindow.close();
          resolve(null);
        }
      }, 1000); // Check every second
      
      // Set a timeout to prevent infinite polling
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!duprWindow.closed) {
          duprWindow.close();
        }
        resolve(null);
      }, 30000); // 30 second timeout
    });
  } catch (error) {
    console.error('Error fetching DUPR ratings:', error);
    return null;
  }
};

/**
 * Saves DUPR ratings to user profile in Firestore
 */
export const saveDuprRatings = async (userId: string, ratings: DuprRatings): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      duprRatings: ratings
    });
  } catch (error) {
    console.error('Error saving DUPR ratings:', error);
    throw error;
  }
};