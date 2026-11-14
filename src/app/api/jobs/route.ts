import { NextRequest, NextResponse } from 'next/server';
import { createJob, findDuplicateJob, getJobs } from '@/lib/db';
import { validateJobInput } from '@/lib/validation';

export async function GET() {
  try {
    const jobs = await getJobs();
    return NextResponse.json({ success: true, jobs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.check_duplicate) {
      const duplicate = findDuplicateJob(body.title, body.city, body.location, body.excludeJobId);
      return NextResponse.json({
        success: true,
        isDuplicate: !!duplicate,
        duplicateJob: duplicate || null,
        message: duplicate
          ? `A job with the title "${duplicate.title}" in "${duplicate.city}" already exists.`
          : 'No duplicate found.',
      });
    }

    const validation = validateJobInput({
      title: body.title,
      city: body.city,
      location: body.location,
    });
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    if (body.map_url && typeof body.map_url === 'string' && body.map_url.trim()) {
      const trimmedUrl = body.map_url.trim();
      if (!trimmedUrl.startsWith('https://')) {
        return NextResponse.json(
          { success: false, error: 'Google Maps link must be a valid https URL' },
          { status: 400 }
        );
      }
    }

    // Check if duplicate exists for warning
    const duplicate = findDuplicateJob(body.title, body.city, body.location);

    const newJob = await createJob({
      title: body.title,
      department: body.department || 'Operations',
      city: body.city,
      location: typeof body.location === 'string' ? body.location.trim() : '',
      map_url: typeof body.map_url === 'string' ? body.map_url.trim() : '',
      openings: Number(body.openings) || 1,
      min_exp_years: Number(body.min_exp_years) || 0,
      max_exp_years: Number(body.max_exp_years) || 5,
      min_salary: Number(body.min_salary) || 15000,
      max_salary: Number(body.max_salary) || 35000,
      shift_type: body.shift_type || 'day',
      required_skills: Array.isArray(body.required_skills) ? body.required_skills : [],
      required_languages: Array.isArray(body.required_languages) ? body.required_languages : ['Hindi', 'English'],
      status: 'active',
      created_by: body.created_by || 'Alex',
      scoring_rules: body.scoring_rules,
    });

    return NextResponse.json({
      success: true,
      job: newJob,
      warning: duplicate
        ? `Warning: A job with the same title "${duplicate.title}" in "${duplicate.city}" (${duplicate.location || 'no location'}) already exists.`
        : undefined,
    });
  } catch (err: any) {
    console.error('Create job error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create job opening' },
      { status: 500 }
    );
  }
}
