/**
 * CatalystOS - EmailJS Client Service
 * Sends branded invitation, welcome, and notification emails to employees
 * using EmailJS Service ID: service_6dwbxni, Template ID: template_xqoitun.
 */

export const EMAILJS_SERVICE_ID = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAILJS_SERVICE_ID) || 
  'service_6dwbxni';

export const EMAILJS_TEMPLATE_ID = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAILJS_TEMPLATE_ID) || 
  'template_xqoitun';

export const EMAILJS_PUBLIC_KEY = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAILJS_PUBLIC_KEY) || 
  'Ps80tBKWq2vwHICGm';

export interface EmailJsPayload {
  to_email: string;
  to_name?: string;
  from_name?: string;
  company_name?: string;
  role?: string;
  department?: string;
  invite_link?: string;
  message?: string;
  subject?: string;
  custom_params?: Record<string, any>;
}

export interface EmailJsResult {
  success: boolean;
  channel: 'emailjs';
  status?: number;
  message?: string;
}

/**
 * Dispatches an email via EmailJS with full parameter expansion
 * matching common template variable patterns in template_xqoitun.
 */
export async function sendEmailWithEmailJS(payload: EmailJsPayload): Promise<EmailJsResult> {
  const recipientEmail = (payload.to_email || '').trim();
  const recipientName = (payload.to_name || recipientEmail.split('@')[0] || 'Team Member').trim();
  const senderName = (payload.from_name || 'Venture Founder').trim();
  const companyName = (payload.company_name || 'CatalystOS Venture').trim();
  const role = (payload.role || 'Team Member').trim();
  const department = (payload.department || 'Operations').trim();
  const inviteLink = payload.invite_link || `${window.location.origin}/accept-invitation`;
  const subject = payload.subject || `Invitation to join ${companyName} on CatalystOS`;
  const message = payload.message || `${senderName} has added you to ${companyName} as ${role} (${department}). Click the link below to access your workspace: ${inviteLink}`;

  const templateParams: Record<string, any> = {
    // Primary recipient variables
    to_email: recipientEmail,
    email: recipientEmail,
    recipient_email: recipientEmail,
    user_email: recipientEmail,
    reply_to: recipientEmail,

    // Recipient name variables
    to_name: recipientName,
    name: recipientName,
    recipient_name: recipientName,
    user_name: recipientName,
    fullName: recipientName,

    // Sender & organization variables
    from_name: senderName,
    sender_name: senderName,
    founder_name: senderName,
    company_name: companyName,
    company: companyName,
    startup_name: companyName,

    // Role & Department variables
    role,
    member_role: role,
    user_role: role,
    department,
    domain: department,
    dept: department,

    // URLs and Action Links
    invite_link: inviteLink,
    invitation_url: inviteLink,
    link: inviteLink,
    action_url: inviteLink,
    workspace_url: inviteLink,

    // Content variables
    subject,
    title: subject,
    message,
    content: message,
    body: message,

    ...(payload.custom_params || {})
  };

  // 1. Try sending via window.emailjs or optional @emailjs/browser SDK if imported
  try {
    const pkgName = '@emailjs/browser';
    // @ts-ignore - optional dynamic client package
    const emailjs: any = (typeof window !== 'undefined' && (window as any).emailjs) || await import(/* @vite-ignore */ pkgName).catch(() => null);
    if (emailjs && (emailjs.send || (emailjs.default && emailjs.default.send))) {
      const sendFn = emailjs.send || emailjs.default.send;
      const res = await sendFn(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      );
      console.log(`[EmailJS] ✅ Successfully sent to ${recipientEmail} via @emailjs/browser:`, res);
      return { success: true, channel: 'emailjs', status: res?.status || 200, message: 'Dispatched via EmailJS' };
    }
  } catch (sdkErr: any) {
    console.warn('[EmailJS] @emailjs/browser send attempt threw:', sdkErr?.message || sdkErr);
  }

  // 2. Direct HTTP REST API Fallback
  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: templateParams
      })
    });

    if (response.ok) {
      console.log(`[EmailJS] ✅ Successfully sent to ${recipientEmail} via EmailJS REST API (Status 200 OK)`);
      return { success: true, channel: 'emailjs', status: 200, message: 'Sent via EmailJS REST API' };
    } else {
      const errText = await response.text();
      console.error(`[EmailJS] ❌ EmailJS HTTP ${response.status} Error:`, errText);
      return { success: false, channel: 'emailjs', status: response.status, message: errText };
    }
  } catch (netErr: any) {
    console.error('[EmailJS] ❌ Network error dispatching EmailJS:', netErr?.message || netErr);
    return { success: false, channel: 'emailjs', message: netErr?.message || 'Network error' };
  }
}
