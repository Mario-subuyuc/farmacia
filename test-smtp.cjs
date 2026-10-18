require("dotenv").config();
const nodemailer = require("nodemailer");

async function testSMTP() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.verify();
    console.log("✅ SMTP conectado y autenticado correctamente");
  } catch (error) {
    console.error("❌ Falló la verificación SMTP");
    console.error("Código:", error.code);
    console.error("Respuesta:", error.response || error.message);
  } finally {
    transporter.close();
  }
}

testSMTP();