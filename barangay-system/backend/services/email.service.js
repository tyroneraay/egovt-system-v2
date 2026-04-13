const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

/**
 * Send an email. Non-blocking — errors are logged, not thrown.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    if (!process.env.SMTP_USER) {
      console.log(`[EMAIL] SMTP not configured. Would send to ${to}: ${subject}`);
      return;
    }

    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text: text || subject,
    });

    console.log(`[EMAIL] Sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`[EMAIL] Failed to send to ${to}:`, err.message);
  }
};

// ============================================================
// EMAIL TEMPLATES
// ============================================================

const sendRequestStatusEmail = async (email, { docName, status, reason }) => {
  const statusLabels = {
    under_review: 'Under Review',
    awaiting_payment: 'Awaiting Payment',
    paid: 'Payment Verified',
    processing: 'Processing',
    ready: 'Ready for Release',
    released: 'Released',
    rejected: 'Rejected',
  };

  await sendEmail({
    to: email,
    subject: `Barangay Document Update — ${docName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1B4332;">Barangay Maharlika</h2>
        <p>Your request for <strong>${docName}</strong> has been updated:</p>
        <div style="padding: 16px; background: #F0FDF4; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; font-size: 18px; font-weight: bold; color: #2D6A4F;">
            Status: ${statusLabels[status] || status}
          </p>
          ${reason ? `<p style="margin: 8px 0 0; color: #991B1B;">Reason: ${reason}</p>` : ''}
        </div>
        <p>Log in to your account for more details.</p>
        <p style="color: #6B7280; font-size: 12px;">This is an automated message from Barangay Maharlika Document System.</p>
      </div>
    `,
  });
};

const sendVerificationEmail = async (email, { name, approved, reason }) => {
  await sendEmail({
    to: email,
    subject: `Account ${approved ? 'Verified' : 'Verification Update'} — Barangay Maharlika`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1B4332;">Barangay Maharlika</h2>
        <p>Dear ${name},</p>
        ${approved
          ? '<p>Your account has been <strong style="color: #059669;">verified</strong>. You can now submit document requests.</p>'
          : `<p>Your verification was <strong style="color: #DC2626;">not approved</strong>.</p>
             <p>Reason: ${reason}</p>
             <p>Please re-upload a valid ID and try again.</p>`
        }
        <p style="color: #6B7280; font-size: 12px;">Barangay Maharlika Document Issuance System</p>
      </div>
    `,
  });
};

const sendDocumentReleasedEmail = async (email, { docName, downloadUrl }) => {
  await sendEmail({
    to: email,
    subject: `Document Released — ${docName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1B4332;">Barangay Maharlika</h2>
        <p>Your <strong>${docName}</strong> is now available!</p>
        ${downloadUrl
          ? `<a href="${downloadUrl}" style="display: inline-block; padding: 12px 24px; background: #2D6A4F; color: #fff; text-decoration: none; border-radius: 8px; margin: 16px 0;">Download Document</a>`
          : '<p>You may pick it up at the Barangay Hall during office hours.</p>'
        }
        <p style="color: #6B7280; font-size: 12px;">Barangay Maharlika Document Issuance System</p>
      </div>
    `,
  });
};

module.exports = {
  sendEmail,
  sendRequestStatusEmail,
  sendVerificationEmail,
  sendDocumentReleasedEmail,
};
