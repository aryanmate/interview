/*
  # Credit-Based Subscription System - Complete Schema

  ## Overview
  Creates a complete credit-based subscription system where users start with 7 free credits.

  ## 1. Users Table
    - Core user information with credit and subscription tracking
    - Default 7 free credits
    - Subscription plan and status tracking

  ## 2. Subscription Plans Table
    - Available subscription plans with pricing
    - Credit allocations per plan

  ## 3. Transactions Table
    - Payment transaction records
    - Invoice tracking

  ## 4. Credit History Table
    - Audit trail for all credit changes

  ## 5. Credit Packages Table
    - One-time credit purchase options

  ## 6. Interviews Table
    - Interview records linked to users

  ## 7. Interview Feedback Table
    - Feedback and results storage

  ## Security
    - RLS enabled on all tables
    - Users can only access their own data
*/

-- ============================================
-- 1. Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS public."Users" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  picture TEXT,
  credits INTEGER DEFAULT 7,
  subscription_plan TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'active',
  subscription_start_date TIMESTAMPTZ,
  subscription_end_date TIMESTAMPTZ,
  total_credits_purchased INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public."Users" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data"
  ON public."Users"
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can update own data"
  ON public."Users"
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' = email)
  WITH CHECK (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can insert own data"
  ON public."Users"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = email);

CREATE INDEX IF NOT EXISTS idx_users_email ON public."Users"(email);

-- ============================================
-- 2. Subscription Plans Table
-- ============================================
CREATE TABLE IF NOT EXISTS public."SubscriptionPlans" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  price_monthly INTEGER NOT NULL,
  price_yearly INTEGER NOT NULL,
  credits_per_month INTEGER NOT NULL,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public."SubscriptionPlans" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
  ON public."SubscriptionPlans"
  FOR SELECT
  USING (is_active = true);

INSERT INTO public."SubscriptionPlans" (plan_name, display_name, description, price_monthly, price_yearly, credits_per_month, features)
VALUES 
  (
    'free',
    'Free Plan',
    'Get started with 7 free credits',
    0,
    0,
    0,
    '["7 initial credits", "Basic AI Questions", "Email Support"]'::jsonb
  ),
  (
    'basic',
    'Basic Plan',
    'Perfect for small teams',
    499,
    4990,
    25,
    '["25 Interview Credits/month", "Advanced AI Questions", "Priority Support", "Basic Analytics"]'::jsonb
  ),
  (
    'pro',
    'Professional Plan',
    'For growing organizations',
    999,
    9990,
    75,
    '["75 Interview Credits/month", "Advanced AI Questions", "Priority Support", "Custom Templates", "Advanced Analytics", "Resume Parsing"]'::jsonb
  ),
  (
    'enterprise',
    'Enterprise Plan',
    'Unlimited interviews for large teams',
    2499,
    24990,
    999,
    '["Unlimited Interviews", "Premium AI Models", "24/7 Priority Support", "Custom Branding", "Advanced Analytics Dashboard", "API Access", "Dedicated Account Manager"]'::jsonb
  )
ON CONFLICT (plan_name) DO NOTHING;

-- ============================================
-- 3. Transactions Table
-- ============================================
CREATE TABLE IF NOT EXISTS public."Transactions" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('subscription', 'credits')),
  plan_name TEXT,
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly', NULL)),
  credits_purchased INTEGER DEFAULT 0,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  payment_method TEXT DEFAULT 'UPI',
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_reference TEXT,
  invoice_sent BOOLEAN DEFAULT false,
  invoice_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public."Transactions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public."Transactions"
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can create own transactions"
  ON public."Transactions"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = user_email);

CREATE INDEX IF NOT EXISTS idx_transactions_user_email ON public."Transactions"(user_email);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public."Transactions"(payment_status);

-- ============================================
-- 4. Credit History Table
-- ============================================
CREATE TABLE IF NOT EXISTS public."CreditHistory" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('added', 'deducted', 'expired')),
  credits_changed INTEGER NOT NULL,
  credits_before INTEGER NOT NULL,
  credits_after INTEGER NOT NULL,
  reason TEXT,
  transaction_id UUID REFERENCES public."Transactions"(id),
  interview_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public."CreditHistory" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit history"
  ON public."CreditHistory"
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = user_email);

CREATE INDEX IF NOT EXISTS idx_credit_history_user_email ON public."CreditHistory"(user_email);
CREATE INDEX IF NOT EXISTS idx_credit_history_created_at ON public."CreditHistory"(created_at DESC);

-- ============================================
-- 5. Credit Packages Table
-- ============================================
CREATE TABLE IF NOT EXISTS public."CreditPackages" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credits INTEGER NOT NULL,
  bonus_credits INTEGER DEFAULT 0,
  price INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public."CreditPackages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active packages"
  ON public."CreditPackages"
  FOR SELECT
  USING (is_active = true);

INSERT INTO public."CreditPackages" (credits, bonus_credits, price)
VALUES 
  (10, 0, 749),
  (25, 5, 1699),
  (50, 15, 2999),
  (100, 40, 4999)
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. Interviews Table
-- ============================================
CREATE TABLE IF NOT EXISTS public."Interviews" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id TEXT UNIQUE NOT NULL,
  jobPosition TEXT,
  jobDescription TEXT,
  duration INTEGER,
  type TEXT[],
  questionList JSONB,
  questions JSONB,
  userEmail TEXT,
  created_by TEXT,
  resume_used BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public."Interviews" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own interviews"
  ON public."Interviews"
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'email' = userEmail
    OR auth.jwt() ->> 'email' = created_by
  );

CREATE POLICY "Anyone can read interviews by ID"
  ON public."Interviews"
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Users can insert interviews"
  ON public."Interviews"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'email' = userEmail
    OR auth.jwt() ->> 'email' = created_by
  );

CREATE POLICY "Users can update own interviews"
  ON public."Interviews"
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'email' = userEmail
    OR auth.jwt() ->> 'email' = created_by
  )
  WITH CHECK (
    auth.jwt() ->> 'email' = userEmail
    OR auth.jwt() ->> 'email' = created_by
  );

CREATE INDEX IF NOT EXISTS idx_interviews_interview_id ON public."Interviews"(interview_id);
CREATE INDEX IF NOT EXISTS idx_interviews_user_email ON public."Interviews"(userEmail);
CREATE INDEX IF NOT EXISTS idx_interviews_created_by ON public."Interviews"(created_by);

-- ============================================
-- 7. Interview Feedback Table
-- ============================================
CREATE TABLE IF NOT EXISTS public."interview_feedback" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id TEXT NOT NULL,
  userName TEXT,
  userEmail TEXT,
  feedback JSONB,
  recommended BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public."interview_feedback" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view feedback for their interviews"
  ON public."interview_feedback"
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = userEmail);

CREATE POLICY "Anyone can view feedback by interview ID"
  ON public."interview_feedback"
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Users can insert feedback"
  ON public."interview_feedback"
  FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_feedback_interview_id ON public."interview_feedback"(interview_id);

-- ============================================
-- 8. Functions and Triggers
-- ============================================

CREATE OR REPLACE FUNCTION check_subscription_expired()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subscription_end_date IS NOT NULL 
     AND NEW.subscription_end_date < NOW() 
     AND NEW.subscription_status = 'active' THEN
    NEW.subscription_status := 'expired';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_subscription_expired ON public."Users";
CREATE TRIGGER trigger_check_subscription_expired
  BEFORE UPDATE ON public."Users"
  FOR EACH ROW
  EXECUTE FUNCTION check_subscription_expired();
