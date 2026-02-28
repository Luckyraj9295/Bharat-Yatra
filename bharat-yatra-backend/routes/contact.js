const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const Contact = require("../models/Contact");

router.get('/', (req, res) => {
  res.json({ status: 'Contact route is active' });
});

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Helper: Send emails asynchronously without blocking response
const sendContactEmails = async (name, email, message, contactId) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('Email config missing: EMAIL_USER or EMAIL_PASS');
    await Contact.findByIdAndUpdate(contactId, {
      mailSent: false,
      mailError: 'Email service not configured'
    });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // 📩 Mail to Admin
    await transporter.sendMail({
      from: `"Bharat Yatra Website" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      replyTo: email,
      subject: `📬 New Enquiry from ${name}`,
      text: `New Contact Enquiry\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
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

    // 📩 Auto-reply to User (best-effort)
    try {
      await transporter.sendMail({
        from: `"Bharat Yatra Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "We received your enquiry - Bharat Yatra",
        text: `Hello ${name},\n\nThank you for contacting Bharat Yatra.\nOur team has received your message and will get back to you shortly.\n\nYour Message:\n${message}\n\nRegards,\nBharat Yatra Team`,
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
    } catch (autoReplyErr) {
      console.warn("Auto-reply failed but admin mail sent:", autoReplyErr.message);
    }

    // Mark as sent
    await Contact.findByIdAndUpdate(contactId, { mailSent: true });
    console.log('📧 Contact emails sent for ID:', contactId);

  } catch (error) {
    console.error("Contact mail error:", {
      message: error.message,
      code: error.code,
      command: error.command,
      responseCode: error.responseCode
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