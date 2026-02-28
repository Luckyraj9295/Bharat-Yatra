const express = require("express");
const router = express.Router();
const { Resend } = require("resend");
const Contact = require("../models/Contact");

const resend = new Resend(process.env.RESEND_API_KEY);

router.get('/', (req, res) => {
  res.json({ status: 'Contact route is active' });
});

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Helper: Send emails asynchronously using Resend
const sendContactEmails = async (name, email, message, contactId) => {
  if (!process.env.RESEND_API_KEY) {
    console.error('Resend API key not configured: RESEND_API_KEY');
    await Contact.findByIdAndUpdate(contactId, {
      mailSent: false,
      mailError: 'Resend API key not configured'
    }).catch(err => console.error("DB update error:", err));
    return;
  }

  try {
    // 📩 Mail to Admin
    const adminRes = await resend.emails.send({
      from: "noreply@bharatyatra.com",
      to: process.env.ADMIN_EMAIL || "admin@bharatyatra.com",
      replyTo: email,
      subject: `📬 New Enquiry from ${name}`,
      html: `
        <h2>New Contact Enquiry</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
        <hr/>
        <p>This message was sent from Bharat Yatra Contact Page.</p>
      `,
    });

    if (!adminRes.data?.id) {
      throw new Error(`Admin email failed: ${adminRes.error?.message}`);
    }

    console.log('✅ Admin email sent:', adminRes.data.id);

    // 📩 Auto-reply to User (best-effort)
    try {
      const userRes = await resend.emails.send({
        from: "noreply@bharatyatra.com",
        to: email,
        subject: "We received your enquiry - Bharat Yatra",
        html: `
          <h3>Hello ${name},</h3>
          <p>Thank you for contacting Bharat Yatra.</p>
          <p>Our team has received your message and will get back to you shortly.</p>
          <br/>
          <p><strong>Your Message:</strong></p>
          <p>${message}</p>
          <br/>
          <p>Regards,</p>
          <p><strong>Bharat Yatra Team</strong></p>
        `,
      });
      console.log('✅ User auto-reply sent:', userRes.data?.id);
    } catch (userErr) {
      console.warn("User auto-reply failed:", userErr.message);
    }

    // Mark as sent
    await Contact.findByIdAndUpdate(contactId, { mailSent: true });
    console.log('📧 Contact emails sent for ID:', contactId);

  } catch (error) {
    console.error("Resend mail error:", {
      message: error.message,
      code: error.code
    });
    // Log error but don't crash
    await Contact.findByIdAndUpdate(contactId, {
      mailSent: false,
      mailError: error.message
    }).catch(dbErr => console.error("Failed to update contact error:", dbErr));
  }
};

// POST /api/contact
router.post("/", async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const message = String(req.body?.message || '').trim();

  // Validation
  if (!name || !email || !message) {
    return res.status(400).json({ message: "All fields are required." });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Please enter a valid email address." });
  }

  try {
    // Save to database first
    const contact = await Contact.create({ name, email, message });
    console.log('💾 Contact saved to DB:', contact._id);

    // Send emails asynchronously (don't await - fire and forget)
    sendContactEmails(name, email, message, contact._id).catch(err => {
      console.error("Async mail function error:", err);
    });

    // Return success immediately
    res.status(201).json({
      message: "Thank you! We've received your message and will get back to you soon.",
      contactId: contact._id
    });

  } catch (dbError) {
    console.error("Database error saving contact:", dbError);
    res.status(500).json({ message: "Failed to save your message. Please try again." });
  }
});

module.exports = router;