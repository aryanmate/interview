"use client";

import React, { useState, useEffect } from 'react';
import { useUser } from '@/app/provider';
import { supabase } from '@/services/supabaseClient';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Check,
  Zap,
  Download,
  X,
  Smartphone,
  Loader2,
  AlertCircle
} from 'lucide-react';

const Billing = () => {
  const { user } = useUser() || {};
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [credits, setCredits] = useState(7);
  const [activePlan, setActivePlan] = useState('free');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [plans, setPlans] = useState([]);
  const [creditPackages, setCreditPackages] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [currentTransactionId, setCurrentTransactionId] = useState(null);

  useEffect(() => {
    if (user?.email) {
      loadUserData();
      loadPlans();
      loadCreditPackages();
      loadPaymentHistory();
    }
  }, [user?.email]);

  const loadUserData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('Users')
        .select('credits, subscription_plan, subscription_status, subscription_end_date')
        .eq('email', user.email)
        .single();

      if (!error && data) {
        setCredits(data.credits || 7);
        setActivePlan(data.subscription_plan || 'free');
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    const { data, error } = await supabase
      .from('SubscriptionPlans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });

    if (!error && data) {
      setPlans(data.map(p => ({
        id: p.plan_name,
        name: p.display_name,
        price: p.price_monthly,
        yearlyPrice: p.price_yearly,
        credits: p.credits_per_month,
        features: p.features || [],
        popular: p.plan_name === 'pro'
      })));
    }
  };

  const loadCreditPackages = async () => {
    const { data, error } = await supabase
      .from('CreditPackages')
      .select('*')
      .eq('is_active', true)
      .order('credits', { ascending: true });

    if (!error && data) {
      setCreditPackages(data.map(p => ({
        credits: p.credits,
        bonus: p.bonus_credits,
        price: p.price
      })));
    }
  };

  const loadPaymentHistory = async () => {
    const { data, error } = await supabase
      .from('Transactions')
      .select('*')
      .eq('user_email', user.email)
      .eq('payment_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setPaymentHistory(data.map(t => ({
        id: t.id,
        date: t.created_at,
        amount: t.amount,
        plan: t.plan_name || 'Credit Purchase',
        status: 'paid'
      })));
    }
  };

  const handleUpgrade = async (planId) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan || plan.price === 0) {
      toast.error('Cannot upgrade to free plan');
      return;
    }

    const amount = billingCycle === 'monthly' ? plan.price : plan.yearlyPrice;

    setSelectedPayment({
      type: 'subscription',
      plan: plan,
      amount: amount
    });

    await initiatePayment({
      transactionType: 'subscription',
      planName: planId,
      billingCycle: billingCycle,
      amount: amount
    });
  };

  const handleBuyCredits = async (pkg) => {
    setSelectedPayment({
      type: 'credits',
      package: pkg,
      amount: pkg.price
    });

    await initiatePayment({
      transactionType: 'credits',
      creditsPackage: pkg,
      amount: pkg.price
    });
  };

  const initiatePayment = async (paymentData) => {
    setProcessing(true);
    try {
      const response = await axios.post('/api/payments/initiate', {
        userEmail: user.email,
        ...paymentData
      });

      if (response.data.success) {
        setCurrentTransactionId(response.data.transactionId);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(response.data.upiString)}`;
        setQrCodeUrl(qrUrl);
        setShowPaymentModal(true);
      } else {
        toast.error('Failed to initiate payment');
      }
    } catch (error) {
      console.error('Payment initiation error:', error);
      toast.error('Failed to initiate payment');
    } finally {
      setProcessing(false);
    }
  };

  const confirmPayment = async () => {
    if (!currentTransactionId) {
      toast.error('No active transaction');
      return;
    }

    setProcessing(true);
    try {
      const response = await axios.post('/api/payments/confirm', {
        transactionId: currentTransactionId,
        userEmail: user.email,
        paymentReference: `UPI-${Date.now()}`
      });

      if (response.data.success) {
        toast.success('Payment confirmed successfully');
        setShowSuccess(true);
        setShowPaymentModal(false);
        setTimeout(() => setShowSuccess(false), 3000);

        await loadUserData();
        await loadPaymentHistory();
      } else {
        toast.error('Payment confirmation failed');
      }
    } catch (error) {
      console.error('Payment confirmation error:', error);
      toast.error('Payment confirmation failed');
    } finally {
      setProcessing(false);
    }
  };

  const getPrice = (plan) => {
    return billingCycle === 'monthly' ? plan.price : plan.yearlyPrice;
  };

  const getSavings = (plan) => {
    if (billingCycle === 'yearly' && plan.price > 0) {
      const monthlyCost = plan.price * 12;
      const yearlyCost = plan.yearlyPrice;
      return Math.round(((monthlyCost - yearlyCost) / monthlyCost) * 100);
    }
    return 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 pb-20">
      <header className="bg-white border-b border-gray-200 shadow-sm px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="text-gray-600 mt-1">Manage your plan and billing information</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {credits <= 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-red-900">No Credits Remaining</h3>
              <p className="text-red-700 text-sm mt-1">
                You have used all your credits. Please purchase a subscription plan or buy additional credits to continue using the application.
              </p>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-blue-400 to-indigo-400 rounded-2xl p-8 text-white shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 text-sm font-medium">CURRENT PLAN</p>
              <h2 className="text-3xl font-bold mt-1 capitalize">{activePlan}</h2>
            </div>
            <div className="text-right">
              <div className="bg-white/20 rounded-lg px-4 py-2 backdrop-blur-sm">
                <p className="text-sm text-blue-100">Available Credits</p>
                <p className="text-4xl font-bold">{credits}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="bg-white rounded-full p-1 shadow-md inline-flex">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                billingCycle === 'yearly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Yearly
              <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isActive = activePlan === plan.id;
            const savings = getSavings(plan);

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-lg overflow-hidden transition-all hover:shadow-xl ${
                  plan.popular ? 'ring-2 ring-blue-500' : ''
                } ${isActive ? 'ring-2 ring-green-400' : ''}`}
              >
                {plan.popular && (
                  <div className="bg-blue-500 text-white text-center py-1 text-sm font-medium">
                    Most Popular
                  </div>
                )}
                {isActive && (
                  <div className="bg-green-400 text-white text-center py-1 text-sm font-medium">
                    Current Plan
                  </div>
                )}

                <div className="p-6">
                  <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-5xl font-bold text-gray-900">
                      ₹{getPrice(plan).toLocaleString('en-IN')}
                    </span>
                    {plan.price > 0 && (
                      <span className="ml-2 text-gray-600">
                        /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    )}
                  </div>
                  {savings > 0 && (
                    <p className="text-green-600 text-sm font-medium mt-2">
                      Save {savings}% with yearly billing
                    </p>
                  )}

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={isActive || processing || plan.price === 0}
                    className={`w-full mt-8 py-3 rounded-lg font-medium transition-all ${
                      isActive
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : plan.popular
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    {processing ? 'Processing...' : isActive ? 'Current Plan' : 'Upgrade'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl shadow-md p-8">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="w-6 h-6 text-yellow-500" />
            <h2 className="text-2xl font-bold text-gray-900">Buy Additional Credits</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {creditPackages.map((pkg, idx) => (
              <div
                key={idx}
                className="border-2 border-gray-200 rounded-xl p-6 hover:border-blue-500 transition-all cursor-pointer relative"
              >
                {pkg.bonus > 0 && (
                  <div className="absolute -top-3 right-4 bg-green-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                    +{pkg.bonus} Bonus
                  </div>
                )}
                <div className="text-center">
                  <p className="text-4xl font-bold text-gray-900">
                    {pkg.credits + pkg.bonus}
                  </p>
                  <p className="text-gray-600 text-sm mt-1">Credits</p>
                  <p className="text-2xl font-bold text-blue-500 mt-4">
                    ₹{pkg.price.toLocaleString('en-IN')}
                  </p>
                  <button
                    onClick={() => handleBuyCredits(pkg)}
                    disabled={processing}
                    className="w-full mt-4 bg-blue-400 text-white py-2 rounded-lg font-medium hover:bg-blue-500 transition-colors disabled:opacity-50"
                  >
                    {processing ? 'Processing...' : 'Buy Now'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Payment History</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Plan
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Amount
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map((payment) => (
                  <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4 text-sm text-gray-900">
                      {new Date(payment.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-900">{payment.plan}</td>
                    <td className="py-4 px-4 text-sm font-semibold text-gray-900">
                      ₹{payment.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <Check className="w-3 h-3 mr-1" />
                        Paid
                      </span>
                    </td>
                  </tr>
                ))}
                {paymentHistory.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-500">
                      No payment history yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 relative animate-scale-up">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Scan QR to Pay</h3>
              <p className="text-gray-600">Pay with any UPI app</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 mb-6">
              <div className="bg-white rounded-lg p-4 mb-4">
                {qrCodeUrl && (
                  <img
                    src={qrCodeUrl}
                    alt="UPI QR Code"
                    className="w-full h-auto"
                  />
                )}
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900 mb-1">
                  ₹{selectedPayment?.amount.toLocaleString('en-IN')}
                </p>
                <p className="text-sm text-gray-600">
                  {selectedPayment?.type === 'subscription'
                    ? `${selectedPayment.plan.name} - ${billingCycle === 'monthly' ? 'Monthly' : 'Yearly'}`
                    : `${selectedPayment?.package?.credits + selectedPayment?.package?.bonus} Credits`
                  }
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-center gap-4 text-gray-600">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Google_Pay_Logo_%282020%29.svg/512px-Google_Pay_Logo_%282020%29.svg.png" alt="GPay" className="h-8" />
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Logo_of_PhonePe.svg/512px-Logo_of_PhonePe.svg.png" alt="PhonePe" className="h-8" />
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Paytm_Logo_%28standalone%29.svg/512px-Paytm_Logo_%28standalone%29.svg.png" alt="Paytm" className="h-8" />
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={confirmPayment}
                disabled={processing}
                className="w-full bg-green-500 text-white py-3 rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                I have completed the payment
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                disabled={processing}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-6 py-4 rounded-lg shadow-xl flex items-center gap-3 animate-slide-up z-50">
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-green-600" />
          </div>
          <span className="font-medium">Transaction successful</span>
        </div>
      )}
    </div>
  );
};

export default Billing;
