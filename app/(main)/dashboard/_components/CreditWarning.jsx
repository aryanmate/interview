"use client";

import { useUser } from '@/app/provider';
import { AlertCircle, Zap } from 'lucide-react';
import Link from 'next/link';

const CreditWarning = () => {
  const { user } = useUser() || {};
  const credits = user?.credits || 0;

  if (credits > 2) {
    return null;
  }

  if (credits === 0) {
    return (
      <div className="bg-red-50 border-2 border-red-500 rounded-xl p-6 mb-6 animate-pulse">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-8 h-8 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-xl font-bold text-red-900 mb-2">No Credits Remaining</h3>
            <p className="text-red-700 mb-4">
              You have used all your credits. Purchase a subscription plan or buy additional credits to continue creating interviews.
            </p>
            <Link href="/billing">
              <button className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors inline-flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Get Credits Now
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-6 mb-6">
      <div className="flex items-start gap-4">
        <AlertCircle className="w-8 h-8 text-amber-600 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-xl font-bold text-amber-900 mb-2">Low Credits Warning</h3>
          <p className="text-amber-700 mb-4">
            You have only {credits} credit{credits !== 1 ? 's' : ''} remaining. Consider purchasing more credits or upgrading your plan.
          </p>
          <Link href="/billing">
            <button className="bg-amber-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-amber-700 transition-colors inline-flex items-center gap-2">
              <Zap className="w-5 h-5" />
              View Plans
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CreditWarning;
