import { Application, Candidate, Job, MessageLanguage, MessageTone, TemplateType, MessageTemplate } from '@/types';
import { COMPANY_NAME } from './brand';

export type { MessageLanguage, MessageTone, TemplateType, MessageTemplate };

export interface GeneratedMessage {
  text: string;
  whatsappUrl: string;
  smsUrl: string;
  rawPhone: string;
}

export const ALLOWED_VARIABLES = [
  '{{candidate_name}}',
  '{{job_title}}',
  '{{company_name}}',
  '{{form_link}}',
  '{{hr_name}}',
  '{{hr_phone}}',
  '{{interview_date}}',
  '{{interview_time}}',
  '{{interview_location}}',
  '{{job_city}}',
  '{{job_location}}',
  '{{map_link}}',
  '{{salary_range}}',
] as const;

export interface TemplateVariableContext {
  candidate_name?: string;
  job_title?: string;
  company_name?: string;
  form_link?: string;
  hr_name?: string;
  hr_phone?: string;
  interview_date?: string;
  interview_time?: string;
  interview_location?: string;
  job_city?: string;
  job_location?: string;
  map_link?: string;
  salary_range?: string;
  [key: string]: string | undefined;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates template variables and required fields
 */
export function validateTemplateVariables(content: string, templateType: TemplateType): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const matches = content.match(/\{\{([^}]+)\}\}/g) || [];
  const allowedSet = new Set<string>(ALLOWED_VARIABLES);

  for (const match of matches) {
    if (!allowedSet.has(match)) {
      warnings.push(`Unknown variable "${match}".`);
    }
  }

  // Required form_link check
  if ((templateType === 'screening_invite' || templateType === 'reminder_24h') && !content.includes('{{form_link}}')) {
    errors.push('{{form_link}} is mandatory for Screening Invite and 24-Hour Reminder templates so candidates can submit answers.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Replaces {{variable}} placeholders with actual contextual values
 */
export function renderTemplate(templateText: string, context: TemplateVariableContext): string {
  let result = templateText;

  // If job_location is not provided / empty, cleanly remove any line that references {{job_location}}
  const hasJobLocation = Boolean(context.job_location && context.job_location.trim());
  if (!hasJobLocation) {
    result = result.replace(/^[^\n\r]*\{\{job_location\}\}[^\n\r]*(\r?\n)?/gm, '');
  }

  // If map_link is not provided / empty, cleanly remove any line that references {{map_link}}
  const hasMapLink = Boolean(context.map_link && context.map_link.trim());
  if (!hasMapLink) {
    result = result.replace(/^[^\n\r]*\{\{map_link\}\}[^\n\r]*(\r?\n)?/gm, '');
  }

  for (const [key, value] of Object.entries(context)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value !== undefined && value !== null ? String(value) : '');
  }

  // Clean up any extraneous blank lines (maximum two consecutive newlines)
  result = result.replace(/\n{3,}/g, '\n\n').trim();

  return result;
}

/**
 * Formats WhatsApp markdown for web chat bubble preview
 */
export function formatWhatsAppMarkdown(text: string): string {
  let safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold: *text*
  safe = safe.replace(/(^|[^\w*])\*([^*\n\r]+)\*([^\w*]|$)/g, '$1<strong class="font-bold text-gray-950">$2</strong>$3');
  // Italic: _text_
  safe = safe.replace(/(^|[^\w_])_([^_\n\r]+)_([^\w_]|$)/g, '$1<em class="italic">$2</em>$3');
  // Strike: ~text~
  safe = safe.replace(/(^|[^\w~])~([^~\n\r]+)~([^\w~]|$)/g, '$1<del class="line-through text-gray-500">$2</del>$3');

  // URLs
  safe = safe.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-emerald-700 underline font-medium hover:text-emerald-900">$1</a>');

  return safe.replace(/\n/g, '<br/>');
}

/**
 * Calculates SMS characters and billing segment count
 */
export function calculateSmsSegments(text: string) {
  const characterCount = text.length;
  // Unicode check (Devanagari, emoji, symbols)
  const isUnicode = /[^\u0020-\u007E\r\n]/.test(text);

  const singleLimit = isUnicode ? 70 : 160;
  const multiLimit = isUnicode ? 67 : 153;

  let segments = 1;
  if (characterCount > singleLimit) {
    segments = Math.ceil(characterCount / multiLimit);
  }

  return {
    characterCount,
    isUnicode,
    singleLimit,
    segments,
    isOverSingleSms: characterCount > singleLimit,
  };
}

/**
 * Generate standard screening form URL
 */
export function getFormUrl(token: string, baseUrl?: string): string {
  const host = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${host}/apply/${token}`;
}

/**
 * Clean phone number for WhatsApp wa.me click-to-chat
 */
export function getWhatsAppCleanPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Complete Library of 40 Tone Presets (4 Templates x 2 Languages x 5 Tones)
 */
export const TONE_PRESETS: Record<
  TemplateType,
  Record<MessageLanguage, Record<MessageTone, string>>
> = {
  screening_invite: {
    en: {
      friendly: `Namaste {{candidate_name}}! 😊

Thank you for applying for the *{{job_title}}* position with us at *{{company_name}}*. We loved reviewing your WorkIndia profile!

To help us move fast, could you take 2 quick minutes to share your availability and key preferences on this screening form?

👉 {{form_link}}

It's super quick and mobile-friendly. Looking forward to connecting soon!

Warmly,
{{hr_name}}
{{company_name}}`,

      professional: `Dear {{candidate_name}},

Thank you for your application for the position of *{{job_title}}* at *{{company_name}}*.

As the next step in our recruitment process, we request you to complete our brief online screening questionnaire:

👉 {{form_link}}

This link will remain active for 7 days. Your prompt response will help us evaluate your candidacy without delay.

Regards,
{{hr_name}}
Human Resources | {{company_name}}
Contact: {{hr_phone}}`,

      warm_respectful: `Namaste {{candidate_name}} ji,

We sincerely appreciate your interest in joining {{company_name}} for the *{{job_title}}* opening.

Your profile has been received by our recruitment team. To ensure we consider your career aspirations and schedule with care, please grace us with 2 minutes of your time to complete this screening questionnaire:

👉 {{form_link}}

Thank you for your valuable time and consideration.

With respectful regards,
{{hr_name}}
Recruitment Team | {{company_name}}`,

      short_direct: `Hi {{candidate_name}},

Received your application for *{{job_title}}* at {{company_name}}.

Next step: complete the 2-minute screening form below to proceed:
👉 {{form_link}}

HR Team, {{company_name}}`,

      polite_urgent: `Namaste {{candidate_name}},

We are actively scheduling interviews this week for the *{{job_title}}* role at *{{company_name}}* in {{job_city}}.

To ensure your application is reviewed before positions are filled, please submit your screening form today:

👉 {{form_link}}

(Takes only 2 minutes on phone)

Best regards,
{{hr_name}}
Recruitment Desk | {{company_name}}
{{hr_phone}}`,
    },

    hi: {
      friendly: `नमस्ते {{candidate_name}}! 😊

*{{company_name}}* में *{{job_title}}* पद के लिए आवेदन करने हेतु हार्दिक धन्यवाद। आपका वर्कइंडिया प्रोफाइल हमें बहुत पसंद आया!

अगले चरण के लिए, कृपया 2 मिनट निकालकर अपनी उपलब्धता और प्राथमिकताओं का यह छोटा फॉर्म भरें:

👉 {{form_link}}

यह फॉर्म मोबाइल पर आसानी से खुलता है। आपसे जल्द बातचीत की उम्मीद है!

सादर,
{{hr_name}}
{{company_name}}`,

      professional: `प्रिय {{candidate_name}},

*{{company_name}}* में *{{job_title}}* पद के लिए आपके आवेदन हेतु धन्यवाद।

हमारी भर्ती प्रक्रिया के अगले चरण के रूप में, आपसे अनुरोध है कि कृपया निम्नलिखित संक्षिप्त स्क्रीनिंग फॉर्म भरें:

👉 {{form_link}}

यह लिंक 7 दिनों तक मान्य रहेगा। समय पर उत्तर मिलने से हम आपके आवेदन पर शीघ्र निर्णय ले सकेंगे।

सादर,
{{hr_name}}
मानव संसाधन विभाग | {{company_name}}
संपर्क: {{hr_phone}}`,

      warm_respectful: `सादर नमस्ते {{candidate_name}} जी,

*{{company_name}}* में *{{job_title}}* पद हेतु आपकी रुचि के लिए हम आपके आभारी हैं।

हमारी भर्ती टीम ने आपका प्रोफाइल प्राप्त किया है। आपकी सुविधा और कार्य प्राथमिकताओं को सम्मानपूर्वक समझने हेतु, कृपया 2 मिनट का समय देकर यह फॉर्म भरें:

👉 {{form_link}}

आपके बहुमूल्य समय और सहयोग के लिए धन्यवाद।

सादर प्रणाम,
{{hr_name}}
भर्ती टीम | {{company_name}}`,

      short_direct: `नमस्ते {{candidate_name}},

{{company_name}} में *{{job_title}}* हेतु आपका आवेदन प्राप्त हुआ।

आगे बढ़ने के लिए 2 मिनट का स्क्रीनिंग फॉर्म तुरंत भरें:
👉 {{form_link}}

एचआर टीम, {{company_name}}`,

      polite_urgent: `नमस्ते {{candidate_name}},

*{{company_name}}* में *{{job_title}}* पद ({{job_city}}) के लिए इस सप्ताह इंटरव्यू प्रक्रिया चालू है।

ओपनिंग बंद होने से पहले अपने आवेदन को प्राथमिकता देने के लिए, कृपया आज ही यह फॉर्म भरें:

👉 {{form_link}}

(केवल 2 मिनट का समय लगता है)

सादर,
{{hr_name}}
भर्ती कार्यालय | {{company_name}}
{{hr_phone}}`,
    },
  },

  reminder_24h: {
    en: {
      friendly: `Hey {{candidate_name}}! 👋

Just checking in regarding your application for the *{{job_title}}* opening at *{{company_name}}*.

We noticed you haven't filled out your 2-minute screening form yet. We're reviewing candidates today and would love to include your profile!

👉 {{form_link}}

Takes just a couple of minutes on your phone.

Warm regards,
{{hr_name}}`,

      professional: `Dear {{candidate_name}},

This is a gentle reminder regarding your application for the *{{job_title}}* position at *{{company_name}}*.

Our team is currently finalizing the shortlist. To ensure your profile is considered for the upcoming interview round, please complete your screening details here:

👉 {{form_link}}

Thank you for your prompt attention.

Regards,
{{hr_name}}
HR Department | {{company_name}}`,

      warm_respectful: `Namaste {{candidate_name}} ji,

Hope you are having a wonderful day.

A humble reminder regarding your application for *{{job_title}}* with {{company_name}}. We are keen to consider your profile and kindly request you to complete this short screening step when convenient:

👉 {{form_link}}

Thank you for your gracious time.

Respectfully,
{{hr_name}}
{{company_name}}`,

      short_direct: `Reminder for {{candidate_name}}:

Please complete your screening form for *{{job_title}}* at {{company_name}} to keep your application active:
👉 {{form_link}}

HR Desk`,

      polite_urgent: `Action Required: {{candidate_name}}

We are finalizing candidate shortlists today for *{{job_title}}* at *{{company_name}}*.

To prevent your application from expiring, please submit your response within the next few hours:

👉 {{form_link}}

Best regards,
{{hr_name}}
{{company_name}} | {{hr_phone}}`,
    },

    hi: {
      friendly: `नमस्ते {{candidate_name}}! 👋

*{{company_name}}* में *{{job_title}}* पद के आपके आवेदन के संबंध में एक छोटा सा रिमाइंडर।

हमने देखा कि आपने अभी तक अपना 2 मिनट का स्क्रीनिंग फॉर्म पूरा नहीं किया है। हम आज ही उम्मीदवारों की समीक्षा कर रहे हैं और आपके आवेदन को शामिल करना चाहते हैं!

👉 {{form_link}}

कृपया फोन पर 2 मिनट निकालकर इसे पूरा करें।

सादर,
{{hr_name}}`,

      professional: `प्रिय {{candidate_name}},

*{{company_name}}* में *{{job_title}}* पद के आपके आवेदन के संबंध में यह एक औपचारिक स्मरण पत्र है।

हमारी टीम वर्तमान में शॉर्टलिस्ट तैयार कर रही है। आगामी इंटरव्यू राउंड में विचार किए जाने हेतु, कृपया अपना विवरण यहाँ दर्ज करें:

👉 {{form_link}}

शीघ्र प्रतिक्रिया के लिए धन्यवाद।

सादर,
{{hr_name}}
मानव संसाधन विभाग | {{company_name}}`,

      warm_respectful: `सादर नमस्ते {{candidate_name}} जी,

आशा है आप सकुशल होंगे।

{{company_name}} में *{{job_title}}* पद हेतु आपके आवेदन के संबंध में विनम्र स्मरण। हम आपके प्रोफाइल को आगे बढ़ाना चाहते हैं, अतः सुविधा अनुसार कृपया यह 2 मिनट का फॉर्म अवश्य भरें:

👉 {{form_link}}

आपके सहयोग के लिए धन्यवाद।

सादर,
{{hr_name}}
{{company_name}}`,

      short_direct: `रिमाइंडर {{candidate_name}}:

{{company_name}} में *{{job_title}}* पद हेतु अपना स्क्रीनिंग फॉर्म तुरंत भरें:
👉 {{form_link}}

एचआर डेस्क`,

      polite_urgent: `महत्वपूर्ण सूचना: {{candidate_name}}

*{{company_name}}* में *{{job_title}}* पद हेतु शॉर्टलिस्ट को आज अंतिम रूप दिया जा रहा है।

अपने आवेदन को सक्रिय रखने हेतु, कृपया अगले कुछ घंटों में यह फॉर्म भरें:

👉 {{form_link}}

सादर,
{{hr_name}}
{{company_name}} | {{hr_phone}}`,
    },
  },

  interview_invite: {
    en: {
      friendly: `Great news, {{candidate_name}}! 🎉

Your profile for *{{job_title}}* at *{{company_name}}* has been *shortlisted*! We would love to meet you for an interview.

📅 Date: *{{interview_date}}*
⏰ Time: *{{interview_time}}*
📍 Mode / Venue: *{{interview_location}}*
🏢 Work Location: {{job_location}}
🗺️ Maps Link: {{map_link}}

Please reply *"CONFIRM"* to lock in this slot, or let me know if you need to reschedule.

Excited to speak with you!

Best regards,
{{hr_name}}
{{company_name}} | {{hr_phone}}`,

      professional: `Dear {{candidate_name}},

Congratulations. Following the review of your screening assessment, we are pleased to invite you for an interview for the *{{job_title}}* position with *{{company_name}}*.

Interview Details:
- Date: {{interview_date}}
- Time: {{interview_time}}
- Venue / Channel: {{interview_location}}
- Work Location: {{job_location}}
- Maps Link: {{map_link}}
- Reporting Contact: {{hr_name}} ({{hr_phone}})

Kindly confirm your availability by replying to this message at your earliest convenience.

Sincerely,
{{hr_name}}
Human Resources | {{company_name}}`,

      warm_respectful: `Namaste {{candidate_name}} ji,

Hearty congratulations on being shortlisted for the *{{job_title}}* role with {{company_name}}.

We would be honored to invite you for an interview:
🗓️ Date: *{{interview_date}}*
🕒 Time: *{{interview_time}}*
🏛️ Mode / Location: *{{interview_location}}*
📍 Work Location: {{job_location}}
🗺️ Location Map: {{map_link}}

Please grace us with a confirmation reply if this schedule suits you comfortably.

With warm regards and best wishes,
{{hr_name}}
{{company_name}} | {{hr_phone}}`,

      short_direct: `Hi {{candidate_name}},

You are shortlisted for *{{job_title}}* at {{company_name}}.

Interview: {{interview_date}} at {{interview_time}}
Location: {{interview_location}}
Workplace: {{job_location}}
Map: {{map_link}}

Reply YES to confirm.

{{hr_name}} ({{hr_phone}})`,

      polite_urgent: `Urgent: Interview Invitation for {{candidate_name}}

Congratulations! You have been shortlisted for *{{job_title}}* at *{{company_name}}*.

Scheduled Slot:
*{{interview_date}}* at *{{interview_time}}*
Location: *{{interview_location}}*
Address: {{job_location}}
Map: {{map_link}}

Please confirm by replying *"YES"* within 4 hours to reserve this interview slot.

Regards,
{{hr_name}}
{{company_name}} | {{hr_phone}}`,
    },

    hi: {
      friendly: `बहुत बधाई {{candidate_name}}! 🎉

*{{company_name}}* में *{{job_title}}* पद के लिए आपका चयन *इंटरव्यू राउंड* के लिए हो गया है! हम आपसे बातचीत करने के लिए उत्सुक हैं।

📅 दिनांक: *{{interview_date}}*
⏰ समय: *{{interview_time}}*
📍 स्थान / माध्यम: *{{interview_location}}*
🏢 कार्य स्थल: {{job_location}}
🗺️ मैप लिंक: {{map_link}}

यह समय पक्का करने के लिए कृपया इस संदेश का *"CONFIRM"* लिखकर उत्तर दें।

सादर,
{{hr_name}}
{{company_name}} | {{hr_phone}}`,

      professional: `प्रिय {{candidate_name}},

बधाई। स्क्रीनिंग मूल्यांकन की समीक्षा के पश्चात, हमें *{{company_name}}* में *{{job_title}}* पद हेतु आपको इंटरव्यू के लिए आमंत्रित करते हुए प्रसन्नता है।

इंटरव्यू विवरण:
- दिनांक: {{interview_date}}
- समय: {{interview_time}}
- माध्यम / स्थान: {{interview_location}}
- कार्य स्थल: {{job_location}}
- गूगल मैप: {{map_link}}
- एचआर संपर्क: {{hr_name}} ({{hr_phone}})

कृपया अपनी उपलब्धता की पुष्टि हेतु इस संदेश का उत्तर दें।

सादर,
{{hr_name}}
मानव संसाधन विभाग | {{company_name}}`,

      warm_respectful: `सादर नमस्ते {{candidate_name}} जी,

*{{company_name}}* में *{{job_title}}* पद हेतु शॉर्टलिस्ट होने पर आपको हार्दिक बधाई व शुभकामनाएं।

हम आपको इंटरव्यू के लिए सादर आमंत्रित करते हैं:
🗓️ दिनांक: *{{interview_date}}*
🕒 समय: *{{interview_time}}*
🏛️ स्थान / माध्यम: *{{interview_location}}*
📍 कार्य स्थल: {{job_location}}
🗺️ मैप: {{map_link}}

यदि यह समय आपके लिए सुविधाजनक है, तो कृपया पुष्टि संदेश भेजें।

सादर व मंगलकामनाओं सहित,
{{hr_name}}
{{company_name}} | {{hr_phone}}`,

      short_direct: `नमस्ते {{candidate_name}},

*{{job_title}}* हेतु आप शॉर्टलिस्ट हुए हैं।

इंटरव्यू: {{interview_date}}, समय: {{interview_time}}
स्थान: {{interview_location}}
कार्य स्थल: {{job_location}}
मैप: {{map_link}}

पुष्टि हेतु YES लिखकर भेजें।

{{hr_name}} ({{hr_phone}})`,

      polite_urgent: `अति-महत्वपूर्ण: इंटरव्यू आमंत्रण ({{candidate_name}})

बधाई! *{{company_name}}* में *{{job_title}}* पद के लिए आपका इंटरव्यू निर्धारित किया गया है।

समय: *{{interview_date}}* को *{{interview_time}}*
स्थान: *{{interview_location}}*
कार्य स्थल: {{job_location}}
मैप: {{map_link}}

अपना स्लॉट सुरक्षित करने हेतु कृपया 4 घंटे के भीतर *"YES"* लिखकर उत्तर दें।

सादर,
{{hr_name}}
{{company_name}} | {{hr_phone}}`,
    },
  },

  rejection: {
    en: {
      friendly: `Namaste {{candidate_name}},

Thank you so much for taking the time to apply and connect with us regarding the *{{job_title}}* position at *{{company_name}}*.

While we were impressed with your background, we have chosen to move forward with candidates whose current skill profile aligns even more closely with this specific role.

We truly appreciate your effort and would love to stay connected for future openings that match your skills. Wishing you the absolute best in your career!

Warmly,
{{hr_name}}
{{company_name}}`,

      professional: `Dear {{candidate_name}},

Thank you for your interest in {{company_name}} and for applying to the *{{job_title}}* role.

After careful evaluation of all applications, we regret to inform you that we will not be moving forward with your candidacy at this time, as other applicants more closely matched our immediate technical requirements.

We will retain your resume in our talent database for suitable upcoming vacancies. We wish you every success in your ongoing job search.

Sincerely,
Human Resources Team
{{company_name}}`,

      warm_respectful: `Namaste {{candidate_name}} ji,

We sincerely thank you for sharing your time and profile for the *{{job_title}}* vacancy at {{company_name}}.

Every application received our deepest consideration. While we are unable to offer you this specific position today due to current operational constraints, we hold your experience and dedication in high regard.

Your profile will be kept active in our talent network for suitable future opportunities. May you achieve continuous success and fulfillment in your professional journey.

With respectful regards,
{{hr_name}}
{{company_name}}`,

      short_direct: `Dear {{candidate_name}},

Thank you for applying for *{{job_title}}* at {{company_name}}.

We have decided to move forward with other candidates at this time. We will retain your profile for future openings.

Best wishes for your career,
HR Team, {{company_name}}`,

      polite_urgent: `Dear {{candidate_name}},

Status update regarding your application for *{{job_title}}* at *{{company_name}}*.

Our recruitment drive for this position has now concluded, and we have selected other applicants who met our immediate requirements.

Thank you sincerely for your application and interest in our organization.

Regards,
Recruitment Team
{{company_name}}`,
    },

    hi: {
      friendly: `नमस्ते {{candidate_name}},

*{{company_name}}* में *{{job_title}}* पद हेतु आवेदन और हमारे साथ जुड़ने के लिए बहुत-बहुत धन्यवाद।

यद्यपि आपका अनुभव सराहनीय है, वर्तमान पद की विशिष्ट आवश्यकताओं के कारण हमने अन्य उम्मीदवारों के साथ आगे बढ़ने का निर्णय लिया है।

हम आपके उज्ज्वल भविष्य और सफल करियर की कामना करते हैं। भविष्य में उपयुक्त अवसर मिलने पर हम आपसे अवश्य संपर्क करेंगे!

सादर,
{{hr_name}}
{{company_name}}`,

      professional: `प्रिय {{candidate_name}},

*{{company_name}}* में *{{job_title}}* पद में रुचि लेने और आवेदन करने हेतु धन्यवाद।

सभी आवेदनों की समीक्षा के उपरांत, हमें सूचित करते हुए खेद है कि हम इस समय आपके आवेदन को आगे नहीं बढ़ा पा रहे हैं, क्योंकि अन्य उम्मीदवार वर्तमान आवश्यकताओं से अधिक मेल खाते हैं।

हम भविष्य के अवसरों हेतु आपका विवरण अपने रिकॉर्ड में सुरक्षित रखेंगे। आपके सफल भविष्य के लिए हमारी शुभकामनाएं।

सादर,
मानव संसाधन विभाग
{{company_name}}`,

      warm_respectful: `सादर नमस्ते {{candidate_name}} जी,

{{company_name}} में *{{job_title}}* पद हेतु अपना बहुमूल्य समय और आवेदन साझा करने के लिए हार्दिक धन्यवाद।

हमने आपके प्रोफाइल का अत्यंत आदरपूर्वक अध्ययन किया। यद्यपि वर्तमान स्थिति में हम आपको यह अवसर प्रदान करने में असमर्थ हैं, हम आपके कौशल और निष्ठा का सम्मान करते हैं।

हम आपका प्रोफाइल अपने रिकॉर्ड में सुरक्षित रखेंगे। ईश्वर से आपके उज्ज्वल व सफल भविष्य की मंगलकामना करते हैं।

सादर प्रणाम,
{{hr_name}}
{{company_name}}`,

      short_direct: `नमस्ते {{candidate_name}},

{{company_name}} में *{{job_title}}* पद हेतु आवेदन के लिए धन्यवाद।

इस समय हमने अन्य उम्मीदवारों को चुना है। भविष्य के लिए आपका प्रोफाइल हमारे पास सुरक्षित रहेगा।

शुभकामनाएं,
एचआर टीम, {{company_name}}`,

      polite_urgent: `प्रिय {{candidate_name}},

*{{company_name}}* में *{{job_title}}* पद हेतु आवेदन की स्थिति।

इस पद हेतु हमारी भर्ती प्रक्रिया पूरी हो चुकी है और चयनित उम्मीदवारों को सूचित कर दिया गया है।

हमारी संस्था में रुचि लेने के लिए आपका हार्दिक धन्यवाद।

सादर,
भर्ती विभाग
{{company_name}}`,
    },
  },
};

/**
 * Standard candidate message creator with active template resolution
 */
export function createCandidateMessage(
  templateType: TemplateType,
  lang: MessageLanguage,
  candidateName: string,
  jobTitle: string,
  phone: string,
  token?: string,
  slot?: string,
  baseUrl?: string,
  customTemplateText?: string,
  extraContext?: Partial<TemplateVariableContext>
): GeneratedMessage {
  const formUrl = token ? getFormUrl(token, baseUrl) : '';

  // Parse slot into date and time if available
  let interviewDate = 'Tomorrow';
  let interviewTime = '11:00 AM';
  if (slot) {
    if (slot.includes('at')) {
      const parts = slot.split('at');
      interviewDate = parts[0]?.trim() || interviewDate;
      interviewTime = parts[1]?.trim() || interviewTime;
    } else {
      interviewDate = slot;
    }
  }

  const jobLocation = extraContext?.job_location || '';
  const mapLink = extraContext?.map_link || (jobLocation ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(jobLocation + (extraContext?.job_city ? ', ' + extraContext.job_city : ''))}` : '');

  const context: TemplateVariableContext = {
    candidate_name: candidateName || 'Candidate',
    job_title: jobTitle || 'Job Opening',
    company_name: extraContext?.company_name || COMPANY_NAME,
    form_link: formUrl,
    hr_name: extraContext?.hr_name || 'HR Recruitment Team',
    hr_phone: extraContext?.hr_phone || '+91 9876543210',
    interview_date: extraContext?.interview_date || interviewDate,
    interview_time: extraContext?.interview_time || interviewTime,
    interview_location: extraContext?.interview_location || jobLocation || 'Office / Telephonic',
    job_city: extraContext?.job_city || 'Mumbai',
    job_location: jobLocation,
    map_link: mapLink,
    salary_range: extraContext?.salary_range || 'Competitive',
    ...extraContext,
  };

  let text = '';
  if (customTemplateText) {
    text = renderTemplate(customTemplateText, context);
  } else {
    // Default to friendly tone preset if custom text not provided
    const defaultPreset = TONE_PRESETS[templateType]?.[lang]?.['friendly'];
    if (defaultPreset) {
      text = renderTemplate(defaultPreset, context);
    } else {
      text = `Namaste ${candidateName}, regarding ${jobTitle}: ${formUrl}`;
    }
  }

  const cleanPhone = getWhatsAppCleanPhone(phone);
  const encodedText = encodeURIComponent(text);

  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;
  const smsUrl = `sms:${phone}?body=${encodedText}`;

  return {
    text,
    whatsappUrl,
    smsUrl,
    rawPhone: phone,
  };
}
