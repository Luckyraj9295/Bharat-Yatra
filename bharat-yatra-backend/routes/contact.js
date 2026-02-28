const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");

// POST /api/contact
router.post("/", async (req, res) => {
  const { name, email, message } = req.body;

  // Basic validation
  if (!name || !email || !message) {
    return res.status(400).json({ message: "All fields are required." });
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

    // 📩 Mail to YOU (Admin)
    await transporter.sendMail({
      from: `"Bharat Yatra Website" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
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

    // 📩 Auto-reply to USER
    await transporter.sendMail({
      from: `"Bharat Yatra Support" <${process.env.EMAIL_USER}>`,
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

    res.json({ message: "Message sent successfully!" });

  } catch (error) {
    console.error("Contact mail error:", error);
    res.status(500).json({ message: "Failed to send message." });
  }
});

module.exports = router;