import { NextResponse } from 'next/server';
import { supabase } from '@/services/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { userEmail, transactionType, planName, billingCycle, creditsPackage, amount } = await req.json();

    if (!userEmail || !transactionType || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let creditsPurchased = 0;
    if (transactionType === 'credits' && creditsPackage) {
      creditsPurchased = creditsPackage.credits + creditsPackage.bonus_credits;
    } else if (transactionType === 'subscription') {
      const { data: planData } = await supabase
        .from('SubscriptionPlans')
        .select('credits_per_month')
        .eq('plan_name', planName)
        .single();

      if (planData) {
        creditsPurchased = planData.credits_per_month;
      }
    }

    const transactionId = uuidv4();
    const { data, error } = await supabase
      .from('Transactions')
      .insert([{
        id: transactionId,
        user_email: userEmail,
        transaction_type: transactionType,
        plan_name: planName || null,
        billing_cycle: billingCycle || null,
        credits_purchased: creditsPurchased,
        amount: amount,
        payment_status: 'pending',
      }])
      .select()
      .single();

    if (error) {
      console.error('Transaction creation error:', error);
      return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      transactionId: data.id,
      amount: data.amount,
      upiString: `upi://pay?pa=nexthire@upi&pn=NextHire&am=${amount}&cu=INR&tn=Payment-${transactionId}`
    });
  } catch (error) {
    console.error('Payment initiation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
