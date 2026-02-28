const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");

router.get('/', (req, res) => {
  res.json({ status: 'Contact route is active' });
});

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// POST /api/contact
router.post("/", async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const message = String(req.body?.message || '').trim();

  // Basic validation
  if (!name || !email || !message) {
    return res.status(400).json({ message: "All fields are required." });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Please enter a valid email address." });
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('Contact mail config missing: EMAIL_USER or EMAIL_PASS');
    return res.status(500).json({ message: "Contact service is not configured on server." });
  }

  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.verify();

    // 📩 Mail to YOU (Admin)
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

    // 📩 Auto-reply to USER
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

    res.json({ message: "Message sent successfully!" });

  } catch (error) {
    console.error("Contact mail error:", {
      message: error.message,
      code: error.code,
      command: error.command,
      responseCode: error.responseCode
    });
    res.status(500).json({ message: "Failed to send message. Please try again later." });
  }
});

module.exports = router;