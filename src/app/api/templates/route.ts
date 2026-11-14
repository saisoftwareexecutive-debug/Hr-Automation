import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getActiveTemplate,
  getTemplateHistory,
  getTemplates,
  resetTemplateToDefault,
  restoreTemplateVersion,
  saveTemplateVersion,
  setActiveTemplate,
} from '@/lib/db';
import { validateTemplateVariables } from '@/lib/templates';
import { MessageLanguage, MessageTone, TemplateType } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') as TemplateType | null;
    const lang = searchParams.get('lang') as MessageLanguage | null;
    const jobId = searchParams.get('jobId') || null;
    const history = searchParams.get('history') === 'true';

    if (type && lang && history) {
      const versions = await getTemplateHistory(type, lang, jobId);
      return NextResponse.json({ success: true, versions });
    }

    if (type && lang) {
      const active = await getActiveTemplate(type, lang, jobId);
      return NextResponse.json({ success: true, template: active });
    }

    const all = await getTemplates();
    return NextResponse.json({ success: true, templates: all });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Role check: HR Executive can view but not edit templates
    if (session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Permission denied: Only Admin users can modify message templates.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'save') {
      const { template_type, language, tone, title, content, job_id, set_active } = body;

      if (!template_type || !language || !tone || !content) {
        return NextResponse.json(
          { success: false, error: 'Template type, language, tone, and content are required' },
          { status: 400 }
        );
      }

      // Validate template variables and required fields
      const validation = validateTemplateVariables(content, template_type);
      if (!validation.isValid) {
        return NextResponse.json(
          { success: false, error: validation.errors.join('; ') },
          { status: 400 }
        );
      }

      const saved = await saveTemplateVersion(
        {
          template_type,
          language,
          tone,
          title: title || `${template_type} (${language})`,
          content,
          job_id: job_id || null,
          set_active: set_active !== false,
        },
        session.email
      );

      return NextResponse.json({ success: true, template: saved, warnings: validation.warnings });
    }

    if (action === 'set_active') {
      const { templateId } = body;
      if (!templateId) {
        return NextResponse.json({ success: false, error: 'templateId is required' }, { status: 400 });
      }

      const updated = await setActiveTemplate(templateId, session.email);
      return NextResponse.json({ success: true, template: updated });
    }

    if (action === 'restore') {
      const { templateId } = body;
      if (!templateId) {
        return NextResponse.json({ success: false, error: 'templateId is required' }, { status: 400 });
      }

      const restored = await restoreTemplateVersion(templateId, session.email);
      return NextResponse.json({ success: true, template: restored });
    }

    if (action === 'reset') {
      const { template_type, language, tone } = body;
      if (!template_type || !language) {
        return NextResponse.json(
          { success: false, error: 'template_type and language are required' },
          { status: 400 }
        );
      }

      const resetTmpl = await resetTemplateToDefault(
        template_type,
        language,
        session.email,
        tone || 'friendly'
      );
      return NextResponse.json({ success: true, template: resetTmpl });
    }

    return NextResponse.json({ success: false, error: `Invalid action "${action}"` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Template version ID is required' }, { status: 400 });
    }

    const { deleteTemplateVersion } = await import('@/lib/db');
    const result = await deleteTemplateVersion(id, session.email);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Template version deleted successfully.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

