import { NextRequest, NextResponse } from 'next/server';
import { submitCandidateForm } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json();

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 });
    }

    if (!body.consent_given) {
      return NextResponse.json(
        { success: false, error: 'DPDP consent is required' },
        { status: 400 }
      );
    }

    const result = await submitCandidateForm(token, {
      current_city: body.current_city || '',
      experience_years: Number(body.experience_years) || 0,
      matched_skills: Array.isArray(body.matched_skills) ? body.matched_skills : [],
      expected_salary: Number(body.expected_salary) || 0,
      notice_period_days: Number(body.notice_period_days) || 0,
      shift_preference: body.shift_preference || 'any',
      languages: Array.isArray(body.languages) ? body.languages : ['Hindi', 'English'],
      preferred_interview_slot: body.preferred_interview_slot || '',
      consent_given: Boolean(body.consent_given),
      consent_text: body.consent_text || 'DPDP Act 2023 consent',
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to submit screening form' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      score: result.score,
      message: 'Screening answers recorded and scored successfully.',
    });
  } catch (err: any) {
    console.error('Screening submission error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

