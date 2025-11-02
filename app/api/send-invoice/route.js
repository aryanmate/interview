import { NextResponse } from 'next/server';
import { supabase } from '@/services/supabaseClient';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { userEmail, transactionId, amount, transactionType, planName, credits } = await req.json();

    if (!userEmail || !transactionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const invoiceData = {
      invoiceNumber: `INV-${transactionId.slice(0, 8).toUpperCase()}`,
      date: new Date().toISOString(),
      userEmail,
      amount,
      transactionType,
      planName,
      credits,
      companyName: 'NextHire',
      companyAddress: 'AI-Powered Interview Platform',
    };

    console.log('Invoice generated for:', userEmail);
    console.log('Invoice details:', invoiceData);

    await supabase
      .from('Transactions')
      .update({
        invoice_sent: true,
        invoice_url: `invoice://${invoiceData.invoiceNumber}`,
      })
      .eq('id', transactionId);

    return NextResponse.json({
      success: true,
      message: 'Invoice sent successfully',
      invoiceNumber: invoiceData.invoiceNumber,
    });
  } catch (error) {
    console.error('Invoice generation error:', error);
    return NextResponse.json({ error: 'Failed to send invoice' }, { status: 500 });
  }
}
