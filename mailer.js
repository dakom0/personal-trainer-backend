const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_PORT == "465", // true for 465, false for other ports
  service: 'gmail', // e.g., 'gmail', 'outlook', etc.
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Call this function after a booking is created
function sendBookingNotification(booking) {
  // Admin notification (plain text or simple HTML)
  console.log("Attempting to send email...")
  const adminPromise = transporter.sendMail({
    from: `"Trainer App" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    subject: "New Booking Received",
    text: `
      New booking received:
      Name: ${booking.name}
      Email: ${booking.email}
      Phone: ${booking.phone}
      Date: ${booking.date}
      Time: ${booking.time}
      Message: ${booking.message || "N/A"}
    `,
    html: `
      <h2>New Booking Received</h2>
      <ul>
        <li><strong>Name:</strong> ${booking.name}</li>
        <li><strong>Email:</strong> ${booking.email}</li>
        <li><strong>Phone:</strong> ${booking.phone}</li>
        <li><strong>Date:</strong> ${booking.date}</li>
        <li><strong>Time:</strong> ${booking.time}</li>
        <li><strong>Message:</strong> ${booking.message || "N/A"}</li>
      </ul>
    `,
  });

  // Client confirmation (HTML)
  const clientPromise = transporter.sendMail({
    from: `"Trainer App" <${process.env.EMAIL_USER}>`,
    to: booking.email,
    subject: "Your Booking is Confirmed!",
    text: `
      Hi ${booking.name},

      Thank you for booking a session!
      Here are your booking details:

      Date: ${booking.date}
      Time: ${booking.time}
      Phone: ${booking.phone}
      Message: ${booking.message || "N/A"}

      I look forward to working with you!

      Best,
      Your Trainer
    `,
    html: `
      <div style="font-family: Arial, sans-serif; color: #222;">
        <h2 style="color: #e11d48;">Your Booking is Confirmed!</h2>
        <p>Hi <strong>${booking.name}</strong>,</p>
        <p>Thank you for booking a session! Here are your booking details:</p>
        <table style="border-collapse: collapse;">
          <tr><td style="padding: 4px 8px;"><strong>Date:</strong></td><td>${booking.date}</td></tr>
          <tr><td style="padding: 4px 8px;"><strong>Time:</strong></td><td>${booking.time}</td></tr>
          <tr><td style="padding: 4px 8px;"><strong>Phone:</strong></td><td>${booking.phone}</td></tr>
          <tr><td style="padding: 4px 8px;"><strong>Message:</strong></td><td>${booking.message || "N/A"}</td></tr>
        </table>
        <p style="margin-top: 16px;">I look forward to working with you!</p>
        <p>Best,<br/>Your Trainer</p>
      </div>
    `,
  });

  return Promise.all([adminPromise, clientPromise]);
}

module.exports = { sendBookingNotification }