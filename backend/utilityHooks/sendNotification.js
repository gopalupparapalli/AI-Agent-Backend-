import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

import { getFilteredTickets } from "./filterData.js"; // adjust path as needed
import { aiSummarize } from "./aiSummarize.js"; // your existing AI summarizer

dotenv.config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

function isDateNearOrPast(dueDateStr, daysThreshold = 2) {
  const dueDate = new Date(dueDateStr);
  const now = new Date();
  const diffDays = (dueDate - now) / (1000 * 60 * 60 * 24);
  return diffDays <= daysThreshold;
}

/**
 * Sends notification email about tickets close to due or breached, with AI summary
 * @param {string} cluster
 * @returns {string} notification email address
 */
export async function sendNotification(cluster) {
  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!notifyEmail) {
    throw new Error("NOTIFY_EMAIL environment variable is missing");
  }

  const tickets = getFilteredTickets(cluster);

  // Filter tickets P1, P2, P3 near or past due date
  const ticketsToNotify = tickets.filter(
    (t) => ["P1", "P2", "P3"].includes(t.priority) && isDateNearOrPast(t.dueDate)
  );

  if (ticketsToNotify.length === 0) {
    console.log(`[Notify] No tickets near due date for cluster ${cluster}. No email sent.`);
    return `No notification sent: no tickets near due date for ${cluster}`;
  }

  // Generate AI summary (optional but recommended)
  const summary = await aiSummarize(
    cluster,
    [], // You can pass filtered incidents if available
    ticketsToNotify,
    0,  // pass real burnRate if calculated
    "N/A"
  );

  // Build email body with AI summary and ticket details
  let emailText = `Dear SRE,\n\nThe following tickets in cluster "${cluster}" are near or past their due dates:\n\n`;

  ticketsToNotify.forEach((t) => {
    emailText += `Priority: ${t.priority}\nDescription: ${t.description}\nDue Date: ${t.dueDate}\nStatus: ${t.status}\n\n`;
  });

  emailText += `AI Summary:\n${summary && summary.executiveSummary ? summary.executiveSummary : "No summary available."}\n\n`;
  emailText += `Please take immediate action.\n\nRegards,\nSLI Budget Forecaster`;

  const msg = {
    to: notifyEmail,
    from: notifyEmail,
    subject: `[${cluster}] Ticket Due Date Alert`,
    text: emailText,
  };

  try {
    await sgMail.send(msg);
    console.log(`[Notify] Email sent to ${notifyEmail} for cluster ${cluster} with ${ticketsToNotify.length} tickets.`);
    return notifyEmail;
  } catch (error) {
    console.error("[Notify] SendGrid send error:", error);
    if (error.response) console.error(error.response.body);
    throw new Error("SendGrid email sending failed");
  }
}
