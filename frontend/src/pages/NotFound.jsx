import { Link } from 'react-router-dom';
import { FiHome, FiArrowLeft } from 'react-icons/fi';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="text-center max-w-md">
        <div className="text-8xl mb-4">🐄</div>
        <h1 className="text-6xl font-bold text-emerald-600 mb-2">404</h1>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Page Not Found
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          Looks like this cow wandered off! The page you're looking for doesn't exist.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/dashboard"
            className="btn-primary flex items-center justify-center gap-2 px-6 py-3"
          >
            <FiHome size={18} />
            Go to Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="btn-secondary flex items-center justify-center gap-2 px-6 py-3"
          >
            <FiArrowLeft size={18} />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
