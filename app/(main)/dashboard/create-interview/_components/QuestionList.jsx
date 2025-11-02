import axios from 'axios';
import { Loader as Loader2Icon } from 'lucide-react';
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner';
import { supabase } from '@/services/supabaseClient';
import { useUser } from '@/app/provider';
import { Button } from '@/components/ui/button';
import QuestionListContainer from './QuestionListContainer';
import { v4 as uuidv4 } from 'uuid';

const QuestionList = ({ formData, onCreateLink }) => {

  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [rawContent, setRawContent] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const { user } = useUser?.() || {};
  useEffect(() => {
    if (formData) {
      GenerateQuestionList();
    }
  }, [formData])

  const parseQuestions = (content) => {
    if (!content) return [];
    const text = typeof content === 'string' ? content.trim() : '';
    if (!text) return [];

    // 1) Extract fenced code block (prefer ```json ... ```)
    const fence = text.match(/```json\s*([\s\S]*?)```|```\s*([\s\S]*?)```/i);
    const fencedBody = fence ? (fence[1] || fence[2] || '').trim() : '';
    const candidates = [];
    if (fencedBody) candidates.push(fencedBody);
    candidates.push(text);

    // 2) Try direct JSON parses from candidates
    for (const cand of candidates) {
      const trimmed = cand.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const obj = JSON.parse(trimmed);
          if (Array.isArray(obj)) return obj;
          if (obj && Array.isArray(obj.interviewQuestions)) return obj.interviewQuestions;
        } catch { }
      }
    }

    // 3) Extract interviewQuestions=[ ... ] pattern
    const ivq = text.match(/interviewQuestions\s*=\s*(\[[\s\S]*?\])/i);
    if (ivq && ivq[1]) {
      try {
        const arr = JSON.parse(ivq[1]);
        if (Array.isArray(arr)) return arr;
      } catch { }
    }

    // 4) Extract any JSON array anywhere
    const anyArray = text.match(/\[[\s\S]*?\]/);
    if (anyArray) {
      try {
        const arr = JSON.parse(anyArray[0]);
        if (Array.isArray(arr)) return arr;
      } catch { }
    }

    // 5) Fallback: parse markdown bullet list into questions
    const bullets = text.split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.startsWith('- ') || l.startsWith('* '))
      .map(l => l.replace(/^[-*]\s+/, ''))
      .filter(Boolean);
    if (bullets.length) {
      return bullets.map(line => ({ question: line, type: 'General' }));
    }

    return [];
  }

  const saveInterview = async (generatedQuestions) => {
    try {
      await supabase.from('Interviews').insert([
        {
          job_position: formData?.jobPosition || '',
          job_description: formData?.jobDescription || null,
          duration: Number(formData?.duration) || null,
          type: formData?.type || [],
          questions: generatedQuestions,
          created_by: user?.email || null,
          resume_used: !!formData?.resumeFile,
        }
      ]);
    } catch (e) {
      // Non-blocking persistence failure
      console.error('Failed to persist interview:', e?.message || e);
    }
  }

  const GenerateQuestionList = async () => {
    setLoading(true);
    try {
      let payload;

      if (formData?.resumeFile) {
        const form = new FormData();
        form.append('resume', formData.resumeFile);
        form.append('jobPosition', formData.jobPosition || '');
        form.append('duration', formData.duration || '');
        form.append('type', JSON.stringify(formData.type || []));

        payload = await axios.post('/api/ai-model', form);
      } else {
        payload = await axios.post('/api/ai-model', { ...formData });
      }

      const content = payload?.data?.questions || payload?.data?.content || '';
      const generated = parseQuestions(typeof content === 'string' ? content : JSON.stringify(content));
      setQuestions(generated);
      setRawContent(typeof content === 'string' ? content : JSON.stringify(content));
      // Skip intermediate persistence to avoid duplicate rows.
      setLoading(false);
    } catch (error) {
      const msg = error?.response?.data?.error || error?.message || 'Server Error, Try Again Later!';
      toast(msg);
      setLoading(false);
    }
  }

  const onFinish = async () => {
    setSaveLoading(true);

    const { data: userData, error: userError } = await supabase
      .from('Users')
      .select('credits, subscription_status')
      .eq('email', user?.email)
      .single();

    if (userError || !userData) {
      toast('Unable to verify user credits');
      setSaveLoading(false);
      return;
    }

    if (userData.credits <= 0) {
      toast('Insufficient credits. Please purchase credits or subscribe to continue.');
      setSaveLoading(false);
      return;
    }

    const interview_id = uuidv4();
    const payload = {
      interview_id,
      jobPosition: formData?.jobPosition || '',
      jobDescription: formData?.jobDescription || null,
      duration: Number(formData?.duration) || null,
      type: formData?.type || [],
      questionList: questions,
      userEmail: user?.email || null,
    };

    const { data, error } = await supabase
      .from('Interviews')
      .insert([payload])
      .select('interview_id')
      .single();

    if (error) {
      toast(error.message || 'Failed to save interview');
      setSaveLoading(false);
      return;
    }

    const creditsBefore = userData.credits;
    const creditsAfter = creditsBefore - 1;

    const userUpdate = await supabase
      .from('Users')
      .update({
        credits: creditsAfter,
        credits_used: (userData.credits_used || 0) + 1
      })
      .eq('email', user?.email);

    await supabase
      .from('CreditHistory')
      .insert([{
        user_email: user?.email,
        action: 'deducted',
        credits_changed: 1,
        credits_before: creditsBefore,
        credits_after: creditsAfter,
        reason: 'Interview created',
        interview_id: interview_id,
      }]);

    setSaveLoading(false);
    toast.success('Interview created successfully');
    onCreateLink(data?.interview_id || interview_id);
  }
  return (
    <div>
      {loading &&
        <div className='p-5 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3'>
          <Loader2Icon className='animate-spin' />
          <div>
            <h2 className='font-medium'>Generating Interview Questions...</h2>
            <p className='text-primary'>Our AI is Crafting questions bases on your job position</p>
          </div>
        </div>}
      {!loading && questions?.length > 0 && (
        <div className='mt-5 bg-white border border-gray-200 rounded-xl p-5'>
          <QuestionListContainer questions={questions} />
        </div>
      )}
      {!loading && questions?.length === 0 && rawContent && (
        <div className='mt-5 bg-white border border-gray-200 rounded-xl p-5'>
          <h3 className='font-bold mb-2'>AI Response</h3>
          <pre className='text-sm whitespace-pre-wrap break-words'>{rawContent}</pre>
        </div>
      )}
      <div className='flex justify-end mt-10'>
        <Button onClick={() => { onFinish() }} disabled={saveLoading}>
          {saveLoading && <Loader2Icon className='animate-spin' />}
          Create Interview Link & Finish</Button>
      </div>
    </div>
  )
}

export default QuestionList
