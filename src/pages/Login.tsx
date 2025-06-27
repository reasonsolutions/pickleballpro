import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { FcGoogle } from 'react-icons/fc';

type FormData = {
  email: string;
  password: string;
  role: 'player' | 'facility_manager' | 'brand';
};

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      role: 'player'
    }
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Get the path the user was trying to access before being redirected to login
  const from = location.state?.from?.pathname || '/dashboard';

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      setLoading(true);
      await signIn(data.email, data.password, data.role);
      navigate(from);
    } catch (err: any) {
      // Handle specific Firebase auth errors
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed login attempts. Please try again later or reset your password.');
      } else if (err.code === 'auth/user-disabled') {
        setError('This account has been disabled. Please contact support.');
      } else {
        setError('Failed to sign in. Please check your credentials.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      const userCredential = await signInWithGoogle();
      
      if (userCredential && userCredential.user) {
        console.log('Successfully signed in with Google:', userCredential.user.uid);
        navigate(from);
      } else {
        setError('Could not sign in with Google');
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Pop-up was blocked by the browser. Please allow pop-ups for this site.');
      } else {
        setError('Failed to sign in with Google');
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
          <div className="flex justify-center mb-6">
            <img
              src="/dist/assets/logo.png"
              alt="PickleBall Pro Logo"
              className="h-16 w-auto"
            />
          </div>
          <h2 className="text-3xl font-satoshi-black text-black">Welcome Back</h2>
          <p className="text-black mt-2 font-satoshi-regular">Sign in to PickleBall Pro</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black"
              placeholder="your@email.com"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <div className="flex justify-between">
              <label htmlFor="password" className="block text-sm font-satoshi-medium text-black mb-1">
                Password
              </label>
              <Link to="/reset-password" className="text-sm font-satoshi-medium text-primary-600 hover:text-primary-700">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              {...register('password', { required: 'Password is required' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-satoshi-medium text-black mb-1">
              Login as
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

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition disabled:opacity-50 font-satoshi-medium"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </form>

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
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-satoshi-medium text-black bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition"
            >
              <FcGoogle className="h-5 w-5 mr-2" />
              Google
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-sm font-satoshi-regular text-black">
          Don't have an account?{' '}
          <Link to="/register" className="font-satoshi-medium text-primary-600 hover:text-primary-700">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}