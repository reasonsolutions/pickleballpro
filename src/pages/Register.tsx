import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { FcGoogle } from 'react-icons/fc';

type FormData = {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  role: 'player' | 'facility_manager' | 'brand';
  facilityName?: string; // Optional field for facility managers
  dateOfBirth: string;
  gender: 'Male' | 'Female' | 'Other';
  duprProfileLink: string;
};

export default function Register() {
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      role: 'player',
      gender: 'Male'
    }
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<FormData>>({});

  const password = watch('password');

  const nextStep = (data: Partial<FormData>) => {
    setFormData({ ...formData, ...data });
    setStep(step + 1);
    window.scrollTo(0, 0);
    setError(''); // Clear any errors when moving to next step
  };

  const prevStep = () => {
    setStep(step - 1);
    window.scrollTo(0, 0);
    setError(''); // Clear any errors when moving back
  };

  const openDuprWebsite = () => {
    window.open('https://mydupr.com', '_blank');
  };

  const onSubmit = async (data: Partial<FormData>) => {
    // Combine existing form data with the submitted data
    const currentFormData = { ...formData, ...data };
    
    // If this is step 1 for a player, just move to step 2
    if (step === 1 && currentFormData.role === 'player') {
      return; // This is handled by the button click handler
    }
    
    console.log('Submitting with data:', currentFormData);
    
    console.log('Submitting account registration:', currentFormData);
    
    // Registration submission
    try {
      setError('');
      setLoading(true);
      
      const additionalInfo: {
        dateOfBirth?: string;
        gender?: 'Male' | 'Female' | 'Other';
        duprProfileLink?: string;
        facilityName?: string;
      } = {};
      
      // Add appropriate fields based on role
      if (currentFormData.role === 'player') {
        additionalInfo.dateOfBirth = currentFormData.dateOfBirth;
        additionalInfo.gender = currentFormData.gender;
        additionalInfo.duprProfileLink = currentFormData.duprProfileLink;
      }

      // Add facility name if role is facility manager
      if (currentFormData.role === 'facility_manager' && currentFormData.facilityName) {
        additionalInfo.facilityName = currentFormData.facilityName;
      }
      
      const userCredential = await signUp(
        currentFormData.email!,
        currentFormData.password!,
        currentFormData.displayName!,
        currentFormData.role as 'player' | 'facility_manager' | 'brand',
        additionalInfo
      );
      
      // If we got a user credential back, we can navigate to the dashboard
      if (userCredential && userCredential.user) {
        console.log('Successfully created account and signed in:', userCredential.user.uid);
        navigate('/dashboard');
      } else {
        // This should not happen, but just in case
        setError('Account created but could not sign in automatically');
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please use at least 6 characters');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address format');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Error during sign up. Please contact support.');
      } else {
        setError('Failed to create an account: ' + (err.message || 'Unknown error'));
        console.error('Registration error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      setError('');
      setLoading(true);
      const userCredential = await signInWithGoogle();
      
      // If we got a user credential back, we can navigate to the dashboard
      if (userCredential && userCredential.user) {
        console.log('Successfully signed in with Google:', userCredential.user.uid);
        navigate('/dashboard');
      } else {
        // This should not happen, but just in case
        setError('Could not sign in with Google');
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Pop-up was blocked by the browser. Please allow pop-ups for this site.');
      } else {
        setError('Failed to sign up with Google');
        console.error('Google sign-in error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 p-4">
      <div className="glass-card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-satoshi-black text-black">Create Account</h2>
          <p className="text-black mt-2 font-satoshi-regular">Join PickleBall Pro today</p>
          
          {/* Step indicator */}
          <div className="flex items-center justify-center mt-4">
            <div className={`w-3 h-3 rounded-full ${step === 1 ? 'bg-primary-600' : 'bg-gray-300'} mr-1`}></div>
            <div className={`w-3 h-3 rounded-full ${step === 2 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
          </div>
          <p className="text-sm text-black mt-2 font-satoshi-regular">
            Step {step} of 2: {step === 1 ? 'Account Information' : 'Player Details'}
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {step === 1 && (
            <>
              <div>
                <label htmlFor="displayName" className="block text-sm font-satoshi-medium text-black mb-1">
                  Full Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  {...register('displayName', { 
                    required: 'Full name is required',
                    minLength: {
                      value: 2,
                      message: 'Name must be at least 2 characters'
                    }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="John Doe"
                  defaultValue={formData.displayName}
                />
                {errors.displayName && (
                  <p className="text-red-500 text-sm mt-1">{errors.displayName.message}</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-satoshi-medium text-black mb-1">
                  Register as
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <label className="flex items-center justify-center p-2 border rounded-md cursor-pointer transition-colors hover:bg-gray-50">
                    <input
                      type="radio"
                      value="player"
                      {...register('role')}
                      className="sr-only"
                    />
                    <div className={`text-center ${watch('role') === 'player' ? 'text-primary-600 font-satoshi-medium' : 'text-black font-satoshi-regular'}`}>
                      Player
                    </div>
                  </label>
                  <label className="flex items-center justify-center p-2 border rounded-md cursor-pointer transition-colors hover:bg-gray-50">
                    <input
                      type="radio"
                      value="facility_manager"
                      {...register('role')}
                      className="sr-only"
                    />
                    <div className={`text-center ${watch('role') === 'facility_manager' ? 'text-primary-600 font-satoshi-medium' : 'text-black font-satoshi-regular'}`}>
                      Facility Manager
                    </div>
                  </label>
                  <label className="flex items-center justify-center p-2 border rounded-md cursor-pointer transition-colors hover:bg-gray-50">
                    <input
                      type="radio"
                      value="brand"
                      {...register('role')}
                      className="sr-only"
                    />
                    <div className={`text-center ${watch('role') === 'brand' ? 'text-primary-600 font-satoshi-medium' : 'text-black font-satoshi-regular'}`}>
                      Brand
                    </div>
                  </label>
                </div>
              </div>

              {/* Conditional Facility Name field for facility managers */}
              {watch('role') === 'facility_manager' && (
                <div className="mb-4">
                  <label htmlFor="facilityName" className="block text-sm font-satoshi-medium text-black mb-1">
                    Facility Name
                  </label>
                  <input
                    id="facilityName"
                    type="text"
                    {...register('facilityName', {
                      required: watch('role') === 'facility_manager' ? 'Facility name is required' : false,
                      minLength: {
                        value: 2,
                        message: 'Facility name must be at least 2 characters'
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter your facility/business name"
                    defaultValue={formData.facilityName}
                  />
                  {errors.facilityName && (
                    <p className="text-red-500 text-sm mt-1">{errors.facilityName.message}</p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-satoshi-medium text-black mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  {...register('email', { 
                    required: 'Email is required',
                    pattern: {
                      value: /\S+@\S+\.\S+/,
                      message: 'Please enter a valid email'
                    }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="your@email.com"
                  defaultValue={formData.email}
                />
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-satoshi-medium text-black mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  {...register('password', { 
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters'
                    }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="••••••••"
                  defaultValue={formData.password}
                />
                {errors.password && (
                  <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-satoshi-medium text-black mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  {...register('confirmPassword', { 
                    required: 'Please confirm your password',
                    validate: value => value === password || 'Passwords do not match'
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="••••••••"
                  defaultValue={formData.confirmPassword}
                />
                {errors.confirmPassword && (
                  <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>
                )}
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => {
                    const formValues: Partial<FormData> = {
                      displayName: watch('displayName'),
                      email: watch('email'),
                      password: watch('password'),
                      confirmPassword: watch('confirmPassword'),
                      role: watch('role')
                    };
                    
                    // Add facility name if applicable
                    if (formValues.role === 'facility_manager') {
                      formValues.facilityName = watch('facilityName');
                    }
                    
                    // Simple validation
                    if (!formValues.displayName) return setError('Full name is required');
                    if (!formValues.email) return setError('Email is required');
                    if (!formValues.password) return setError('Password is required');
                    if (formValues.password!.length < 6) return setError('Password must be at least 6 characters');
                    if (formValues.password !== formValues.confirmPassword) return setError('Passwords do not match');
                    if (formValues.role === 'facility_manager' && !formValues.facilityName) {
                      return setError('Facility name is required');
                    }
                    
                    const role = watch('role');
                    
                    if (role === 'player') {
                      // For players, continue to step 2
                      console.log('Moving to step 2 for player details');
                      nextStep(formValues);
                    } else {
                      // For facility managers and brands
                      console.log('Direct submission for non-player role:', role);
                      
                      // Add empty values for player-specific fields
                      formValues.dateOfBirth = '';
                      formValues.gender = 'Male';
                      formValues.duprProfileLink = '';
                      
                      // Set form data
                      setFormData(formValues);
                      
                      // Call onSubmit directly
                      setLoading(true);
                      onSubmit(formValues);
                    }
                  }}
                  disabled={loading}
                  className="w-full bg-primary-600 text-white py-3 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition disabled:opacity-50 text-lg font-satoshi-medium"
                >
                  {watch('role') === 'player' ? 'Continue to Player Details' : 'Create Account'}
                </button>
              </div>
              
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-black font-satoshi-regular">Or continue with</span>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleGoogleSignUp}
                    disabled={loading}
                    className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-satoshi-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition"
                  >
                    <FcGoogle className="h-5 w-5 mr-2" />
                    Google
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h3 className="font-satoshi-medium text-lg text-black mb-4">Player Details</h3>
              </div>
              
              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-satoshi-medium text-black mb-1">
                  Date of Birth
                </label>
                <input
                  id="dateOfBirth"
                  type="date"
                  {...register('dateOfBirth', {
                    required: formData.role === 'player' ? 'Date of birth is required' : false
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  defaultValue={formData.dateOfBirth}
                />
                {errors.dateOfBirth && (
                  <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-satoshi-medium text-black mb-1">
                  Gender
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center justify-center p-2 border rounded-md cursor-pointer transition-colors hover:bg-gray-50">
                    <input
                      type="radio"
                      value="Male"
                      {...register('gender', { required: formData.role === 'player' ? 'Gender is required' : false })}
                      className="sr-only"
                    />
                    <div className={`text-center ${watch('gender') === 'Male' ? 'text-primary-600 font-satoshi-medium' : 'text-black font-satoshi-regular'}`}>
                      Male
                    </div>
                  </label>
                  <label className="flex items-center justify-center p-2 border rounded-md cursor-pointer transition-colors hover:bg-gray-50">
                    <input
                      type="radio"
                      value="Female"
                      {...register('gender', { required: formData.role === 'player' ? 'Gender is required' : false })}
                      className="sr-only"
                    />
                    <div className={`text-center ${watch('gender') === 'Female' ? 'text-primary-600 font-satoshi-medium' : 'text-black font-satoshi-regular'}`}>
                      Female
                    </div>
                  </label>
                </div>
                {errors.gender && (
                  <p className="text-red-500 text-sm mt-1">{errors.gender.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="duprProfileLink" className="block text-sm font-satoshi-medium text-black mb-1">
                  DUPR Profile Link
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    id="duprProfileLink"
                    type="text"
                    {...register('duprProfileLink')}
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://mydupr.com/profile/..."
                    defaultValue={formData.duprProfileLink}
                  />
                  <button
                    type="button"
                    onClick={openDuprWebsite}
                    className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-700 text-sm hover:bg-gray-100"
                  >
                    Visit DUPR
                  </button>
                </div>
                <p className="text-xs text-black mt-1 font-satoshi-regular">
                  Copy your profile link from DUPR website (optional)
                </p>
              </div>

              <div className="flex justify-between mt-8">
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition font-satoshi-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition disabled:opacity-50 font-satoshi-medium"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </>
          )}
        </form>

        <p className="text-center mt-8 text-sm font-satoshi-regular text-black">
          Already have an account?{' '}
          <Link to="/login" className="font-satoshi-medium text-primary-600 hover:text-primary-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}