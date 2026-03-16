import nodemailer from "nodemailer";

export default async function handler(req, res) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: "cosmokoala39@gmail.com",
    subject: "Test Email",
    text: "SMTP is working"
  });

  res.json({ success: true });
}