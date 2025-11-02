import { NextResponse } from 'next/server';
import { supabase } from '@/services/supabaseClient';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { transactionId, userEmail, paymentReference } = await req.json();

    if (!transactionId || !userEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: transaction, error: txError } = await supabase
      .from('Transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_email', userEmail)
      .single();

    if (txError || !transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('Transactions')
      .update({
        payment_status: 'completed',
        payment_reference: paymentReference || `REF-${Date.now()}`,
        completed_at: now,
      })
      .eq('id', transactionId);

    if (updateError) {
      console.error('Transaction update error:', updateError);
      return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
    }

    const { data: user, error: userError } = await supabase
      .from('Users')
      .select('credits')
      .eq('email', userEmail)
      .single();

    if (userError) {
      console.error('User fetch error:', userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const creditsBefore = user.credits || 0;
    const creditsToAdd = transaction.credits_purchased || 0;
    const creditsAfter = creditsBefore + creditsToAdd;

    if (transaction.transaction_type === 'subscription') {
      const startDate = new Date();
      const endDate = new Date();
      if (transaction.billing_cycle === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (transaction.billing_cycle === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      await supabase
        .from('Users')
        .update({
          credits: creditsAfter,
          subscription_plan: transaction.plan_name,
          subscription_status: 'active',
          subscription_start_date: startDate.toISOString(),
          subscription_end_date: endDate.toISOString(),
          total_credits_purchased: (user.total_credits_purchased || 0) + creditsToAdd,
        })
        .eq('email', userEmail);
    } else {
      await supabase
        .from('Users')
        .update({
          credits: creditsAfter,
          total_credits_purchased: (user.total_credits_purchased || 0) + creditsToAdd,
        })
        .eq('email', userEmail);
    }

    await supabase
      .from('CreditHistory')
      .insert([{
        user_email: userEmail,
        action: 'added',
        credits_changed: creditsToAdd,
        credits_before: creditsBefore,
        credits_after: creditsAfter,
        reason: transaction.transaction_type === 'subscription'
          ? `Subscription: ${transaction.plan_name}`
          : 'Credit purchase',
        transaction_id: transactionId,
      }]);

    try {
      await fetch(`${process.env.NEXT_PUBLIC_HOST_URL || 'http://localhost:3000'}/api/send-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail,
          transactionId,
          amount: transaction.amount,
          transactionType: transaction.transaction_type,
          planName: transaction.plan_name,
          credits: creditsToAdd,
        }),
      });
    } catch (invoiceError) {
      console.error('Invoice sending failed:', invoiceError);
    }

    return NextResponse.json({
      success: true,
      message: 'Payment confirmed successfully',
      creditsAdded: creditsToAdd,
      newBalance: creditsAfter,
    });
  } catch (error) {
    console.error('Payment confirmation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
